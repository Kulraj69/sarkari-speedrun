import {
  CHECK_MAX_TOKENS,
  CHECK_TEMPERATURE,
  CHECK_TIMEOUT_MS,
  CHECKLIST_MAX_TOKENS,
  CONFIDENCE_RETRY_BELOW,
  FALLBACK_STATUSES,
  NANO_CHECKLIST_TEMPERATURE,
  NANO_MODEL_LABEL,
  NANO_PLAN_MAX_TOKENS,
  NANO_PLAN_TEMPERATURE,
  NANO_REWRITE_TEMPERATURE,
  NANO_TIMEOUT_MS,
  PRESENTATION_DELAY_MS,
  PROVIDER_FIXTURE,
  PROVIDER_TAVILY,
  PROVIDER_TOKEN_FACTORY,
  REWRITE_MAX_TOKENS,
  TAVILY_CONCURRENCY,
  TAVILY_LABEL,
} from "@/lib/config";
import {
  EMPTY_CHECKLIST_EN,
  EMPTY_CHECKLIST_HI,
  EMPTY_PLAN_EN,
  EMPTY_PLAN_HI,
  NO_CITED_EN,
  NO_CITED_HI,
  RECORDED_TRACE_DETAIL,
} from "@/lib/copy";
import { readEnv, resolveMode } from "@/lib/env";
import { assertDemoFixtures, fixtureTraces, matchFixture } from "@/lib/fixtures";
import type { DemoTask } from "@/lib/fixtures";
import { errorMessage } from "@/lib/json";
import { estimateUsd, labelForModel } from "@/lib/models";
import { chatComplete } from "@/lib/nebius";
import type { ProviderError } from "@/lib/nebius";
import { parseChecklist, parseItemDrafts, parsePlan, parseRewrite } from "@/lib/parsers";
import { parseTaskLine } from "@/lib/parse-task";
import { checklistPrompts, planPrompts, rewritePrompts, settlePrompts } from "@/lib/prompts";
import { amountsAreCited, sanitizeItem } from "@/lib/sanitize";
import { gatherOfficialEvidence } from "@/lib/tavily";
import type {
  Checklist,
  Evidence,
  GuideItem,
  PipelineDeps,
  PipelineEvent,
  StepTrace,
  SubQuestion,
} from "@/lib/types";

export function createDefaultDeps(present: boolean): PipelineDeps {
  return {
    fetch: globalThis.fetch,
    env: readEnv(process.env),
    now: () => Date.now(),
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    present,
  };
}

async function maybePause(deps: PipelineDeps, ms: number): Promise<void> {
  if (!deps.present || ms <= 0) return;
  await deps.sleep(ms);
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  });
  await Promise.all(runners);
  return results;
}

function isAuth(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = (error as ProviderError).status;
  return status === 401 || status === 403;
}

function isFallbackStatus(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  return FALLBACK_STATUSES.includes((error as ProviderError).status);
}

function checklistFromTitles(items: readonly GuideItem[], empty: boolean): Checklist {
  if (items.length === 0) {
    return {
      hindi: empty ? EMPTY_PLAN_HI : NO_CITED_HI,
      english: empty ? EMPTY_PLAN_EN : NO_CITED_EN,
      sample: false,
    };
  }
  const lines = items.map((item, index) => `${index + 1}. ${item.title}`).join(" ");
  return {
    hindi: `उद्धृत पंक्तियों के शीर्षक: ${lines}`,
    english: `Checklist from the cited lines only. ${lines}`,
    sample: false,
  };
}

function weakest(items: readonly GuideItem[]): GuideItem | null {
  let picked: GuideItem | null = null;
  for (const item of items) {
    if (item.confidence >= CONFIDENCE_RETRY_BELOW) continue;
    if (!picked || item.confidence < picked.confidence) picked = item;
  }
  return picked;
}

