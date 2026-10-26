import { LIVE_SCORE_NOTE, MOCK_SCORE_NOTE, SMALL_SAMPLE_LABEL } from "@/lib/eval-set";
import type { GoldCheck } from "@/lib/eval-set";
import type { RunMode } from "@/lib/types";

export interface EvalRow {
  id: string;
  task: string;
  label: string;
  found: boolean;
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
  const header = "task".padEnd(28) + "check".padEnd(28) + "found";
  const lines = report.rows.map((row) => {
    const found = row.found ? "yes" : "no";
    return row.task.padEnd(28) + row.label.padEnd(28) + found;
  });
  return [
    report.heading,
    `Mode: ${report.mode}`,
    report.note,
    "",
    header,
    ...lines,
    "",
    `Matched ${report.agreement} of ${report.total}.`,
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