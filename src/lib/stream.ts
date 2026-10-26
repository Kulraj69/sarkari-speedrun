import { isRecord } from "@/lib/json";
import type { PipelineEvent } from "@/lib/types";

export async function readNdjson(
  response: Response,
  onEvent: (event: PipelineEvent) => void,
): Promise<void> {
  if (!response.ok) {
    let message = `The check failed (${response.status}).`;
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload) && typeof payload.error === "string") message = payload.error;
    } catch {
      message = `The check failed (${response.status}).`;
    }
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("The check returned an empty body.");

  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      throw new Error("The check stream sent an unreadable event.");
    }
    onEvent(parsed as unknown as PipelineEvent);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
}