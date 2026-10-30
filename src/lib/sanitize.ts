import { CHANGE_SIGNAL, ITEM_KINDS, MIN_QUOTE_CHARS } from "@/lib/config";
import { asString, clamp, isRecord } from "@/lib/json";
import { isOfficialSourceUrl } from "@/lib/trust";
import type { Evidence, GuideItem, ItemKind } from "@/lib/types";

const RUPEE_MARKER = /₹|(?<![\p{L}\p{N}_])(?:INR|Rs\.?)(?![\p{L}_])/giu;
const SCALE_SUFFIX = /^\s*(?:k|thousand|million|billion|lacs?|lakhs?|crores?|हज़ार|हजार|लाख|करोड़)(?![\p{L}])/iu;

function unsupportedContinuation(text: string): boolean {
  return SCALE_SUFFIX.test(text) || /^\s*[-–—−+]\s*\d/u.test(text)
    || /^\s*\/(?!-(?:$|[\s.,;।]))/u.test(text)
    || /^\s+to\s+\d/iu.test(text)
    || /^\s+[.,]\s*\d/u.test(text)
    || /^\s+\d/u.test(text) || /^[\p{L}\p{N}_]/u.test(text);
}

export function normalizeQuote(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function quoteMatchesSnippet(quote: string, snippet: string): boolean {
  const left = normalizeQuote(quote);
  if (left.length < MIN_QUOTE_CHARS) return false;
  const right = normalizeQuote(snippet);
  let index = right.indexOf(left);
  while (index !== -1) {
    const after = right.slice(index + left.length);
    const before = right.slice(0, index);
    // A model may quote only the numeric prefix of the actual source fee.
    // Check the matching occurrence, not a different amount elsewhere.
    const cutsNumber = /[0-9०-९]$/.test(left)
      ? /^\s*[.,][0-9०-९]/.test(after) || unsupportedContinuation(after.replace(/[०-९]/g, "0"))
      : /[0-9०-९][.,]$/.test(left) && /^[0-9०-९]/.test(after);
    const cutsSign = /[-−+]\s*$/.test(before) && /^(?:₹|rs\.?|inr)/i.test(left);
    const cutsWord = /[\p{L}\p{M}]$/u.test(left) && /^[\p{L}\p{M}\p{N}_]/u.test(after);
    const cutsRupeeSuffix = /[0-9०-९]\/-$/.test(left) && !/^(?:$|[\s.,;।])/.test(after);
    if (!cutsNumber && !cutsSign && !cutsWord && !cutsRupeeSuffix) return true;
    index = right.indexOf(left, index + 1);
  }
  return false;
}

function parseRupees(text: string): { amounts: string[]; valid: boolean } {
  const normalized = text.replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
  const amounts: string[] = [];
  let valid = true;
  for (const marker of normalized.matchAll(RUPEE_MARKER)) {
    const rest = normalized.slice(marker.index + marker[0].length).trimStart();
    const match = /^[0-9][0-9,.]*/.exec(rest);
    if (!match) {
      // Currency labels in prose ("amounts in INR") are not amounts.
      // Still reject symbols and explicit malformed numeric expressions.
      if (marker[0] === "₹" || /^[+−\-0-9]/u.test(rest)
        || /^[.,(:]\s*[+−\-]?\s*\d/u.test(rest)) valid = false;
      continue;
    }
    const tail = rest.slice(match[0].length);
    // One final sentence delimiter is not a decimal/grouping separator.
    const sentenceEnd = /\.$/.test(match[0]);
    const token = match[0].replace(/[.,]$/, "");
    const [whole, fraction = "", ...extra] = token.split(".");
    const grouped = /^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,2}(?:,[0-9]{2})*,[0-9]{3})$/.test(whole);
    // Unsupported signs, scales and exponent notation must not become a
    // smaller, apparently cited numeric prefix. This is not a money parser.
    if (!grouped || extra.length || (token.includes(".") && !/^[0-9]+$/.test(fraction))
      || /[-−+]\s*$/.test(normalized.slice(0, marker.index))
      || (!sentenceEnd && unsupportedContinuation(tail))
      || (sentenceEnd && (SCALE_SUFFIX.test(tail) || /^\s*[-–—−+/,]|^\s*[.,]\s*\d/u.test(tail)))) {
      valid = false;
      continue;
    }
    const rupees = whole.replace(/,/g, "").replace(/^0+(?=\d)/, "");
    const decimals = fraction.replace(/0+$/, "");
    amounts.push(decimals ? `${rupees}.${decimals}` : rupees);
  }
  return { amounts, valid };
}

export function rupeeAmounts(text: string): string[] {
  return parseRupees(text).amounts;
}

export function amountsAreCited(text: string, quotes: readonly string[]): boolean {
  const cited = new Set(quotes.flatMap((quote) => {
    const parsed = parseRupees(quote);
    return parsed.valid ? parsed.amounts : [];
  }));
  const parsed = parseRupees(text);
  return parsed.valid && parsed.amounts.every((amount) => cited.has(amount));
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
  // URL identity must be checked before prose helpers can trim it.
  const url = typeof input.raw.url === "string" ? input.raw.url : "";
  const quote = asString(input.raw.quote) ?? "";
  const title = asString(input.raw.title) ?? "";
  const detail = asString(input.raw.detail) ?? "";
  if (!title || !url || !isOfficialSourceUrl(url)) return null;

  const page = input.evidence.find(
    (item) => item.url === url && quoteMatchesSnippet(quote, item.snippet),
  );
  if (!page) return null;
  if (!amountsAreCited(`${title} ${detail}`, [quote])) return null;

  const confidence = clamp(typeof input.raw.confidence === "number" && Number.isFinite(input.raw.confidence)
    ? input.raw.confidence : 0, 0, 1);
  const askedRecent = input.raw.recentChange === true;
  const recentChange = askedRecent && CHANGE_SIGNAL.test(quote);

  return {
    id: `s${input.order}`,
    kind: kindRaw,
    order: input.order,
    title,
    detail: detail || title,
    quote,
    url,
    sourceTitle: page.title,
    confidence,
    recentChange,
    sample: input.sample,
    basis: "live-evidence",
  };
}
