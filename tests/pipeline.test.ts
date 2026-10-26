import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_RETRY_BELOW,
  MAX_INPUT_CHARS,
  NANO_MODEL_ID,
  OFFICIAL_INCLUDE_DOMAINS,
  SUPER_MODEL_ID,
  TAVILY_TIME_RANGE,
  ULTRA_MODEL_ID,
} from "@/lib/config";
import { EMPTY_CHECKLIST_EN } from "@/lib/copy";
import { describeRuntime, readEnv, resolveMode } from "@/lib/env";
import { GOLD_CHECKS } from "@/lib/eval-set";
import { formatAccuracyTable } from "@/lib/eval-score";
import { scoreEval } from "@/lib/eval-run";
import { assertDemoFixtures, DEMO_TASKS } from "@/lib/fixtures";
import { createCheckResponse } from "@/lib/http";
import { extractJson } from "@/lib/json";
import { estimateUsd } from "@/lib/models";
import { parsePlan, parseChecklist } from "@/lib/parsers";
import { parseTaskLine } from "@/lib/parse-task";
import { collectPipeline } from "@/lib/pipeline";
import type { PipelineDeps, PipelineEvent, ReceiptsEnv } from "@/lib/types";
import { applyEvent, beginRun } from "@/lib/reduce";
import { quoteMatchesSnippet, rupeeAmounts, sanitizeItem } from "@/lib/sanitize";
import { isOfficialHost } from "@/lib/trust";
import { searchTavily } from "@/lib/tavily";

const UNKNOWN_TASK = "renew arms licence, Jaipur";
const FEE_SNIPPET = "Renewal of driving licence | Rs. 200.00/- on the official fee table.";
const FEE_URL = "https://parivahan.gov.in/en/content/licensing-related-fees-charges";

function mockEnv(overrides: Partial<ReceiptsEnv> = {}): ReceiptsEnv {
  return { ...readEnv({}), ...overrides };
}

function liveEnv(): ReceiptsEnv {
  return mockEnv({
    mode: "live",
    nebiusApiKey: "test-nebius",
    tavilyApiKey: "test-tavily",
  });
}

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    fetch: async () => {
      throw new Error("network disabled");
    },
    env: mockEnv(),
    now: () => 0,
    sleep: async () => {},
    present: false,
    ...overrides,
  };
}

async function collect(text: string, pipelineDeps: PipelineDeps): Promise<PipelineEvent[]> {
  return collectPipeline(text, pipelineDeps);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chatBody(content: string): unknown {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 12, completion_tokens: 8 },
  };
}

function feeItem(confidence: number, quote = FEE_SNIPPET.slice(0, FEE_SNIPPET.indexOf(" on"))): unknown {
  return {
    kind: "fee",
    title: "Renewal fee",
    detail: "Parivahan lists renewal at Rs. 200.00.",
    quote,
    url: FEE_URL,
    sourceTitle: "Licensing fees",
    confidence,
    recentChange: false,
  };
}

describe("cached demos", () => {
  it("keeps five official, quoted tasks", () => {
    expect(() => assertDemoFixtures()).not.toThrow();
    expect(DEMO_TASKS).toHaveLength(5);
    const texts = DEMO_TASKS.map((task) => task.text);
    expect(texts).toContain("renew passport, Patiala");
    expect(texts).toContain("Punjab residence certificate, Patiala");
    for (const task of DEMO_TASKS) {
      expect(task.items.some((item) => item.kind === "office" || item.kind === "step")).toBe(true);
      expect(task.english.length).toBeGreaterThan(40);
      expect(task.hindi).toMatch(/[\u0900-\u097F]/);
    }
  });

  it("plays the passport demo without calling the network", async () => {
    const events = await collect("renew passport, Patiala", deps());
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(events.at(-1)?.type).toBe("done");
    const meta = events.find((event) => event.type === "meta");
    expect(meta).toMatchObject({ mode: "mock", sample: true, city: "Patiala", fixtureId: "passport-patiala" });
    const items = events.filter((event) => event.type === "item");
    expect(items.length).toBeGreaterThan(3);
    const traces = events.filter((event) => event.type === "trace");
    expect(traces.some((event) => event.type === "trace" && event.trace.modelId === NANO_MODEL_ID)).toBe(true);
    expect(traces.some((event) => event.type === "trace" && event.trace.modelId === SUPER_MODEL_ID)).toBe(true);
    expect(traces.every((event) => event.type === "trace" && event.trace.provider === "Sample fixture")).toBe(true);
    expect(
      traces.every(
        (event) =>
          event.type === "trace" && event.trace.detail.toLowerCase().includes("no token factory or tavily call"),
      ),
    ).toBe(true);
    const checklist = events.find((event) => event.type === "checklist");
    expect(checklist && checklist.type === "checklist" && checklist.checklist.english).toContain("Rs.2,500");
    expect(checklist && checklist.type === "checklist" && checklist.checklist.hindi).toMatch(/[\u0900-\u097F]/);
  });

  it("does not invent steps for a task that is not cached", async () => {
    const events = await collect(UNKNOWN_TASK, deps());
    expect(events.some((event) => event.type === "item")).toBe(false);
    const checklist = events.find((event) => event.type === "checklist");
    expect(checklist).toMatchObject({ checklist: { english: EMPTY_CHECKLIST_EN, sample: true } });
    const meta = events.find((event) => event.type === "meta");
    expect(meta).toMatchObject({ fixtureId: null, sample: true, mode: "mock", city: "Jaipur" });
  });

  it("rejects an empty line and an oversized line", async () => {
    const empty = await collect("   ", deps());
    expect(empty[0]?.type).toBe("error");
    const huge = await collect("a".repeat(MAX_INPUT_CHARS + 1), deps());
    expect(huge[0]?.type).toBe("error");
  });
});

