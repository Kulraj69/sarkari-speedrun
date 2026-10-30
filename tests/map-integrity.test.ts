import { describe, expect, it } from "vitest";
import { MAX_ITEMS } from "@/lib/config";
import { scoreEval } from "@/lib/eval-run";
import { readEnv } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import { sanitizeItem } from "@/lib/sanitize";
import type { PipelineDeps } from "@/lib/types";

const url = "https://parivahan.gov.in/fees";
const quote = "Renewal costs Rs. 200. Bring the application form.";
const evidence = [{ url, title: "Retrieved fee table", snippet: quote, score: 1 }];
const item = (overrides: Record<string, unknown> = {}) => ({
  id: "duplicate", kind: "fee", title: "Renewal fee", detail: "Rs. 200", quote, url,
  sourceTitle: "Model invented source title", confidence: 0.9, ...overrides,
});

// Synthetic provider responses only. No environment secrets or network calls.
function deps(items: unknown[], retryItems: unknown[] = items,
  checklist = { hindi: "शुल्क Rs. 200।", english: "Fee Rs. 200." },
  source = quote): PipelineDeps {
  let settles = 0;
  return {
    env: { ...readEnv({}), mode: "live", nebiusApiKey: "synthetic", tavilyApiKey: "synthetic" },
    now: () => 0, sleep: async () => {}, present: false,
    fetch: async (input, init) => {
      if (String(input).includes("/extract")) return Response.json({ results: [{ url, raw_content: source }] });
      if (String(input).includes("tavily.com")) return Response.json({ results: [{ ...evidence[0], content: source }] });
      const system = JSON.parse(String(init?.body)).messages[0].content as string;
      const content = system.includes("plan the sub-questions") ? { questions: [{ text: "Fee?" }] }
        : system.includes("settle conflicts between sources") ? { items: ++settles === 1 ? items : retryItems }
        : system.includes("rewrite the search query") ? { query: "renew driving licence Amritsar Renewal fee" }
        : checklist;
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 12, completion_tokens: 8 } });
    },
  };
}

async function board(items: unknown[], retryItems?: unknown[]) {
  return (await collectPipeline("renew driving licence, Amritsar", deps(items, retryItems)))
    .reduce(applyEvent, beginRun());
}

