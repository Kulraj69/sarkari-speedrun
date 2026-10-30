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
import { blendEvidenceScore, isOfficialSourceUrl } from "@/lib/trust";
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

/** Indian missions abroad and court judgments are official but answer the wrong question. */
const OFF_TARGET_HOST = /(embassy|consulate|^cgi|^hci|^www\.cgi|^www\.hci|highcourt|sci\.gov\.in|ecourts)/i;

export function isOffTargetHost(url: string): boolean {
  try {
    return OFF_TARGET_HOST.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

const STOP = new Set(["what", "which", "where", "when", "with", "from", "that", "this", "the", "for", "and", "are", "how", "should", "used", "required", "india"]);

/** The part of a long page that talks about the question, not the site menu at the top. */
export function bestWindow(text: string, query: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].filter((word) => !STOP.has(word));
  if (words.length === 0) return clip(flat, limit);
  const lower = flat.toLowerCase();
  const step = Math.max(100, Math.floor(limit / 4));
  let bestStart = 0;
  let bestHits = -1;
  for (let start = 0; start < flat.length; start += step) {
    const slice = lower.slice(start, start + limit);
    const hits = words.reduce((sum, word) => sum + slice.split(word).length - 1, 0);
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }
  return flat.slice(bestStart, bestStart + limit).trim();
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
  } catch {
    throw new ProviderError("Tavily", 0, "Tavily search failed.");
  }

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
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new ProviderError("Tavily", 0, "Tavily search returned an invalid result list.");
  }
  const results = payload.results;
  const evidence: Evidence[] = [];

  for (const item of results) {
    if (!isRecord(item) || typeof item.url !== "string" || !isOfficialSourceUrl(item.url)) continue;
    if (isOffTargetHost(item.url)) continue;
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
  return { evidence, latencyMs: Math.max(0, request.now() - started) };
}

interface ExtractPage {
  url: string;
  raw: string;
}

async function extractTavily(
  request: Pick<TavilyRequest, "fetch" | "apiKey" | "now" | "query">,
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
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new ProviderError("Tavily", 0, "Tavily extraction returned an invalid result list.");
  }
  const results = payload.results;
  const requested = new Set(urls);
  const counts = new Map<string, number>();
  for (const item of results) {
    if (!isRecord(item) || typeof item.url !== "string" || !requested.has(item.url)) continue;
    counts.set(item.url, (counts.get(item.url) ?? 0) + 1);
  }
  const pages: ExtractPage[] = [];
  for (const item of results) {
    // Count before checking the body: a blank duplicate is still ambiguous.
    if (!isRecord(item) || typeof item.url !== "string" || counts.get(item.url) !== 1) continue;
    const raw = typeof item.raw_content === "string" ? item.raw_content : "";
    if (!raw.trim()) continue;
    pages.push({ url: item.url, raw: bestWindow(raw, request.query, EXTRACT_SNIPPET_CHARS) });
  }
  return { pages, latencyMs: Math.max(0, request.now() - started) };
}

export interface GatheredEvidence {
  evidence: Evidence[];
  latencyMs: number;
  failed: string | null;
}

export async function gatherOfficialEvidence(request: TavilyRequest): Promise<GatheredEvidence> {
  const started = request.now();
  const elapsed = () => Math.max(0, request.now() - started);
  const domains = request.includeDomains ?? OFFICIAL_INCLUDE_DOMAINS;

  let evidence: Evidence[] = [];
  try {
    const recent = await searchTavily({ ...request, includeDomains: domains, timeRange: TAVILY_TIME_RANGE });
    evidence = recent.evidence;
    if (evidence.length < MIN_OFFICIAL_HITS) {
      const openDated = await searchTavily({ ...request, includeDomains: domains, timeRange: null });
      evidence = openDated.evidence;
    }
    if (evidence.length < MIN_OFFICIAL_HITS) {
      const wider = await searchTavily({ ...request, includeDomains: [], timeRange: null });
      evidence = wider.evidence;
    }
  } catch (error) {
    if (isAuthStatus(error)) throw error;
    return { evidence, latencyMs: elapsed(), failed: "Search did not complete; any earlier snippets were retained." };
  }

  const urls = [...new Set(evidence.map((item) => item.url))].slice(0, EXTRACT_TOP_URLS);
  if (urls.length === 0) return { evidence, latencyMs: elapsed(), failed: null };

  let failed: string | null = null;
  try {
    const extracted = await extractTavily(request, urls);
    if (urls.some((url) => !extracted.pages.some((page) => page.url === url))) {
      failed = "Extraction incomplete; search snippets were retained for missing pages.";
    }
    evidence = evidence.map((item) => {
      const page = extracted.pages.find((candidate) => candidate.url === item.url);
      return page ? { ...item, snippet: page.raw } : item;
    });
  } catch (error) {
    if (isAuthStatus(error)) throw error;
    failed = "Extraction did not complete; search snippets were retained.";
  }

  return { evidence, latencyMs: elapsed(), failed };
}

export const TAVILY_SEARCH_ENDPOINT = SEARCH_URL;
export const TAVILY_EXTRACT_ENDPOINT = EXTRACT_URL;