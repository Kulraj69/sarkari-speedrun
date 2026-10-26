import { LIVE_SCORE_NOTE, MOCK_SCORE_NOTE, SMALL_SAMPLE_LABEL } from "@/lib/eval-set";
import type { GoldCheck } from "@/lib/eval-set";
import type { RunMode } from "@/lib/types";

export interface EvalRow {
  id: string;
  task: string;
  label: string;
  found: boolean;
  sameSite?: boolean;
}

export interface EvalReport {
  mode: RunMode;
  rows: EvalRow[];
  agreement: number;
  total: number;
  liveScore: boolean;
  heading: string;
  note: string;
}

export function formatAccuracyTable(report: EvalReport): string {
  const header = "task".padEnd(30) + "check".padEnd(28) + "exact line".padEnd(12) + "same site";
  const lines = report.rows.map((row) => {
    const found = row.found ? "yes" : "no";
    const site = row.sameSite === undefined ? "-" : row.sameSite ? "yes" : "no";
    return row.task.padEnd(30) + row.label.padEnd(28) + found.padEnd(12) + site;
  });
  const sameSite = report.rows.filter((row) => row.sameSite).length;
  return [
    report.heading,
    `Mode: ${report.mode}`,
    report.note,
    "",
    header,
    ...lines,
    "",
    `Exact gold line: ${report.agreement} of ${report.total}. Cited the same official site: ${sameSite} of ${report.total}.`,
  ].join("\n");
}

export function reportFromRows(mode: RunMode, rows: EvalRow[]): EvalReport {
  const agreement = rows.filter((row) => row.found).length;
  const liveScore = mode === "live";
  return {
    mode,
    rows,
    agreement,
    total: rows.length,
    liveScore,
    heading: SMALL_SAMPLE_LABEL,
    note: liveScore ? LIVE_SCORE_NOTE : MOCK_SCORE_NOTE,
  };
}

export function goldFound(check: GoldCheck, quotes: readonly { quote: string; url: string }[]): boolean {
  return quotes.some((item) => item.url === check.url && item.quote.includes(check.quote));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Looser check: the map cited the same official site the gold line comes from. */
export function goldSiteCited(check: GoldCheck, quotes: readonly { quote: string; url: string }[]): boolean {
  const host = hostOf(check.url);
  return quotes.some((item) => hostOf(item.url) === host);
}
