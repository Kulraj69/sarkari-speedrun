import {
  DEFAULT_NEBIUS_BASE_URL,
  MAX_INPUT_CHARS,
  MAX_QUESTIONS,
  NANO_MODEL_ID,
  SUPER_MODEL_ID,
  TAVILY_MAX_RESULTS,
  ULTRA_MODEL_ID,
} from "@/lib/config";
import type { EnvMode, HealthReport, ReceiptsEnv, RunMode } from "@/lib/types";

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseMode(value: string): EnvMode {
  if (value === "mock" || value === "live" || value === "auto") return value;
  return "auto";
}

export function readEnv(source: Record<string, string | undefined> = process.env): ReceiptsEnv {
  const base = clean(source.NEBIUS_BASE_URL) || DEFAULT_NEBIUS_BASE_URL;
  return {
    mode: parseMode(clean(source.RECEIPTS_MODE).toLowerCase() || "auto"),
    nebiusApiKey: clean(source.NEBIUS_API_KEY),
    tavilyApiKey: clean(source.TAVILY_API_KEY),
    nebiusBaseUrl: base.replace(/\/+$/, ""),
    nanoModel: clean(source.NEBIUS_NANO_MODEL) || NANO_MODEL_ID,
    superModel: clean(source.NEBIUS_SUPER_MODEL) || SUPER_MODEL_ID,
    checkFallbackModel: clean(source.NEBIUS_CHECK_FALLBACK_MODEL) || clean(source.NEBIUS_ULTRA_MODEL) || ULTRA_MODEL_ID,
    maxInputChars: MAX_INPUT_CHARS,
    maxQuestions: MAX_QUESTIONS,
    tavilyMaxResults: TAVILY_MAX_RESULTS,
  };
}

export function resolveMode(env: ReceiptsEnv): RunMode {
  const hasKeys = Boolean(env.nebiusApiKey && env.tavilyApiKey);
  if (env.mode === "mock") return "mock";
  if (env.mode === "live") {
    if (!hasKeys) {
      throw new Error(
        "RECEIPTS_MODE=live needs both NEBIUS_API_KEY and TAVILY_API_KEY. Unset the mode to run the cached demos.",
      );
    }
    return "live";
  }
  return hasKeys ? "live" : "mock";
}

export function describeRuntime(env: ReceiptsEnv): HealthReport {
  const base = {
    ok: true,
    nanoModel: env.nanoModel,
    superModel: env.superModel,
    checkFallbackModel: env.checkFallbackModel,
    hasNebiusKey: Boolean(env.nebiusApiKey),
    hasTavilyKey: Boolean(env.tavilyApiKey),
  };
  try {
    const mode = resolveMode(env);
    return {
      ...base,
      mode,
      message:
        mode === "mock"
          ? "Mock mode is on. Cached demos only — no live search."
          : "Live mode. Nemotron on Token Factory and Tavily will run.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mode is misconfigured.";
    return { ...base, ok: false, mode: "misconfigured", message };
  }
}