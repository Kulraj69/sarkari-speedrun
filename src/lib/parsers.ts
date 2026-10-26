import { CHECKLIST_MAX_CHARS, MAX_ITEMS } from "@/lib/config";
import { trimReply } from "@/lib/format";
import { asString, extractJson, isRecord } from "@/lib/json";
import type { SubQuestion } from "@/lib/types";

export interface ParsedPlan {
  task: string | null;
  city: string | null;
  questions: Omit<SubQuestion, "id">[];
}

export function parsePlan(raw: string, maxQuestions: number): ParsedPlan {
  const parsed = extractJson(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed.questions)) {
    throw new Error("Nemotron Nano did not return sub-questions. Nothing was opened.");
  }
  const questions: Omit<SubQuestion, "id">[] = [];
  for (const item of parsed.questions) {
    if (!isRecord(item)) continue;
    const text = asString(item.text);
    if (!text) continue;
    questions.push({ text });
  }
  return {
    task: asString(parsed.task),
    city: asString(parsed.city),
    questions: questions.slice(0, maxQuestions),
  };
}

export function parseItemDrafts(raw: string): unknown[] {
  const parsed = extractJson(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new Error("Nemotron Super did not return items. Nothing was added to the map.");
  }
  return parsed.items.slice(0, MAX_ITEMS);
}

export interface ParsedChecklist {
  hindi: string;
  english: string;
}

export function parseChecklist(raw: string): ParsedChecklist {
  const parsed = extractJson(raw);
  if (!isRecord(parsed)) {
    throw new Error("Nemotron Nano did not return a checklist.");
  }
  const hindi = asString(parsed.hindi);
  const english = asString(parsed.english);
  if (!hindi || !english) throw new Error("Nemotron Nano returned an empty checklist.");
  return {
    hindi: trimReply(hindi, CHECKLIST_MAX_CHARS),
    english: trimReply(english, CHECKLIST_MAX_CHARS),
  };
}

export function parseRewrite(raw: string, fallback: string): string {
  try {
    const parsed = extractJson(raw);
    if (isRecord(parsed)) {
      const query = asString(parsed.query);
      if (query && query.length >= 8) return query.slice(0, 300);
    }
  } catch {
    return fallback;
  }
  return fallback;
}