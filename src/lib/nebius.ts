import { HTTP_STATUS } from "@/lib/config";
import { isRecord } from "@/lib/json";

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
  const content = choice.message.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (isRecord(part) && typeof part.text === "string") return part.text;
        return "";
      })
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
    prompt: typeof prompt === "number" ? prompt : null,
    completion: typeof completion === "number" ? completion : null,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    throw new ProviderError(
      "Nebius Token Factory",
      0,
      `Nemotron request failed before a verdict (${message}).`,
    );
  }

  const latencyMs = Math.max(0, request.now() - started);
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

  const payload: unknown = await response.json();
  const usage = readUsage(payload);
  return {
    content: readContent(payload),
    promptTokens: usage.prompt,
    completionTokens: usage.completion,
    modelId: request.model,
    latencyMs,
  };
}