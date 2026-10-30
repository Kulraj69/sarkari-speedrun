import { HTTP_STATUS } from "@/lib/config";
import { isRecord } from "@/lib/json";
import { isTokenCount } from "@/lib/models";

export class ProviderError extends Error {
  readonly status: number;
  readonly provider: string;

  constructor(provider: string, status: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.provider = provider;
  }
}

export interface ChatMessagePayload {
  role: "system" | "user";
  content: string;
}

export interface ChatResult {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  modelId: string;
  latencyMs: number;
}

export interface ChatRequest {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessagePayload[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  now: () => number;
}

function readContent(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new ProviderError("Nebius Token Factory", 0, "Nemotron returned no choices.");
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    throw new ProviderError("Nebius Token Factory", 0, "Nemotron returned an empty message.");
  }
  if (choice.finish_reason !== "stop") {
    throw new ProviderError("Nebius Token Factory", 0, "Nemotron did not return a completed answer.");
  }
  const message = choice.message;
  if ((message.role !== undefined && message.role !== "assistant") ||
      (message.refusal !== undefined && message.refusal !== null && message.refusal !== "") ||
      (message.tool_calls !== undefined && message.tool_calls !== null &&
        (!Array.isArray(message.tool_calls) || message.tool_calls.length > 0)) ||
      (message.function_call !== undefined && message.function_call !== null)) {
    throw new ProviderError("Nebius Token Factory", 0, "Nemotron returned a refusal or a non-answer message.");
  }
  const content = message.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content) && content.every((part) =>
    isRecord(part) && part.type === "text" && typeof part.text === "string")) {
    const text = content
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) return text;
  }
  throw new ProviderError("Nebius Token Factory", 0, "Nemotron returned no text.");
}

function readUsage(payload: unknown): { prompt: number | null; completion: number | null } {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return { prompt: null, completion: null };
  }
  const prompt = payload.usage.prompt_tokens;
  const completion = payload.usage.completion_tokens;
  return {
    prompt: isTokenCount(prompt) ? prompt : null,
    completion: isTokenCount(completion) ? completion : null,
  };
}

export async function chatComplete(request: ChatRequest): Promise<ChatResult> {
  const started = request.now();
  const url = `${request.baseUrl}/chat/completions`;
  let response: Response;
  try {
    response = await request.fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: request.messages,
        // Nemotron 3 thinks by default. Thinking used the whole token budget and left
        // the answer empty, so every step asks for the answer directly.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch {
    throw new ProviderError(
      "Nebius Token Factory",
      0,
      "Nemotron request failed before a verdict.",
    );
  }

  if (!response.ok) {
    if (response.status === HTTP_STATUS.unauthorized || response.status === HTTP_STATUS.forbidden) {
      throw new ProviderError(
        "Nebius Token Factory",
        response.status,
        "Nebius Token Factory rejected NEBIUS_API_KEY. Fix the key, or unset both keys to use sample fixtures.",
      );
    }
    throw new ProviderError(
      "Nebius Token Factory",
      response.status,
      `Token Factory returned ${response.status} for ${request.model}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderError("Nebius Token Factory", 0, "Nemotron response body could not be read as JSON.");
  }
  const latencyMs = Math.max(0, request.now() - started);
  const usage = readUsage(payload);
  return {
    content: readContent(payload),
    promptTokens: usage.prompt,
    completionTokens: usage.completion,
    modelId: request.model,
    latencyMs,
  };
}