describe("live pipeline", () => {
  it("plans with Nano, searches official domains, extracts, and lets Super settle", async () => {
    const calls: Array<{ url: string; model?: string; timeRange?: string; domains?: string[] }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        model?: string;
        query?: string;
        time_range?: string;
        include_domains?: string[];
        messages?: Array<{ content: string }>;
      };
      calls.push({ url, model: body.model, timeRange: body.time_range, domains: body.include_domains });
      if (url.includes("/extract")) {
        return jsonResponse({
          results: [{ url: FEE_URL, raw_content: FEE_SNIPPET }],
        });
      }
      if (url.includes("tavily.com")) {
        expect(body.include_domains).toEqual(expect.arrayContaining(["parivahan.gov.in", "gov.in"]));
        expect(body.time_range).toBe(TAVILY_TIME_RANGE);
        return jsonResponse({
          results: [
            { title: "Blog", url: "https://random-blog.example/fee", content: "Ignore this blog.", score: 0.99 },
            { title: "Parivahan fees", url: FEE_URL, content: FEE_SNIPPET, score: 0.4 },
          ],
        });
      }
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(
          chatBody(JSON.stringify({ task: "renew driving licence", city: "Amritsar", questions: [{ text: "What is the renewal fee?" }] })),
        );
      }
      if (body.model === SUPER_MODEL_ID && system.includes("settle conflicts between sources")) {
        return jsonResponse(chatBody(JSON.stringify({ items: [feeItem(0.86)] })));
      }
      if (system.includes("checklist in Hindi and in English")) {
        return jsonResponse(
          chatBody(JSON.stringify({ hindi: "नवीनीकरण शुल्क Rs. 200.00 है।", english: "The renewal fee is Rs. 200.00." })),
        );
      }
      return jsonResponse({ error: "unexpected" }, 500);
    };

    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(calls[0]?.model).toBe(NANO_MODEL_ID);
    expect(calls.filter((call) => call.url.includes("/search"))).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes("/extract"))).toHaveLength(1);
    expect(calls.filter((call) => call.model === SUPER_MODEL_ID)).toHaveLength(1);
    expect(calls.at(-1)?.model).toBe(NANO_MODEL_ID);
    const item = events.find((event) => event.type === "item");
    expect(item && item.type === "item" && item.item.kind).toBe("fee");
    expect(item && item.type === "item" && item.item.quote).toContain("Rs. 200.00");
    const settle = events.find((event) => event.type === "trace" && event.trace.step === "settle");
    expect(settle && settle.type === "trace" && settle.trace.estimatedUsd).not.toBeNull();
    expect(settle && settle.type === "trace" && settle.trace.promptTokens).toBe(12);
  });

  it("drops a fee whose quote is not on the page", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; messages?: Array<{ content: string }> };
      if (url.includes("/extract")) return jsonResponse({ results: [] });
      if (url.includes("tavily.com")) {
        return jsonResponse({ results: [{ title: "Fees", url: FEE_URL, content: FEE_SNIPPET, score: 0.5 }] });
      }
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(chatBody(JSON.stringify({ task: "renew driving licence", city: "Amritsar", questions: [{ text: "Fee?" }] })));
      }
      if (system.includes("settle conflicts between sources")) {
        return jsonResponse(
          chatBody(JSON.stringify({ items: [feeItem(0.95, "This quote was never on the official page at all.")] })),
        );
      }
      return jsonResponse(chatBody(JSON.stringify({ hindi: "खाली।", english: "Empty." })));
    };
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(events.some((event) => event.type === "item")).toBe(false);
    const checklist = events.find((event) => event.type === "checklist");
    expect(checklist && checklist.type === "checklist" && checklist.checklist.english.toLowerCase()).toContain("empty");
  });

  it("rewrites the query and checks once more when confidence is low", async () => {
    let superCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; messages?: Array<{ content: string }> };
      if (url.includes("tavily.com")) {
        return jsonResponse({
          results: [{ title: "Fees", url: FEE_URL, content: FEE_SNIPPET, score: 0.8 }],
        });
      }
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(chatBody(JSON.stringify({ questions: [{ text: "What is the renewal fee?" }] })));
      }
      if (system.includes("rewrite the search query")) {
        return jsonResponse(chatBody(JSON.stringify({ query: "Parivahan driving licence renewal fee Punjab" })));
      }
      if (body.model === SUPER_MODEL_ID) {
        superCalls += 1;
        const confidence = superCalls === 1 ? 0.2 : 0.91;
        return jsonResponse(chatBody(JSON.stringify({ items: [feeItem(confidence)] })));
      }
      if (system.includes("checklist in Hindi and in English")) {
        return jsonResponse(chatBody(JSON.stringify({ hindi: "शुल्क Rs. 200.00।", english: "Fee Rs. 200.00." })));
      }
      return jsonResponse({ error: "unexpected" }, 500);
    };
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(superCalls).toBe(2);
    expect(events.some((event) => event.type === "trace" && event.trace.step === "rewrite")).toBe(true);
    const items = events.filter((event) => event.type === "item");
    const last = items.at(-1);
    expect(last && last.type === "item" && last.item.confidence).toBeGreaterThan(CONFIDENCE_RETRY_BELOW);
  });

  it("falls back from Super to Ultra when Super is unavailable", async () => {
    const models: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string; messages?: Array<{ content: string }> };
      if (body.model) models.push(body.model);
      if (url.includes("tavily.com")) {
        return jsonResponse({ results: [{ title: "Fees", url: FEE_URL, content: FEE_SNIPPET, score: 0.5 }] });
      }
      if (body.model === SUPER_MODEL_ID) return jsonResponse({ error: "unavailable" }, 503);
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(chatBody(JSON.stringify({ questions: [{ text: "What is the renewal fee?" }] })));
      }
      if (body.model === ULTRA_MODEL_ID) {
        return jsonResponse(chatBody(JSON.stringify({ items: [feeItem(0.84)] })));
      }
      return jsonResponse(chatBody(JSON.stringify({ hindi: "शुल्क Rs. 200.00।", english: "Fee Rs. 200.00." })));
    };
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(models).toContain(ULTRA_MODEL_ID);
    const settle = events.find((event) => event.type === "trace" && event.trace.step === "settle");
    expect(settle && settle.type === "trace" && settle.trace.modelId).toBe(ULTRA_MODEL_ID);
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("stops on a rejected Tavily key instead of inventing a fee", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content: string }> };
      if (url.includes("tavily.com")) return jsonResponse({ error: "nope" }, 401);
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(chatBody(JSON.stringify({ questions: [{ text: "What is the renewal fee?" }] })));
      }
      return jsonResponse({ error: "should not run" }, 500);
    };
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(events.some((event) => event.type === "item")).toBe(false);
    const error = events.find((event) => event.type === "error");
    expect(error && error.type === "error" && error.message.toLowerCase()).toContain("tavily");
  });

  it("reports a model that did not return JSON instead of drawing a step", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse(chatBody("sure, the fee is zero"));
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    expect(events.some((event) => event.type === "item")).toBe(false);
    expect(events.some((event) => event.type === "error")).toBe(true);
  });

  it("replaces a checklist that invents a rupee amount", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content: string }> };
      if (url.includes("tavily.com")) {
        return jsonResponse({ results: [{ title: "Fees", url: FEE_URL, content: FEE_SNIPPET, score: 0.5 }] });
      }
      const system = body.messages?.[0]?.content ?? "";
      if (system.includes("plan the sub-questions")) {
        return jsonResponse(chatBody(JSON.stringify({ questions: [{ text: "Fee?" }] })));
      }
      if (system.includes("settle conflicts between sources")) {
        return jsonResponse(chatBody(JSON.stringify({ items: [feeItem(0.9)] })));
      }
      return jsonResponse(chatBody(JSON.stringify({ hindi: "शुल्क Rs. 9999 है।", english: "The fee is Rs. 9999." })));
    };
    const events = await collect("renew driving licence, Amritsar", deps({ env: liveEnv(), fetch: fetchImpl }));
    const checklist = events.find((event) => event.type === "checklist");
    expect(checklist && checklist.type === "checklist" && checklist.checklist.english).not.toContain("9999");
    expect(checklist && checklist.type === "checklist" && checklist.checklist.english).toContain("cited lines");
  });
});

