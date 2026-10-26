import type { ITEM_KINDS } from "@/lib/config";

export type ItemKind = (typeof ITEM_KINDS)[number];

export type RunMode = "mock" | "live";

export type EnvMode = "auto" | RunMode;

export type ItemBasis = "sample-fixture" | "mock-empty" | "live-evidence";

export type ProviderName = "Nebius Token Factory" | "Tavily" | "Sample fixture";

export type StepName = "plan" | "evidence" | "settle" | "rewrite" | "checklist";

export interface ReceiptsEnv {
  mode: EnvMode;
  nebiusApiKey: string;
  tavilyApiKey: string;
  nebiusBaseUrl: string;
  nanoModel: string;
  superModel: string;
  checkFallbackModel: string;
  maxInputChars: number;
  maxQuestions: number;
  tavilyMaxResults: number;
}

export interface ModelPrice {
  id: string;
  label: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface SubQuestion {
  id: string;
  text: string;
}

export interface Evidence {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface GuideItem {
  id: string;
  kind: ItemKind;
  order: number;
  title: string;
  detail: string;
  quote: string;
  url: string;
  sourceTitle: string;
  confidence: number;
  recentChange: boolean;
  sample: boolean;
  basis: ItemBasis;
}

export interface Checklist {
  hindi: string;
  english: string;
  sample: boolean;
}

export interface StepTrace {
  id: string;
  step: StepName;
  title: string;
  detail: string;
  provider: ProviderName;
  modelId: string | null;
  modelLabel: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedUsd: number | null;
  questionId?: string;
}

export interface MetaEvent {
  type: "meta";
  mode: RunMode;
  sample: boolean;
  task: string;
  city: string;
  fixtureId: string | null;
}

export interface TraceEvent {
  type: "trace";
  trace: StepTrace;
}

export interface PlanEvent {
  type: "plan";
  questions: SubQuestion[];
}

export interface EvidenceEvent {
  type: "evidence";
  questionId: string;
  evidence: Evidence[];
}

export interface ItemEvent {
  type: "item";
  item: GuideItem;
}

export interface ChecklistEvent {
  type: "checklist";
  checklist: Checklist;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface DoneEvent {
  type: "done";
}

export type PipelineEvent =
  | MetaEvent
  | TraceEvent
  | PlanEvent
  | EvidenceEvent
  | ItemEvent
  | ChecklistEvent
  | ErrorEvent
  | DoneEvent;

export interface PipelineDeps {
  fetch: typeof fetch;
  env: ReceiptsEnv;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  present: boolean;
}

export interface HealthReport {
  ok: boolean;
  mode: RunMode | "misconfigured";
  nanoModel: string;
  superModel: string;
  checkFallbackModel: string;
  hasNebiusKey: boolean;
  hasTavilyKey: boolean;
  message: string | null;
}

export type BoardStatus = "idle" | "running" | "done" | "error";

export interface BoardState {
  status: BoardStatus;
  mode: RunMode | null;
  sample: boolean;
  task: string;
  city: string;
  fixtureId: string | null;
  questions: SubQuestion[];
  evidenceByQuestion: Record<string, Evidence[]>;
  items: GuideItem[];
  checklist: Checklist | null;
  traces: StepTrace[];
  error: string | null;
}