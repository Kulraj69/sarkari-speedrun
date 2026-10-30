import { isRecord } from "@/lib/json";
import { isPipelineEvent } from "@/lib/event-shape";
import { abortable } from "@/lib/cancellation";
import type { PipelineEvent } from "@/lib/types";

export const STREAM_TIMEOUT_MS = 65_000;
export const MAX_STREAM_BYTES = 2 * 1024 * 1024;
export const MAX_LINE_CHARS = 256 * 1024;

export async function readNdjson(
  response: Response,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The check returned an empty body.");

  const lifetime = new AbortController();
  const timer = setTimeout(() => lifetime.abort(new Error("The check stream timed out before completion.")), STREAM_TIMEOUT_MS);
  const readSignal = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let bytes = 0;
  let terminal: PipelineEvent | null = null;
  const unreadable = "The check stream sent an unreadable event.";

  const decode = (value?: Uint8Array, stream = false): string => {
    try {
      return decoder.decode(value, { stream });
    } catch {
      throw new Error(unreadable);
    }
  };

  const consume = (line: string): void => {
    readSignal.throwIfAborted();
    if (line.length > MAX_LINE_CHARS) throw new Error("The check stream exceeded its size limit.");
    const trimmed = line.trim();
    if (!trimmed) return;
    if (terminal) throw new Error("The check stream sent an event after completion.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(unreadable);
    }
    if (!isPipelineEvent(parsed)) {
      throw new Error(unreadable);
    }
    if (parsed.type === "done" || parsed.type === "error") {
      // Do not show success until EOF confirms no trailing data or read failure.
      terminal = parsed;
    } else {
      onEvent(parsed);
    }
  };

  try {
    while (true) {
      readSignal.throwIfAborted();
      const { value, done } = await abortable(reader.read(), readSignal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > (response.ok ? MAX_STREAM_BYTES : 16 * 1024)) throw new Error("The check stream exceeded its size limit.");
      buffer += decode(value, true);
      if (!response.ok) continue;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (buffer.length > MAX_LINE_CHARS) throw new Error("The check stream exceeded its size limit.");
    }

    buffer += decode();
    if (!response.ok) {
      let message = `The check failed (${response.status}).`;
      try {
        const payload: unknown = JSON.parse(buffer);
        if (isRecord(payload) && typeof payload.error === "string") message = payload.error;
      } catch {
        // Keep fixed diagnostics instead of displaying parser output.
      }
      throw new Error(message);
    }
    if (buffer.trim()) consume(buffer);
    if (!terminal) throw new Error("The check stream stopped before completion.");
    readSignal.throwIfAborted();
    onEvent(terminal);
  } catch (error) {
    // A faulty underlying cancel hook must not hide the original error or hang cleanup.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}