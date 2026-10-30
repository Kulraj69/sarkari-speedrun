import { beforeEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { checklistText } from "@/lib/copy";
import { scoreEval } from "@/lib/eval-run";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import { chatComplete, ProviderError } from "@/lib/nebius";
import { gatherOfficialEvidence } from "@/lib/tavily";
import type { PipelineDeps } from "@/lib/types";

vi.mock("@/lib/nebius", async (original) => ({
  ...await original<typeof import("@/lib/nebius")>(), chatComplete: vi.fn(),
}));
vi.mock("@/lib/tavily", async (original) => ({
  ...await original<typeof import("@/lib/tavily")>(), gatherOfficialEvidence: vi.fn(),
}));

const quote = "Renewal of driving licence costs Rs. 200.";
const url = "https://parivahan.gov.in/fees";
const evidence = [{ title: "Fees", url, snippet: quote, score: 0.8 }];
let failure: string;
let chatCalls: number;
const deps: PipelineDeps = {
  env: { ...readEnv({}), mode: "live", nebiusApiKey: "", tavilyApiKey: "" },
  fetch: async () => { throw new Error("Network forbidden"); },
  now: () => 0, sleep: async () => {}, present: false,
};
// Fake configuration stays in memory; the provider functions are replaced.
deps.env.nebiusApiKey = "synthetic";
deps.env.tavilyApiKey = "synthetic";

beforeEach(() => {
  vi.resetAllMocks();
  failure = "";
  chatCalls = 0;
  vi.mocked(gatherOfficialEvidence).mockImplementation(async () => ({ evidence, latencyMs: 1, failed: null }));
  vi.mocked(chatComplete).mockImplementation(async (request) => {
    chatCalls += 1;
    const system = request.messages[0].content;
    let content: unknown;
    if (system.includes("plan the sub-questions")) {
      content = { questions: [{ text: "Renewal fee?" }] };
    } else if (system.includes("rewrite the search query")) {
      if (failure === "rewrite") throw new Error("synthetic-private-diagnostic");
      content = { query: "driving licence renewal fee" };
    } else if (system.includes("settle conflicts between sources")) {
      if (failure === "recheck" && chatCalls > 3) throw new Error("synthetic-private-diagnostic");
      content = { items: [{ kind: "fee", title: "Renewal fee", detail: quote, quote, url,
        confidence: ["rewrite", "retry-search", "recheck"].includes(failure) ? 0.2 : 0.9 }] };
    } else {
      if (failure === "checklist") throw new Error("synthetic-private-diagnostic");
      if (failure === "auth") throw new ProviderError("Nebius", 401, "Rejected test configuration");
      if (failure === "checklist-json") return { content: "not JSON", modelId: request.model, latencyMs: 1, promptTokens: 1, completionTokens: 1 };
      content = { hindi: "शुल्क Rs. 200।", english: failure === "amount" ? "Fee Rs. 9999." : quote };
    }
    return { content: JSON.stringify(content), modelId: request.model, latencyMs: 1, promptTokens: 1, completionTokens: 1 };
  });
});

describe("degraded pipeline visibility", () => {
  it.each(["rewrite", "retry-search", "recheck", "checklist", "checklist-json", "amount"])("keeps cited items but exposes %s fallback in state and copy", async (stage) => {
    failure = stage;
    if (stage === "retry-search") {
      vi.mocked(gatherOfficialEvidence).mockResolvedValueOnce({ evidence, latencyMs: 1, failed: null })
        .mockResolvedValue({ evidence: [], latencyMs: 1, failed: "Search unavailable." });
    }
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    const warnings = events.filter((event) => event.type === "warning");
    expect(warnings.length).toBeGreaterThan(0);
    const board = events.reduce(applyEvent, beginRun());
    expect(board.status).toBe("done");
    expect(board.items).toHaveLength(1);
    expect(board.warnings.length).toBeGreaterThan(0);
    expect(checklistText(board)).toContain("Run degraded");
    expect(JSON.stringify(events)).not.toContain("synthetic-private-diagnostic");
    expect(events.at(-1)?.type).toBe("done");
  });

  it("does not settle or generate a checklist when retrieval failed with no evidence", async () => {
    vi.mocked(gatherOfficialEvidence).mockResolvedValue({ evidence: [], latencyMs: 1, failed: "Search unavailable." });
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    expect(events.some((event) => event.type === "warning")).toBe(true);
    expect(chatCalls).toBe(1);
    expect(events.some((event) => event.type === "item")).toBe(false);
  });

  it("excludes degraded retrieval from evaluation", async () => {
    vi.mocked(gatherOfficialEvidence).mockResolvedValue({ evidence: [], latencyMs: 1, failed: "Search unavailable." });
    const report = await scoreEval(deps);
    expect(report.rows.every((row) => row.found === null && row.error?.includes("degraded"))).toBe(true);
  });

  it("keeps authentication failures terminal", async () => {
    failure = "auth";
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    expect(events.at(-1)?.type).toBe("error");
    expect(events.some((event) => event.type === "done")).toBe(false);
  });

  it("does not attach warnings to successful provider paths", async () => {
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    expect(events.some((event) => event.type === "warning")).toBe(false);
    expect(events.at(-1)?.type).toBe("done");
  });
});