async function* playDemo(task: DemoTask, deps: PipelineDeps): AsyncGenerator<PipelineEvent> {
  assertDemoFixtures([task]);
  await maybePause(deps, PRESENTATION_DELAY_MS.meta);
  yield {
    type: "meta",
    mode: "mock",
    sample: true,
    task: task.task,
    city: task.city,
    fixtureId: task.id,
  };
  const traces = fixtureTraces(task);
  const planTrace = traces.find((trace) => trace.step === "plan");
  if (planTrace) {
    await maybePause(deps, PRESENTATION_DELAY_MS.plan);
    yield { type: "trace", trace: planTrace };
  }
  yield { type: "plan", questions: task.questions };
  for (const question of task.questions) {
    const trace = traces.find((item) => item.step === "evidence" && item.questionId === question.id);
    if (trace) {
      await maybePause(deps, PRESENTATION_DELAY_MS.evidence);
      yield { type: "trace", trace };
    }
    yield { type: "evidence", questionId: question.id, evidence: [] };
  }
  const settle = traces.find((trace) => trace.step === "settle");
  if (settle) yield { type: "trace", trace: settle };
  for (const guideItem of task.items) {
    await maybePause(deps, PRESENTATION_DELAY_MS.item);
    yield { type: "item", item: guideItem };
  }
  const checklistTrace = traces.find((trace) => trace.step === "checklist");
  if (checklistTrace) {
    await maybePause(deps, PRESENTATION_DELAY_MS.checklist);
    yield { type: "trace", trace: checklistTrace };
  }
  yield {
    type: "checklist",
    checklist: { hindi: task.hindi, english: task.english, sample: true },
  };
  yield { type: "done" };
}

async function* runEmptyMock(text: string, deps: PipelineDeps): AsyncGenerator<PipelineEvent> {
  const parsed = parseTaskLine(text);
  await maybePause(deps, PRESENTATION_DELAY_MS.meta);
  yield {
    type: "meta",
    mode: "mock",
    sample: true,
    task: parsed.task,
    city: parsed.city,
    fixtureId: null,
  };
  const idle: StepTrace = {
    id: "plan",
    step: "plan",
    title: "Local read",
    detail: "Mock mode did not call Nemotron. This task is not one of the five cached demos.",
    provider: PROVIDER_FIXTURE,
    modelId: null,
    modelLabel: "Not called",
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
    estimatedUsd: null,
  };
  yield { type: "trace", trace: idle };
  yield { type: "plan", questions: [] };
  yield {
    type: "checklist",
    checklist: { hindi: EMPTY_CHECKLIST_HI, english: EMPTY_CHECKLIST_EN, sample: true },
  };
  yield { type: "done" };
}

async function completeWithFallback(
  deps: PipelineDeps,
  system: string,
  user: string,
): Promise<Awaited<ReturnType<typeof chatComplete>>> {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  try {
    return await chatComplete({
      fetch: deps.fetch,
      baseUrl: deps.env.nebiusBaseUrl,
      apiKey: deps.env.nebiusApiKey,
      model: deps.env.superModel,
      messages,
      temperature: CHECK_TEMPERATURE,
      maxTokens: CHECK_MAX_TOKENS,
      timeoutMs: CHECK_TIMEOUT_MS,
      now: deps.now,
    });
  } catch (error) {
    if (!isFallbackStatus(error)) throw error;
    return chatComplete({
      fetch: deps.fetch,
      baseUrl: deps.env.nebiusBaseUrl,
      apiKey: deps.env.nebiusApiKey,
      model: deps.env.checkFallbackModel,
      messages,
      temperature: CHECK_TEMPERATURE,
      maxTokens: CHECK_MAX_TOKENS,
      timeoutMs: CHECK_TIMEOUT_MS,
      now: deps.now,
    });
  }
}

function modelTrace(
  id: string,
  step: StepTrace["step"],
  title: string,
  detail: string,
  result: Awaited<ReturnType<typeof chatComplete>>,
  deps: PipelineDeps,
): StepTrace {
  return {
    id,
    step,
    title,
    detail,
    provider: PROVIDER_TOKEN_FACTORY,
    modelId: result.modelId,
    modelLabel: labelForModel(result.modelId, deps.env),
    latencyMs: result.latencyMs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedUsd: estimateUsd(result.modelId, result.promptTokens, result.completionTokens),
  };
}

function settleItems(
  drafts: unknown[],
  evidence: readonly Evidence[],
  startOrder: number,
): GuideItem[] {
  const items: GuideItem[] = [];
  drafts.forEach((raw, index) => {
    const settled = sanitizeItem({
      raw,
      evidence,
      sample: false,
      order: startOrder + index,
    });
    if (settled) items.push({ ...settled, id: settled.id || `s${startOrder + index}` });
  });
  return items;
}

