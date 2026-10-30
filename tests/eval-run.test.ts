import { beforeEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { GOLD_CHECKS } from "@/lib/eval-set";
import { scoreEval } from "@/lib/eval-run";
import { formatAccuracyTable } from "@/lib/eval-score";
import { collectPipeline } from "@/lib/pipeline";
import type { GuideItem, PipelineDeps, PipelineEvent } from "@/lib/types";

vi.mock("@/lib/pipeline", () => ({ collectPipeline: vi.fn() }));
const collect = vi.mocked(collectPipeline);
const deps: PipelineDeps = {
  env: readEnv({ RECEIPTS_MODE: "mock" }),
  fetch: vi.fn(() => { throw new Error("Network forbidden"); }),
  now: () => 0,
  sleep: async () => {},
  present: false,
};
const gold = GOLD_CHECKS[0]!;
const item: GuideItem = {
  id: "same-id", kind: "fee", order: 1, title: "Test item", detail: "Test only",
  quote: gold.quote, url: gold.url, sourceTitle: "Test source", confidence: 0.9,
  recentChange: false, sample: true, basis: "sample-fixture",
};

beforeEach(() => { collect.mockReset(); });

describe("final-map evaluation", () => {
  it("does not score a quote replaced on the visible map", async () => {
    collect.mockResolvedValue([
      { type: "item", item },
      { type: "item", item: { ...item, quote: "Replacement", url: "https://example.gov.in/new" } },
      { type: "done" },
    ]);
    const report = await scoreEval(deps);
    expect(report.rows[0]).toMatchObject({ found: false, sameSite: false });
  });

  it("scores a surviving replacement, not just the first event", async () => {
    collect.mockResolvedValue([
      { type: "item", item: { ...item, quote: "Old quote" } },
      { type: "item", item },
      { type: "done" },
    ]);
    expect((await scoreEval(deps)).rows[0]).toMatchObject({ found: true, sameSite: true });
  });

  it.each([
    [{ type: "item", item }, { type: "error", message: "Synthetic provider failure" }, { type: "done" }],
    [{ type: "item", item }],
    [],
  ] satisfies PipelineEvent[][])("separates failed or incomplete runs from misses: %j", async (...events) => {
    collect.mockResolvedValue(events);
    const report = await scoreEval(deps);
    expect(report.rows.every((row) => row.found === null && row.sameSite === null && row.error)).toBe(true);
    expect(report.failed).toBe(GOLD_CHECKS.length);
    expect(report.total).toBe(0);
    expect(report.agreement).toBe(0);
    expect(formatAccuracyTable(report)).toContain("not scored");
    expect(formatAccuracyTable(report)).toContain("Failed/incomplete checks: 10 of 10");
  });

  it("keeps completed misses distinct from errors in mixed runs", async () => {
    collect.mockImplementation(async (prompt) => prompt === gold.prompt
      ? [{ type: "error", message: "Synthetic failure" }]
      : [{ type: "done" }]);
    const report = await scoreEval(deps);
    const failed = GOLD_CHECKS.filter((check) => check.prompt === gold.prompt).length;
    expect(report.failed).toBe(failed);
    expect(report.total).toBe(GOLD_CHECKS.length - failed);
    expect(report.rows.filter((row) => row.found === false)).toHaveLength(report.total);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});
