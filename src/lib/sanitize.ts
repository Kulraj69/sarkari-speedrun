import { CHANGE_SIGNAL, ITEM_KINDS, LOW_CONFIDENCE_CAP, MIN_QUOTE_CHARS } from "@/lib/config";
import { asString, clamp, isRecord } from "@/lib/json";
import { isOfficialHost, isPublicHttpUrl } from "@/lib/trust";
import type { Evidence, GuideItem, ItemKind } from "@/lib/types";

const RUPEE_AMOUNT = /(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/gi;

export function normalizeQuote(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function quoteMatchesSnippet(quote: string, snippet: string): boolean {
  const left = normalizeQuote(quote);
  if (left.length < MIN_QUOTE_CHARS) return false;
  return normalizeQuote(snippet).includes(left);
}

export function rupeeAmounts(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(RUPEE_AMOUNT)) {
    const digits = match[1]?.replace(/,/g, "") ?? "";
    const [whole, fraction = ""] = digits.split(".");
    const decimals = fraction.replace(/0+$/, "");
    if (whole) {
      const rupees = whole.replace(/^0+(?=\d)/, "");
      found.push(decimals ? `${rupees}.${decimals}` : rupees);
    }
  }
  return found;
}

export function amountsAreCited(text: string, quotes: readonly string[]): boolean {
  const cited = new Set(quotes.flatMap((quote) => rupeeAmounts(quote)));
  return rupeeAmounts(text).every((amount) => cited.has(amount));
}

function isKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

export interface SanitizeItemInput {
  raw: unknown;
  evidence: readonly Evidence[];
  sample: boolean;
  order: number;
}

export function sanitizeItem(input: SanitizeItemInput): GuideItem | null {
  if (!isRecord(input.raw)) return null;
  const kindRaw = asString(input.raw.kind)?.toLowerCase() ?? "";
  if (!isKind(kindRaw)) return null;
  const url = asString(input.raw.url) ?? "";
  const quote = asString(input.raw.quote) ?? "";
  const title = asString(input.raw.title) ?? "";
  const detail = asString(input.raw.detail) ?? "";
  if (!title || !url || !isPublicHttpUrl(url) || !isOfficialHost(url)) return null;

  const page = input.evidence.find(
    (item) => item.url === url && quoteMatchesSnippet(quote, item.snippet),
  );
  if (!page) return null;
  if (!amountsAreCited(`${title} ${detail}`, [quote])) return null;

  const confidence = clamp(typeof input.raw.confidence === "number" ? input.raw.confidence : 0, 0, 1);
  const askedRecent = input.raw.recentChange === true;
  const recentChange = askedRecent && CHANGE_SIGNAL.test(quote);

  return {
    id: asString(input.raw.id) || `s${input.order}`,
    kind: kindRaw,
    order: input.order,
    title,
    detail: detail || title,
    quote,
    url,
    sourceTitle: asString(input.raw.sourceTitle) || page.title,
    confidence: confidence < LOW_CONFIDENCE_CAP ? confidence : confidence,
    recentChange,
    sample: input.sample,
    basis: "live-evidence",
  };
}
