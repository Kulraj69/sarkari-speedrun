import { ITEM_KINDS } from "@/lib/config";
import { isRecord } from "@/lib/json";
import type { PipelineEvent } from "@/lib/types";

type Guard = (value: unknown) => boolean;
const text: Guard = (value) => typeof value === "string";
const boolean: Guard = (value) => typeof value === "boolean";
const finite: Guard = (value) => typeof value === "number" && Number.isFinite(value);
const nonnegative: Guard = (value) => finite(value) && (value as number) >= 0;
const tokens: Guard = (value) => nonnegative(value) && Number.isSafeInteger(value);
const oneOf = (values: readonly string[]): Guard => (value) => typeof value === "string" && values.includes(value);
const nullable = (guard: Guard): Guard => (value) => value === null || guard(value);
const arrayOf = (guard: Guard): Guard => (value) => Array.isArray(value) && value.every(guard);
const object = (required: Record<string, Guard>, optional: Record<string, Guard> = {}): Guard => (value) =>
  isRecord(value) && Object.entries(required).every(([key, guard]) => Object.hasOwn(value, key) && guard(value[key])) &&
  Object.entries(optional).every(([key, guard]) => !Object.hasOwn(value, key) || guard(value[key]));

const question = object({ id: text, text });
const evidence = object({ title: text, url: text, snippet: text, score: finite });
const item = object({
  id: text, kind: oneOf(ITEM_KINDS), order: finite, title: text, detail: text,
  quote: text, url: text, sourceTitle: text, confidence: finite, recentChange: boolean,
  sample: boolean, basis: oneOf(["sample-fixture", "mock-empty", "live-evidence"]),
});
const trace = object({
  id: text, step: oneOf(["plan", "evidence", "settle", "rewrite", "checklist"]),
  title: text, detail: text, provider: oneOf(["Nebius Token Factory", "Tavily", "Sample fixture"]),
  modelId: nullable(text), modelLabel: text, latencyMs: nonnegative,
  promptTokens: nullable(tokens), completionTokens: nullable(tokens), estimatedUsd: nullable(nonnegative),
}, { questionId: text, outcome: oneOf(["received", "rejected"]) });

const events: Record<PipelineEvent["type"], Guard> = {
  meta: object({ mode: oneOf(["mock", "live"]), sample: boolean, task: text, city: text, fixtureId: nullable(text) }, { note: text }),
  trace: object({ trace }),
  "trace-outcome": object({ id: text, outcome: oneOf(["rejected"]) }),
  plan: object({ questions: arrayOf(question) }),
  evidence: object({ questionId: text, evidence: arrayOf(evidence) }),
  item: object({ item }),
  checklist: object({ checklist: object({ hindi: text, english: text, sample: boolean }) }),
  warning: object({ message: text }),
  error: object({ message: text }),
  done: object({}),
};

/** Wire shape only: not source authenticity, cross-event consistency or advice validation. */
export function isPipelineEvent(value: unknown): value is PipelineEvent {
  if (!isRecord(value) || typeof value.type !== "string" || !Object.hasOwn(events, value.type)) return false;
  return events[value.type as PipelineEvent["type"]](value);
}
