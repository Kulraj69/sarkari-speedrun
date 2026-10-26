import {
  EXTRACT_SNIPPET_CHARS,
  EXTRACT_TOP_URLS,
  HTTP_STATUS,
  MIN_OFFICIAL_HITS,
  OFFICIAL_INCLUDE_DOMAINS,
  SNIPPET_CHARS,
  TAVILY_EXTRACT_TIMEOUT_MS,
  TAVILY_SEARCH_DEPTH,
  TAVILY_TIME_RANGE,
  TAVILY_TIMEOUT_MS,
} from "@/lib/config";
import { isRecord } from "@/lib/json";
import { ProviderError } from "@/lib/nebius";
import { blendEvidenceScore, isOfficialHost, isPublicHttpUrl } from "@/lib/trust";
import type { Evidence } from "@/lib/types";

const SEARCH_URL = "https://api.tavily.com/search";
const EXTRACT_URL = "https://api.tavily.com/extract";

export interface TavilyRequest {
  fetch: typeof fetch;
  apiKey: string;
  query: string;
  maxResults: number;
  now: () => number;
  includeDomains?: readonly string[];
  timeRange?: string | null;
}

export interface TavilySearch {
  evidence: Evidence[];
  latencyMs: number;
}

function clip(text: string, limit: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trim()}…`;
}

function isAuthStatus(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = (error as ProviderError).status;
  return status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.forbidden;
}

export async function searchTavily(request: TavilyRequest): Promise<TavilySearch> {
  const started = request.now();
  const body: Record<string, unknown> = {
    query: request.query,
    search_depth: TAVILY_SEARCH_DEPTH,
    topic: "general",
    max_results: request.maxResults,
    include_answer: false,
  };
  if (request.includeDomains && request.includeDomains.length > 0) {
    body.include_domains = [...request.includeDomains];
  }
  if (request.timeRange) body.time_range = request.timeRange;

  let response: Response;
  try {
    response = await request.fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    throw new ProviderError("Tavily", 0, `Tavily search failed (${message}).`);
  }

  const latencyMs = Math.max(0, request.now() - started);
  if (!response.ok) {
    if (response.status === HTTP_STATUS.unauthorized || response.status === HTTP_STATUS.forbidden) {
      throw new ProviderError(
        "Tavily",
        response.status,
        "Tavily rejected TAVILY_API_KEY. Fix the key, or unset both keys to use the cached demos.",
      );
    }
    throw new ProviderError("Tavily", response.status, `Tavily returned ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : [];
  const evidence: Evidence[] = [];

  for (const item of results) {
    if (!isRecord(item) || typeof item.url !== "string" || !isPublicHttpUrl(item.url)) continue;
    if (!isOfficialHost(item.url)) continue;
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : item.url;
    const snippet =
      typeof item.content === "string"
        ? clip(item.content, SNIPPET_CHARS)
        : typeof item.snippet === "string"
          ? clip(item.snippet, SNIPPET_CHARS)
          : "";
    const rawScore = typeof item.score === "number" ? item.score : 0;
    evidence.push({
      title,
      url: item.url,
      snippet,
      score: blendEvidenceScore(rawScore, item.url),
    });
  }

  evidence.sort((a, b) => b.score - a.score);
  return { evidence, latencyMs };
}

interface ExtractPage {
  url: string;
  raw: string;
}

async function extractTavily(
  request: Pick<TavilyRequest, "fetch" | "apiKey" | "now">,
  urls: readonly string[],
): Promise<{ pages: ExtractPage[]; latencyMs: number }> {
  const started = request.now();
  const response = await request.fetch(EXTRACT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ urls: [...urls] }),
    signal: AbortSignal.timeout(TAVILY_EXTRACT_TIMEOUT_MS),
  });
  const latencyMs = Math.max(0, request.now() - started);
  if (!response.ok) {
    if (response.status === HTTP_STATUS.unauthorized || response.status === HTTP_STATUS.forbidden) {
      throw new ProviderError(
        "Tavily",
        response.status,
        "Tavily rejected TAVILY_API_KEY. Fix the key, or unset both keys to use the cached demos.",
      );
    }
    throw new ProviderError("Tavily", response.status, `Tavily extract returned ${response.status}.`);
  }
  const payload: unknown = await response.json();
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : [];
  const pages: ExtractPage[] = [];
  for (const item of results) {
    if (!isRecord(item) || typeof item.url !== "string") continue;
    const raw = typeof item.raw_content === "string" ? item.raw_content : "";
    if (!raw.trim()) continue;
    pages.push({ url: item.url, raw: clip(raw, EXTRACT_SNIPPET_CHARS) });
  }
  return { pages, latencyMs };
}

export interface GatheredEvidence {
  evidence: Evidence[];
  latencyMs: number;
  failed: string | null;
}

export async function gatherOfficialEvidence(request: TavilyRequest): Promise<GatheredEvidence> {
  let latencyMs = 0;
  const domains = request.includeDomains ?? OFFICIAL_INCLUDE_DOMAINS;

  let evidence: Evidence[] = [];
  try {
    const recent = await searchTavily({ ...request, includeDomains: domains, timeRange: TAVILY_TIME_RANGE });
    latencyMs += recent.latencyMs;
    evidence = recent.evidence;
    if (evidence.length < MIN_OFFICIAL_HITS) {
      const openDated = await searchTavily({ ...request, includeDomains: domains, timeRange: null });
      latencyMs += openDated.latencyMs;
      evidence = openDated.evidence;
    }
    if (evidence.length < MIN_OFFICIAL_HITS) {
      const wider = await searchTavily({ ...request, includeDomains: [], timeRange: null });
      latencyMs += wider.latencyMs;
      evidence = wider.evidence;
    }
  } catch (error) {
    if (isAuthStatus(error)) throw error;
    const message = error instanceof Error ? error.message : "search failed";
    return { evidence: [], latencyMs, failed: message };
  }

  const urls = evidence.slice(0, EXTRACT_TOP_URLS).map((item) => item.url);
  if (urls.length === 0) return { evidence, latencyMs, failed: null };

  try {
    const extracted = await extractTavily(request, urls);
    latencyMs += extracted.latencyMs;
    evidence = evidence.map((item) => {
      const page = extracted.pages.find((candidate) => candidate.url === item.url);
      return page ? { ...item, snippet: page.raw } : item;
    });
  } catch (error) {
    if (isAuthStatus(error)) throw error;
  }

  return { evidence, latencyMs, failed: null };
}

export const TAVILY_SEARCH_ENDPOINT = SEARCH_URL;
export const TAVILY_EXTRACT_ENDPOINT = EXTRACT_URL;