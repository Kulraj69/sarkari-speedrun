import {
  NANO_INPUT_USD_PER_MILLION,
  NANO_MODEL_ID,
  NANO_MODEL_LABEL,
  NANO_OUTPUT_USD_PER_MILLION,
  SUPER_INPUT_USD_PER_MILLION,
  SUPER_MODEL_ID,
  SUPER_MODEL_LABEL,
  SUPER_OUTPUT_USD_PER_MILLION,
  ULTRA_INPUT_USD_PER_MILLION,
  ULTRA_MODEL_ID,
  ULTRA_MODEL_LABEL,
  ULTRA_OUTPUT_USD_PER_MILLION,
} from "@/lib/config";
import type { ModelPrice, ReceiptsEnv } from "@/lib/types";

const CATALOG: readonly ModelPrice[] = [
  {
    id: NANO_MODEL_ID,
    label: NANO_MODEL_LABEL,
    inputPerMillionUsd: NANO_INPUT_USD_PER_MILLION,
    outputPerMillionUsd: NANO_OUTPUT_USD_PER_MILLION,
  },
  {
    id: SUPER_MODEL_ID,
    label: SUPER_MODEL_LABEL,
    inputPerMillionUsd: SUPER_INPUT_USD_PER_MILLION,
    outputPerMillionUsd: SUPER_OUTPUT_USD_PER_MILLION,
  },
  {
    id: ULTRA_MODEL_ID,
    label: ULTRA_MODEL_LABEL,
    inputPerMillionUsd: ULTRA_INPUT_USD_PER_MILLION,
    outputPerMillionUsd: ULTRA_OUTPUT_USD_PER_MILLION,
  },
];

export function priceForModel(modelId: string): ModelPrice | null {
  return CATALOG.find((model) => model.id === modelId) ?? null;
}

export function labelForModel(modelId: string, env: ReceiptsEnv): string {
  void env;
  return priceForModel(modelId)?.label ?? modelId;
}

export function estimateUsd(
  modelId: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (!isTokenCount(promptTokens) || !isTokenCount(completionTokens)) return null;
  const price = priceForModel(modelId);
  if (!price) return null;
  const million = 1_000_000;
  return (
    (promptTokens * price.inputPerMillionUsd + completionTokens * price.outputPerMillionUsd) / million
  );
}

export function isTokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}