async function* runLive(text: string, deps: PipelineDeps): AsyncGenerator<PipelineEvent> {
  const parsedLine = parseTaskLine(text);
  const planPrompt = planPrompts(text, deps.env.maxQuestions);
  const planned = await chatComplete({
    fetch: deps.fetch,
    baseUrl: deps.env.nebiusBaseUrl,
    apiKey: deps.env.nebiusApiKey,
    model: deps.env.nanoModel,
    messages: [
      { role: "system", content: planPrompt.system },
      { role: "user", content: planPrompt.user },
    ],
    temperature: NANO_PLAN_TEMPERATURE,
    maxTokens: NANO_PLAN_MAX_TOKENS,
    timeoutMs: NANO_TIMEOUT_MS,
    now: deps.now,
  });
  const plan = parsePlan(planned.content, deps.env.maxQuestions);
  const task = plan.task || parsedLine.task;
  const city = plan.city || parsedLine.city;
  const questions: SubQuestion[] = plan.questions.map((question, index) => ({
    id: `q${index + 1}`,
    text: question.text,
  }));

  yield { type: "meta", mode: "live", sample: false, task, city, fixtureId: null };
  yield {
    type: "trace",
    trace: modelTrace(
      "plan",
      "plan",
      "Plan sub-questions",
      `${NANO_MODEL_LABEL} on ${PROVIDER_TOKEN_FACTORY}.`,
      planned,
      deps,
    ),
  };
  yield { type: "plan", questions };

  if (questions.length === 0) {
    yield {
      type: "checklist",
      checklist: { hindi: EMPTY_PLAN_HI, english: EMPTY_PLAN_EN, sample: false },
    };
    yield { type: "done" };
    return;
  }

  const searches = await mapPool(questions, TAVILY_CONCURRENCY, async (question) => {
    try {
      return await gatherOfficialEvidence({
        fetch: deps.fetch,
        apiKey: deps.env.tavilyApiKey,
        query: `${task} ${city} ${question.text}`.trim(),
        maxResults: deps.env.tavilyMaxResults,
        now: deps.now,
      });
    } catch (error) {
      if (isAuth(error)) throw error;
      return { evidence: [] as Evidence[], latencyMs: 0, failed: errorMessage(error) };
    }
  });

  const evidenceByQuestion: Record<string, Evidence[]> = {};
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const result = searches[index];
    if (!question || !result) continue;
    evidenceByQuestion[question.id] = result.evidence;
    yield {
      type: "trace",
      trace: {
        id: `evidence-${question.id}`,
        step: "evidence",
        title: `Official pages · ${question.id}`,
        detail: result.failed
          ? `Tavily did not return pages (${result.failed}).`
          : `${TAVILY_LABEL} search and extract. ${result.evidence.length} official pages.`,
        provider: PROVIDER_TAVILY,
        modelId: null,
        modelLabel: TAVILY_LABEL,
        latencyMs: result.latencyMs,
        promptTokens: null,
        completionTokens: null,
        estimatedUsd: null,
        questionId: question.id,
      },
    };
    yield { type: "evidence", questionId: question.id, evidence: result.evidence };
  }

  const evidence = Object.values(evidenceByQuestion).flat();
  const settlePrompt = settlePrompts(task, city, questions, evidenceByQuestion);
  const judged = await completeWithFallback(deps, settlePrompt.system, settlePrompt.user);
  let items = settleItems(parseItemDrafts(judged.content), evidence, 1);
  yield {
    type: "trace",
    trace: modelTrace(
      "settle",
      "settle",
      "Settle the pages",
      `${labelForModel(judged.modelId, deps.env)} on ${PROVIDER_TOKEN_FACTORY}. Official pages outrank other hosts. A newer quoted line outranks an older one.`,
      judged,
      deps,
    ),
  };
  for (const guideItem of items) yield { type: "item", item: guideItem };

  const weak = weakest(items);
  if (weak) {
    try {
      const rewritePrompt = rewritePrompts(`${task}, ${city}`, weak.title);
      const rewritten = await chatComplete({
        fetch: deps.fetch,
        baseUrl: deps.env.nebiusBaseUrl,
        apiKey: deps.env.nebiusApiKey,
        model: deps.env.nanoModel,
        messages: [
          { role: "system", content: rewritePrompt.system },
          { role: "user", content: rewritePrompt.user },
        ],
        temperature: NANO_REWRITE_TEMPERATURE,
        maxTokens: REWRITE_MAX_TOKENS,
        timeoutMs: NANO_TIMEOUT_MS,
        now: deps.now,
      });
      const query = parseRewrite(rewritten.content, `${task} ${city} ${weak.title}`);
      yield {
        type: "trace",
        trace: modelTrace(
          "rewrite",
          "rewrite",
          `Rewrite query · ${weak.id}`,
          `Confidence ${weak.confidence.toFixed(2)} is under ${CONFIDENCE_RETRY_BELOW}. Nano rewrote the search once.`,
          rewritten,
          deps,
        ),
      };
      const again = await gatherOfficialEvidence({
        fetch: deps.fetch,
        apiKey: deps.env.tavilyApiKey,
        query,
        maxResults: deps.env.tavilyMaxResults,
        now: deps.now,
      });
      yield {
        type: "trace",
        trace: {
          id: "evidence-retry",
          step: "evidence",
          title: "Official pages · retry",
          detail: `${TAVILY_LABEL} search and extract. ${again.evidence.length} official pages.`,
          provider: PROVIDER_TAVILY,
          modelId: null,
          modelLabel: TAVILY_LABEL,
          latencyMs: again.latencyMs,
          promptTokens: null,
          completionTokens: null,
          estimatedUsd: null,
        },
      };
      const retryQuestion: SubQuestion = { id: "retry", text: query };
      const retryPrompt = settlePrompts(task, city, [retryQuestion], { retry: again.evidence });
      const rejudged = await completeWithFallback(deps, retryPrompt.system, retryPrompt.user);
      const replacements = settleItems(parseItemDrafts(rejudged.content), again.evidence, weak.order);
      const better = [...replacements].sort((a, b) => b.confidence - a.confidence)[0];
      yield {
        type: "trace",
        trace: modelTrace(
          "settle-retry",
          "settle",
          "Settle again",
          `${labelForModel(rejudged.modelId, deps.env)} checked the rewritten query once.`,
          rejudged,
          deps,
        ),
      };
      if (better && better.confidence > weak.confidence) {
        const replaced = { ...better, id: weak.id, order: weak.order };
        items = items.map((item) => (item.id === weak.id ? replaced : item));
        yield { type: "item", item: replaced };
      }
    } catch (error) {
      if (isAuth(error)) throw error;
    }
  }

  const quotes = items.map((item) => item.quote);
  let checklist = checklistFromTitles(items, false);
  let checklistResult: Awaited<ReturnType<typeof chatComplete>> | null = null;
  if (items.length > 0) {
    try {
      const checklistPrompt = checklistPrompts(task, city, items);
      checklistResult = await chatComplete({
        fetch: deps.fetch,
        baseUrl: deps.env.nebiusBaseUrl,
        apiKey: deps.env.nebiusApiKey,
        model: deps.env.nanoModel,
        messages: [
          { role: "system", content: checklistPrompt.system },
          { role: "user", content: checklistPrompt.user },
        ],
        temperature: NANO_CHECKLIST_TEMPERATURE,
        maxTokens: CHECKLIST_MAX_TOKENS,
        timeoutMs: NANO_TIMEOUT_MS,
        now: deps.now,
      });
      const parsed = parseChecklist(checklistResult.content);
      if (amountsAreCited(`${parsed.english} ${parsed.hindi}`, quotes)) {
        checklist = { ...parsed, sample: false };
      }
    } catch (error) {
      if (isAuth(error)) throw error;
    }
  }

  if (checklistResult) {
    yield {
      type: "trace",
      trace: modelTrace(
        "checklist",
        "checklist",
        "Hindi and English checklist",
        `${labelForModel(checklistResult.modelId, deps.env)} on ${PROVIDER_TOKEN_FACTORY}.`,
        checklistResult,
        deps,
      ),
    };
  }
  yield { type: "checklist", checklist };
  yield { type: "done" };
}

export async function* runPipeline(
  text: string,
  deps: PipelineDeps = createDefaultDeps(false),
): AsyncGenerator<PipelineEvent> {
  const trimmed = text.trim();
  if (!trimmed) {
    yield { type: "error", message: "Type a government task and a city." };
    return;
  }
  if (trimmed.length > deps.env.maxInputChars) {
    yield {
      type: "error",
      message: `That line is over ${deps.env.maxInputChars.toLocaleString("en-US")} characters.`,
    };
    return;
  }

  let mode: "mock" | "live";
  try {
    mode = resolveMode(deps.env);
  } catch (error) {
    yield { type: "error", message: errorMessage(error) };
    return;
  }

  try {
    if (mode === "mock") {
      const fixture = matchFixture(trimmed);
      if (fixture) {
        yield* playDemo(fixture, deps);
        return;
      }
      yield* runEmptyMock(trimmed, deps);
      return;
    }
    yield* runLive(trimmed, deps);
  } catch (error) {
    yield { type: "error", message: errorMessage(error) };
  }
}

export async function collectPipeline(text: string, deps: PipelineDeps): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  for await (const event of runPipeline(text, deps)) events.push(event);
  return events;
}

export const RECORDED_DETAIL = RECORDED_TRACE_DETAIL;