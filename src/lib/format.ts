const MS_PER_SECOND = 1000;
const USD_TINY = 0.0001;
const USD_SMALL = 0.01;
const TINY_DIGITS = 4;
const SMALL_DIGITS = 3;

export function formatLatency(ms: number): string {
  if (ms < MS_PER_SECOND) return `${Math.round(ms)} ms`;
  return `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0.0000";
  if (value < USD_TINY) return "< $0.0001";
  if (value < USD_SMALL) return `$${value.toFixed(TINY_DIGITS)}`;
  return `$${value.toFixed(SMALL_DIGITS)}`;
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function trimReply(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("।"));
  const minKeep = Math.floor(maxChars * 0.6);
  if (lastStop >= minKeep) return slice.slice(0, lastStop + 1).trim();
  return `${slice.trim()}…`;
}