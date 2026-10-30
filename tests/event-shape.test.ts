import { describe, expect, it, vi } from "vitest";
import { readNdjson } from "@/lib/stream";
import type { PipelineEvent } from "@/lib/types";

const examples: PipelineEvent[] = [
  { type: "meta", mode: "live", sample: false, task: "renew passport", city: "Patiala", fixtureId: null },
  { type: "trace", trace: { id: "plan", step: "plan", title: "Plan", detail: "Synthetic", provider: "Nebius Token Factory", modelId: "test", modelLabel: "Test", latencyMs: 0, promptTokens: null, completionTokens: 1, estimatedUsd: null } },
  { type: "trace-outcome", id: "plan", outcome: "rejected" },
  { type: "plan", questions: [{ id: "q1", text: "Which documents?" }] },
  { type: "evidence", questionId: "q1", evidence: [{ title: "Example", url: "https://example.gov.in/", snippet: "Synthetic", score: 0.5 }] },
  { type: "item", item: { id: "one", kind: "step", order: 1, title: "Apply", detail: "Synthetic", quote: "Synthetic quotation", url: "https://example.gov.in/", sourceTitle: "Example", confidence: 0.5, recentChange: false, sample: false, basis: "live-evidence" } },
  { type: "checklist", checklist: { hindi: "हिन्दी", english: "English", sample: false } },
  { type: "warning", message: "Synthetic warning" },
  { type: "error", message: "Synthetic error" },
  { type: "done" },
];
const response = (event: unknown) => new Response(JSON.stringify(event) + "\n" +
  (event && typeof event === "object" && "type" in event && ["done", "error"].includes(String(event.type)) ? "" : '{"type":"done"}\n'));

const invalid: Array<[string, unknown]> = [
  ["unknown event", { type: "future-event" }],
  ["null item", { type: "item", item: null }],
  ["null trace", { type: "trace", trace: null }],
  ["object warning", { type: "warning", message: { private: "synthetic" } }],
  ["null question", { type: "plan", questions: [null] }],
  ["null evidence", { type: "evidence", questionId: "q1", evidence: [null] }],
];
for (const example of examples) {
  for (const key of Object.keys(example).filter((key) => key !== "type")) {
    const missing = { ...example } as Record<string, unknown>;
    delete missing[key];
    invalid.push([`${example.type} missing ${key}`, missing]);
  }
  const nestedKey = example.type === "item" ? "item" : example.type === "trace" ? "trace" : example.type === "checklist" ? "checklist" : null;
  if (nestedKey) {
    const nested = (example as unknown as Record<string, Record<string, unknown>>)[nestedKey];
    for (const key of Object.keys(nested)) {
      invalid.push([`${example.type}.${key} wrong type`, { ...example, [nestedKey]: { ...nested, [key]: {} } }]);
      const missing = { ...nested };
      delete missing[key];
      invalid.push([`${example.type}.${key} missing`, { ...example, [nestedKey]: missing }]);
    }
  }
}

for (const [index, key] of [[3, "questions"], [4, "evidence"]] as const) {
  const event = examples[index] as unknown as Record<string, unknown>;
  const entry = (event[key] as Array<Record<string, unknown>>)[0];
  for (const field of Object.keys(entry)) {
    const missing = { ...entry };
    delete missing[field];
    invalid.push([`${key}.${field} missing`, { ...event, [key]: [missing] }],
      [`${key}.${field} wrong type`, { ...event, [key]: [{ ...entry, [field]: {} }] }]);
  }
  invalid.push([`${key} not array`, { ...event, [key]: {} }]);
}
const testTrace = (examples[1] as Extract<PipelineEvent, { type: "trace" }>).trace;
const testItem = (examples[5] as Extract<PipelineEvent, { type: "item" }>).item;
for (const [field, values] of Object.entries({
  step: ["unknown"], provider: ["unknown"], outcome: ["unknown", null], questionId: [null, 7],
  latencyMs: [-1], estimatedUsd: [-1], promptTokens: [-1, 0.5, Number.MAX_SAFE_INTEGER + 1],
  completionTokens: [-1, 0.5, Number.MAX_SAFE_INTEGER + 1],
})) for (const value of values) invalid.push([`trace.${field} invalid ${value}`, { type: "trace", trace: { ...testTrace, [field]: value } }]);
for (const field of ["kind", "basis"]) invalid.push([`item.${field} invalid enum`, { type: "item", item: { ...testItem, [field]: "unknown" } }]);
invalid.push(["meta invalid mode", { ...examples[0], mode: "unknown" }],
  ["meta null note", { ...examples[0], note: null }],
  ["trace-outcome invalid enum", { type: "trace-outcome", id: "plan", outcome: "received" }],
  ...["__proto__", "constructor", "toString"].map((type): [string, unknown] => [`prototype type ${type}`, { type }]));

describe("browser event-shape boundary", () => {
  it.each(["order", "confidence", "score"])("rejects wire numeric overflow in %s", async (field) => {
    const event = field === "score"
      ? { type: "evidence", questionId: "q1", evidence: [{ title: "Test", url: "https://example.gov.in", snippet: "Synthetic", score: "OVERFLOW" }] }
      : { type: "item", item: { ...testItem, [field]: "OVERFLOW" } };
    const json = JSON.stringify(event).replace('"OVERFLOW"', '1e400');
    const receive = vi.fn();
    await expect(readNdjson(new Response(json + '\n{"type":"done"}'), receive)).rejects.toThrow("unreadable event");
    expect(receive).not.toHaveBeenCalled();
  });

  it.each(["latencyMs", "estimatedUsd", "promptTokens", "completionTokens"])("rejects wire numeric overflow in trace.%s", async (field) => {
    const json = JSON.stringify({ type: "trace", trace: { ...testTrace, [field]: "OVERFLOW" } }).replace('"OVERFLOW"', '1e400');
    const receive = vi.fn();
    await expect(readNdjson(new Response(json + '\n{"type":"done"}'), receive)).rejects.toThrow("unreadable event");
    expect(receive).not.toHaveBeenCalled();
  });

  it.each(examples)("accepts declared $type event", async (event) => {
    const receive = vi.fn();
    await readNdjson(response(event), receive);
    expect(receive.mock.calls[0][0]).toEqual(event);
  });

  it.each(invalid)("rejects %s before dispatch", async (_name, event) => {
    const receive = vi.fn();
    const body = response(event);
    await expect(readNdjson(body, receive)).rejects.toThrow("The check stream sent an unreadable event.");
    expect(receive).not.toHaveBeenCalled();
    expect(body.body?.locked).toBe(false);
  });

  it("accepts all optional trace/meta fields and additive unknown fields", async () => {
    for (const event of [
      { ...examples[0], note: "Synthetic note", future: true },
      { ...examples[1], trace: { ...(examples[1] as Extract<PipelineEvent, { type: "trace" }>).trace, questionId: "q1", outcome: "received" } },
    ]) await expect(readNdjson(response(event), vi.fn())).resolves.toBeUndefined();
  });
});
