import { GOLD_CHECKS } from "@/lib/eval-set";
import { goldFound, goldSiteCited, reportFromRows } from "@/lib/eval-score";
import type { EvalReport } from "@/lib/eval-score";
import { resolveMode } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import type { BoardState, PipelineDeps } from "@/lib/types";

export async function scoreEval(deps: PipelineDeps): Promise<EvalReport> {
  const mode = resolveMode(deps.env);
  const prompts = [...new Set(GOLD_CHECKS.map((check) => check.prompt))];
  const boardsByPrompt = new Map<string, BoardState>();

  for (const prompt of prompts) {
    const events = await collectPipeline(prompt, deps);
    boardsByPrompt.set(prompt, events.reduce(applyEvent, beginRun()));
  }

  const rows = GOLD_CHECKS.map((check) => {
    const board = boardsByPrompt.get(check.prompt);
    // Do not export raw provider error text into CLI output or public reports.
    const error = board?.error ? "Pipeline failed; check not scored."
      : board?.status !== "done" ? "Pipeline incomplete; check not scored."
      : board.warnings.length ? "Pipeline degraded; check not scored." : null;
    return {
      id: check.id,
      task: check.task,
      label: check.label,
      found: error ? null : goldFound(check, board?.items ?? []),
      sameSite: error ? null : goldSiteCited(check, board?.items ?? []),
      error,
    };
  });

  return reportFromRows(mode, rows);
}