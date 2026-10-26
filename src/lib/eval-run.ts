import { GOLD_CHECKS } from "@/lib/eval-set";
import { goldFound, goldSiteCited, reportFromRows } from "@/lib/eval-score";
import type { EvalReport } from "@/lib/eval-score";
import { resolveMode } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import type { PipelineDeps } from "@/lib/types";

export async function scoreEval(deps: PipelineDeps): Promise<EvalReport> {
  const mode = resolveMode(deps.env);
  const prompts = [...new Set(GOLD_CHECKS.map((check) => check.prompt))];
  const quotesByPrompt = new Map<string, { quote: string; url: string }[]>();

  for (const prompt of prompts) {
    const events = await collectPipeline(prompt, deps);
    const quotes = events
      .filter((event) => event.type === "item")
      .map((event) => (event.type === "item" ? { quote: event.item.quote, url: event.item.url } : null))
      .filter((item): item is { quote: string; url: string } => item !== null);
    quotesByPrompt.set(prompt, quotes);
  }

  const rows = GOLD_CHECKS.map((check) => ({
    id: check.id,
    task: check.task,
    label: check.label,
    found: goldFound(check, quotesByPrompt.get(check.prompt) ?? []),
    sameSite: goldSiteCited(check, quotesByPrompt.get(check.prompt) ?? []),
  }));

  return reportFromRows(mode, rows);
}