describe("map integrity", () => {
  it.each(["₹200 la", "₹200 thou", "₹200/-"])("rejects truncated source money initially and on retry: %s", async (cut) => {
    const full = cut === "₹200 la" ? "₹200 lakh" : cut === "₹200 thou" ? "₹200 thousand" : "₹200/-999";
    const prefix = "The official renewal fee is ";
    const bad = item({ quote: prefix + cut, detail: "₹200", confidence: 0.95 });
    const source = `${quote} ${prefix}${full} for renewal.`;
    const initial = (await collectPipeline("renew driving licence, Amritsar", deps([bad], undefined, undefined, source)))
      .reduce(applyEvent, beginRun());
    expect(initial.items).toEqual([]);
    const retry = (await collectPipeline("renew driving licence, Amritsar",
      deps([item({ confidence: 0.2 })], [bad], undefined, source))).reduce(applyEvent, beginRun());
    expect(retry.items[0]).toMatchObject({ quote, confidence: 0.2 });
    expect(retry.traces.find(trace => trace.id === "settle-retry")?.outcome).toBe("rejected");
  });

  it.each(["hindi", "english"])("rejects comma-space numeric continuation in %s", async (language) => {
    const checklist = { hindi: "शुल्क Rs. 200।", english: "Fee Rs. 200.", [language]: "Pay ₹200, 000." };
    const result = (await collectPipeline("renew driving licence, Amritsar", deps([item()], undefined, checklist)))
      .reduce(applyEvent, beginRun());
    expect(result.checklist?.english).toContain("cited lines");
    expect(JSON.stringify(result.checklist)).not.toContain("200, 000");
  });

  it.each(["₹200–999", "INR 999", "₹९९९", "-₹200", "₹200 000"])(
    "rejects unsupported currency in settlement and retry: %s", async (detail) => {
      const initial = await board([item({ detail })]);
      expect(initial.items).toEqual([]);
      expect(initial.traces.find(trace => trace.id === "settle")?.outcome).toBe("rejected");
      const retry = await board([item({ confidence: 0.2 })], [item({ detail, confidence: 0.95 })]);
      expect(retry.items[0]).toMatchObject({ detail: "Rs. 200", confidence: 0.2 });
      expect(retry.traces.find(trace => trace.id === "settle-retry")?.outcome).toBe("rejected");
    },
  );

  it.each(["hindi", "english"])("rejects a corrupted %s checklist end to end", async (language) => {
    const checklist = { hindi: "शुल्क Rs. 200।", english: "Fee Rs. 200.", [language]: "₹200–999" };
    const events = await collectPipeline("renew driving licence, Amritsar", deps([item()], undefined, checklist));
    const result = events.reduce(applyEvent, beginRun());
    expect(result.checklist?.english).toContain("cited lines");
    expect(JSON.stringify(result.checklist)).not.toContain("200–999");
  });

  it("assigns application-owned ids so distinct items with duplicate model ids survive", async () => {
    const result = await board([item(), item({ kind: "document", title: "Application form", detail: "Bring the application form." })]);
    expect(result.items.map(entry => entry.id)).toEqual(["s1", "s2"]);
    expect(result.items.map(entry => entry.kind)).toEqual(["fee", "document"]);
    expect(result.warnings).toEqual([]);
  });

  it("takes source title from the matched retrieved page, not model metadata", () => {
    expect(sanitizeItem({ raw: item(), evidence, sample: false, order: 3 }))
      .toMatchObject({ id: "s3", sourceTitle: "Retrieved fee table" });
  });

  it.each([Infinity, -Infinity, NaN, "0.9", undefined])("uses zero for invalid confidence %s", (confidence) => {
    expect(sanitizeItem({ raw: item({ confidence }), evidence, sample: false, order: 1 })?.confidence).toBe(0);
  });

  it("warns when only some proposed items pass the citation guard", async () => {
    const result = await board([item(), item({ title: "Invented fee", detail: "Rs. 999" })]);
    expect(result.items).toHaveLength(1);
    expect(result.warnings.join(" ")).toContain("1 proposed item");
    expect(result.traces.find(trace => trace.id === "settle")?.outcome).toBe("rejected");
  });

  it("distinguishes rejected-all from a clean empty proposal", async () => {
    const rejected = await board([null, item({ quote: "This was not found in the cited page at all." })]);
    expect(rejected.items).toEqual([]);
    expect(rejected.warnings.join(" ")).toContain("2 proposed items");
    const empty = await board([]);
    expect(empty.items).toEqual([]);
    expect(empty.warnings).toEqual([]);
  });

  it("replaces only the original weak item even when all model ids collide", async () => {
    const result = await board([item({ confidence: 0.2 }), item({ kind: "document", title: "Application form", detail: "Bring the application form." })],
      [item({ confidence: 0.95 })]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: "s1", confidence: 0.95, kind: "fee" });
    expect(result.items[1]).toMatchObject({ id: "s2", kind: "document" });
  });

  it("warns for citation-rejected retry items while preserving the original map", async () => {
    const result = await board([item({ confidence: 0.2 })], [item({ detail: "Rs. 999" })]);
    expect(result.items[0]?.confidence).toBe(0.2);
    expect(result.warnings.join(" ")).toContain("1 proposed item");
    expect(result.traces.find(trace => trace.id === "settle-retry")?.outcome).toBe("rejected");
  });

  it.each([item(), null])("labels capped proposals without pretending to validate overflow", async (overflow) => {
    const items = [...Array.from({ length: MAX_ITEMS }, () => item()), overflow];
    const result = await board(items);
    expect(result.items).toHaveLength(MAX_ITEMS);
    expect(result.warnings.join(" ")).toContain("1 additional proposed item");
    expect(result.traces.find(trace => trace.id === "settle")?.outcome).toBe("rejected");
    const report = await scoreEval(deps(items));
    expect(report.rows.every(row => row.found === null && row.error)).toBe(true);
  });

  it("labels retry truncation and identity rejection while keeping a middle card's original position", async () => {
    const result = await board([null, item({ title: "First" }), item({ confidence: 0.2 }), item({ title: "Last" })],
      [null, item({ title: "Other", confidence: 1 }), item({ confidence: 0.95 }),
        ...Array.from({ length: MAX_ITEMS }, () => item({ confidence: 0.7 }))]);
    expect(result.items.map(entry => [entry.id, entry.title, entry.order])).toEqual([
      ["s2", "First", 2], ["s3", "Renewal fee", 3], ["s4", "Last", 4],
    ]);
    expect(result.items[1]?.confidence).toBe(0.95);
    expect(result.warnings.join(" ")).toContain("additional proposed items");
    expect(result.traces.find(trace => trace.id === "settle-retry")?.outcome).toBe("rejected");
  });

  it("gives the retry checker the exact title and kind, but still rejects mismatched output", async () => {
    const dependency = deps([item({ confidence: 0.2 })], [item({ title: "Driving licence renewal fee", confidence: 0.95 })]);
    const fetch = dependency.fetch;
    let settleCount = 0;
    dependency.fetch = async (input, init) => {
      if (String(input).includes("/chat/completions")) {
        const body = JSON.parse(String(init?.body));
        if (body.messages[0].content.includes("settle conflicts between sources") && ++settleCount === 2) {
          expect(body.messages[0].content).toContain("Keep the exact title and kind");
          expect(body.messages[1].content).toContain(JSON.stringify({ title: "Renewal fee", kind: "fee" }));
        }
      }
      return fetch(input, init);
    };
    const result = (await collectPipeline("renew driving licence, Amritsar", dependency)).reduce(applyEvent, beginRun());
    expect(settleCount).toBe(2);
    expect(result.items[0]?.confidence).toBe(0.2);
    expect(result.traces.find(trace => trace.id === "settle-retry")?.outcome).toBe("rejected");
  });

  it("handles wire JSON overflow confidence as uncertain and rechecks it", async () => {
    const dependency = deps([item({ confidence: "OVERFLOW" })], [item({ confidence: 0.95 })]);
    const fetch = dependency.fetch;
    dependency.fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (!String(input).includes("/chat/completions")) return response;
      const payload = await response.json();
      payload.choices[0].message.content = payload.choices[0].message.content.replace('"OVERFLOW"', '1e309');
      return Response.json(payload);
    };
    const events = await collectPipeline("renew driving licence, Amritsar", dependency);
    const confidences = events.flatMap(event => event.type === "item" ? [event.item.confidence] : []);
    expect(confidences).toEqual([0, 0.95]);
    expect(JSON.parse(JSON.stringify(confidences))).toEqual(confidences);
  });

  it("uses the title of the matching snippet, not an earlier unrelated same-URL entry", () => {
    const earlier = { ...evidence[0], title: "Unrelated section", snippet: "Select your state to continue." };
    expect(sanitizeItem({ raw: item(), evidence: [earlier, ...evidence], sample: false, order: 1 })?.sourceTitle)
      .toBe("Retrieved fee table");
  });

  it.each(["overflow", "identity", "citation"])("isolates retry-only %s warnings and evaluation exclusion", async (failure) => {
    const retryItems = failure === "overflow" ? Array.from({ length: MAX_ITEMS + 1 }, () => item({ confidence: 0.95 }))
      : failure === "identity" ? [item({ kind: "document", confidence: 0.95 })] : [item({ detail: "Rs. 999" })];
    const dependency = deps([item({ confidence: 0.2 })], retryItems);
    const result = (await collectPipeline("renew driving licence, Amritsar", dependency)).reduce(applyEvent, beginRun());
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(failure === "overflow" ? "additional proposed item"
      : failure === "identity" ? "identity differed" : "failed the item or citation checks");
    expect(result.traces.find(trace => trace.id === "settle")?.outcome).toBe("received");
    expect(result.traces.find(trace => trace.id === "settle-retry"))
      .toMatchObject({ outcome: "rejected", promptTokens: 12, completionTokens: 8 });
    const originalFetch = dependency.fetch;
    let settles = 0;
    dependency.fetch = async (input, init) => {
      if (String(input).includes("/chat/completions")) {
        const body = JSON.parse(String(init?.body));
        const system: string = body.messages[0].content;
        if (system.includes("rewrite the search query")) {
          const task = body.messages[1].content.split("\nWeak item:")[0].replace(/^Task: /, "");
          return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ query: `${task} Renewal fee` }) } }] });
        }
        if (system.includes("settle conflicts between sources")) {
          const items = ++settles % 2 === 1 ? [item({ confidence: 0.2 })] : retryItems;
          return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }] });
        }
      }
      return originalFetch(input, init);
    };
    const report = await scoreEval(dependency);
    expect(report.rows.every(row => row.found === null && row.error)).toBe(true);
  });
});
