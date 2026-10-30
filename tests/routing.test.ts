import { beforeEach, describe, expect, it, vi } from "vitest";
import { focusDomains, OFFICIAL_INCLUDE_DOMAINS } from "@/lib/config";
import { labelForModel } from "@/lib/models";
import { readEnv } from "@/lib/env";
import { checklistText } from "@/lib/copy";
import { chatComplete } from "@/lib/nebius";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
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
const deps: PipelineDeps = {
  env: { ...readEnv({}), mode: "live" },
  fetch: async () => { throw new Error("Network forbidden"); },
  now: () => 0, sleep: async () => {}, present: false,
};
// Synthetic in-memory values; the provider functions below are replaced.
deps.env.nebiusApiKey = "synthetic";
deps.env.tavilyApiKey = "synthetic";
let rewrite: string;
let weak: boolean;
let unrelated: boolean;
let wrongKind: boolean;

beforeEach(() => {
  vi.resetAllMocks();
  weak = false;
  unrelated = false;
  wrongKind = false;
  rewrite = JSON.stringify({ query: "renew driving licence Jaipur fee" });
  vi.mocked(gatherOfficialEvidence).mockResolvedValue({
    evidence: [{ title: "Fees", url, snippet: quote, score: 0.8 }], latencyMs: 1, failed: null,
  });
  vi.mocked(chatComplete).mockImplementation(async (request) => {
    const system = request.messages[0].content;
    let content: string;
    if (system.includes("plan the sub-questions")) {
      content = JSON.stringify({ task: "residence certificate", city: "Patiala", questions: [{ text: "Renewal fee?" }] });
    } else if (system.includes("rewrite the search query")) {
      content = rewrite;
    } else if (system.includes("settle conflicts between sources")) {
      const retry = request.messages[1].content.includes('"id":"retry"');
      content = JSON.stringify({ items: [{ kind: retry && wrongKind ? "document" : "fee", title: retry && unrelated ? "Passport fee" : "Renewal fee", detail: quote, quote, url, confidence: retry ? 0.95 : weak ? 0.2 : 0.9 }] });
    } else {
      content = JSON.stringify({ hindi: "शुल्क Rs. 200।", english: quote });
    }
    return { content, modelId: request.model, latencyMs: 1, promptTokens: 1, completionTokens: 1 };
  });
});

describe("user scope and rewrite provenance", () => {
  it("keeps the supplied task and city even when the planner returns another jurisdiction", async () => {
    const events = await collectPipeline("renew driving licence, Jaipur", deps);
    expect(events.find((event) => event.type === "meta")).toMatchObject({ task: "renew driving licence", city: "Jaipur" });
    const request = vi.mocked(gatherOfficialEvidence).mock.calls[0][0];
    expect(request.query).toBe("renew driving licence Jaipur Renewal fee?");
    expect(request.includeDomains).toContain("parivahan.gov.in");
    expect(JSON.stringify(request)).not.toContain("punjab");
  });

  it("does not invent a city when the user omitted it", async () => {
    const events = await collectPipeline("renew driving licence", deps);
    expect(events.find((event) => event.type === "meta")).toMatchObject({ task: "renew driving licence", city: "" });
    expect(vi.mocked(gatherOfficialEvidence).mock.calls[0][0].query).not.toContain("Patiala");
  });

  it("rejects a valid-looking rewrite that drops the user's task and city", async () => {
    weak = true;
    rewrite = JSON.stringify({ query: "passport Patiala fee" });
    const events = await collectPipeline("renew driving licence, Jaipur", deps);
    expect(vi.mocked(gatherOfficialEvidence).mock.calls[1][0].query).toBe("renew driving licence Jaipur Renewal fee");
    expect(events.some((event) => event.type === "warning" && /fallback/.test(event.message))).toBe(true);
  });

  it("keeps the original item when a higher-confidence recheck changes its title", async () => {
    weak = true;
    unrelated = true;
    const events = await collectPipeline("renew driving licence, Jaipur", deps);
    const board = events.reduce(applyEvent, beginRun());
    expect(board.items[0].title).toBe("Renewal fee");
    expect(board.items[0].confidence).toBe(0.2);
    expect(board.warnings.join(" ")).toMatch(/identity/i);
  });

  it("allows a higher-confidence same-title and same-kind replacement", async () => {
    weak = true;
    const board = (await collectPipeline("renew driving licence, Jaipur", deps)).reduce(applyEvent, beginRun());
    expect(board.items[0].confidence).toBe(0.95);
  });

  it("rejects a higher-confidence replacement with the same title but another kind", async () => {
    weak = true;
    wrongKind = true;
    const board = (await collectPipeline("renew driving licence, Jaipur", deps)).reduce(applyEvent, beginRun());
    expect(board.items[0].kind).toBe("fee");
    expect(board.items[0].confidence).toBe(0.2);
    expect(board.warnings.join(" ")).toMatch(/identity/);
  });

  it.each(["renew arms licence", "apply for trade license"])("does not route %s to transport", (task) => {
    expect(focusDomains(task)).toBeUndefined();
  });

  it("does not attribute a custom configured model to Nemotron", async () => {
    weak = true;
    const custom = { ...deps, env: { ...deps.env, nanoModel: "local/test-planner", superModel: "local/test-checker" } };
    expect(labelForModel(custom.env.nanoModel, custom.env)).toBe("local/test-planner");
    const events = await collectPipeline("renew driving licence, Jaipur", custom);
    const trace = events.find((event) => event.type === "trace" && event.trace.id === "plan");
    expect(trace?.type === "trace" && trace.trace.detail).toContain("local/test-planner");
    for (const event of events) {
      if (event.type !== "trace" || event.trace.provider !== "Nebius Token Factory") continue;
      expect(event.trace.modelLabel).toBe(event.trace.modelId);
      expect(event.trace.detail).toContain(event.trace.modelId);
      expect(event.trace.detail).not.toMatch(/Nano|Super|Ultra/);
    }
  });

  it.each(["not JSON", "{}", '{"query":""}', '{"query":4}', '{"query":"short"}'])("exposes invalid rewrite %s instead of attributing fallback to Nano", async (raw) => {
    weak = true;
    rewrite = raw;
    const events = await collectPipeline("renew driving licence, Jaipur", deps);
    const board = events.reduce(applyEvent, beginRun());
    expect(board.warnings.join(" ")).toMatch(/rewrite.*fallback/i);
    expect(checklistText(board)).toMatch(/rewrite.*fallback/i);
    expect(vi.mocked(gatherOfficialEvidence).mock.calls[1][0].query).toBe("renew driving licence Jaipur Renewal fee");
    const trace = events.find((event) => event.type === "trace" && event.trace.id === "rewrite");
    expect(trace?.type === "trace" && trace.trace.detail).toMatch(/fallback/i);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("does not label a valid rewrite as a fallback", async () => {
    weak = true;
    const events = await collectPipeline("renew driving licence, Jaipur", deps);
    expect(events.filter((event) => event.type === "warning")).toEqual([]);
    expect(vi.mocked(gatherOfficialEvidence).mock.calls[1][0].query).toBe("renew driving licence Jaipur fee");
  });

  it.each(["residence certificate", "income certificate", "renew driving licence", "change voter address"])("does not hard-code Punjab portals for %s", (task) => {
    expect(JSON.stringify(focusDomains(task) ?? [])).not.toMatch(/punjab/);
  });

  it("does not put Punjab portals in the generic search default", () => {
    expect(OFFICIAL_INCLUDE_DOMAINS.join(" ")).not.toMatch(/punjab/);
  });
});
