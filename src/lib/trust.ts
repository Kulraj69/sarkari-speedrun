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
  // Validate the supplied identifier before WHATWG URL parsing can repair it.
  // This is a lexical link policy, not DNS or redirect verification.
  if (/[\s\u0000-\u001f\u007f-\u009f\\]/u.test(url)
    || !/^https?:\/\/[a-z0-9.-]+(?::(?:80|443))?(?:[/?#]|$)/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const labels = parsed.hostname.split(".");
    return (parsed.protocol === "https:" || parsed.protocol === "http:")
      && !parsed.username && !parsed.password && !parsed.port
      && parsed.hostname.length <= 253
      && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
  } catch {
    return false;
  }
}

/** Official-source links only; preserve accepted URLs rather than rewriting them. */
export function isOfficialSourceUrl(url: string): boolean {
  return isPublicHttpUrl(url) && isOfficialHost(url);
}

export function blendEvidenceScore(tavilyScore: number, url: string): number {
  const score = clamp(tavilyScore, 0, 1);
  return isOfficialHost(url) ? score : score * 0.25;
}