describe("guards", () => {
  it("parses a task line and official hosts", () => {
    expect(parseTaskLine("renew passport, Patiala")).toEqual({ task: "renew passport", city: "Patiala" });
    expect(isOfficialHost("https://www.passportindia.gov.in/psp")).toBe(true);
    expect(isOfficialHost("https://eservices.punjab.gov.in/")).toBe(true);
    expect(isOfficialHost("https://random-blog.example/post")).toBe(false);
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("keeps a quoted fee and drops an invented one", () => {
    const evidence = [{ title: "Fees", url: FEE_URL, snippet: FEE_SNIPPET, score: 0.5 }];
    const kept = sanitizeItem({ raw: feeItem(0.9), evidence, sample: false, order: 1 });
    expect(kept?.kind).toBe("fee");
    expect(kept?.recentChange).toBe(false);
    const dropped = sanitizeItem({
      raw: feeItem(0.9, "A completely different sentence about a subsidy."),
      evidence,
      sample: false,
      order: 1,
    });
    expect(dropped).toBeNull();
    expect(quoteMatchesSnippet("Renewal of driving licence | Rs. 200.00/-", FEE_SNIPPET)).toBe(true);
    expect(rupeeAmounts("Rs. 200.00 and Rs. 1,000")).toEqual(["200", "1000"]);
  });

  it("clears a recent-change flag the quote does not support", () => {
    const evidence = [{ title: "Fees", url: FEE_URL, snippet: FEE_SNIPPET, score: 0.5 }];
    const raw = feeItem(0.8) as { recentChange: boolean };
    raw.recentChange = true;
    const item = sanitizeItem({ raw, evidence, sample: false, order: 1 });
    expect(item?.recentChange).toBe(false);
  });

  it("sorts nothing from a non-official hit", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        results: [{ title: "Blog", url: "https://medium.com/fees", content: "Rs. 1 only on a blog.", score: 0.99 }],
      });
    const result = await searchTavily({
      fetch: fetchImpl,
      apiKey: "test",
      query: "fee",
      maxResults: 4,
      now: () => 1,
      includeDomains: OFFICIAL_INCLUDE_DOMAINS,
      timeRange: TAVILY_TIME_RANGE,
    });
    expect(result.evidence).toEqual([]);
  });

  it("parses a plan and trims a long checklist", () => {
    const plan = parsePlan(JSON.stringify({ task: "passport", city: "Patiala", questions: [{ text: "Fee?" }, { text: "Docs?" }] }), 1);
    expect(plan.questions).toHaveLength(1);
    expect(plan.city).toBe("Patiala");
    const checklist = parseChecklist(JSON.stringify({ hindi: "छोटा।", english: `${"word ".repeat(400)}` }));
    expect(checklist.english.length).toBeLessThanOrEqual(1_200);
  });

  it("resolves mock and live modes", () => {
    expect(resolveMode(mockEnv())).toBe("mock");
    expect(resolveMode(liveEnv())).toBe("live");
    expect(() => resolveMode(mockEnv({ mode: "live" }))).toThrow(/NEBIUS_API_KEY/);
    expect(describeRuntime(mockEnv()).mode).toBe("mock");
    expect(describeRuntime(liveEnv()).hasNebiusKey).toBe(true);
    expect(describeRuntime(liveEnv()).superModel).toBe(SUPER_MODEL_ID);
  });

  it("estimates Nano cost from the public list price", () => {
    expect(estimateUsd(NANO_MODEL_ID, 1_000_000, 1_000_000)).toBeCloseTo(0.3);
    expect(estimateUsd("custom/model", 10, 10)).toBeNull();
  });

  it("streams a cached demo and rejects a bad body", async () => {
    const response = await createCheckResponse(
      new Request("http://local/api/check", {
        method: "POST",
        body: JSON.stringify({ text: "renew passport, Patiala" }),
      }),
      deps(),
    );
    const body = await response.text();
    expect(body).toContain("item");
    expect(body).toContain("done");
    const bad = await createCheckResponse(new Request("http://local/api/check", { method: "POST", body: "{}" }), deps());
    expect(bad.status).toBe(400);
  });

  it("keeps an error if the stream also finishes", () => {
    const state = applyEvent(applyEvent(beginRun(), { type: "error", message: "stopped" }), { type: "done" });
    expect(state.status).toBe("error");
  });
});

describe("eval sample", () => {
  it("scores the cached demos as a small sample, not a live accuracy number", async () => {
    expect(GOLD_CHECKS.length).toBe(10);
    const prompts = new Set(GOLD_CHECKS.map((check) => check.prompt));
    expect(prompts.size).toBe(5);
    const report = await scoreEval(deps());
    expect(report.liveScore).toBe(false);
    expect(report.agreement).toBe(report.total);
    const table = formatAccuracyTable(report);
    expect(table).toContain("Small sample");
    expect(table).toContain("Not a benchmark");
    expect(table.toLowerCase()).toContain("not a live accuracy");
  });
});