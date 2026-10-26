import { clamp } from "@/lib/json";

/**
 * Official hosts only. A .gov.in or .nic.in page outranks a blog when Super
 * settles a conflict, and non-official URLs are dropped before they reach the map.
 */
export function domainOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice("www.".length) : host;
  } catch {
    return null;
  }
}

export function isOfficialHost(url: string): boolean {
  const host = domainOf(url);
  if (!host) return false;
  return host === "gov.in" || host.endsWith(".gov.in") || host === "nic.in" || host.endsWith(".nic.in");
}

export function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function blendEvidenceScore(tavilyScore: number, url: string): number {
  const score = clamp(tavilyScore, 0, 1);
  return isOfficialHost(url) ? score : score * 0.25;
}