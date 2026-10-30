import { abortable } from "@/lib/cancellation";

export const REQUEST_BODY_MAX_BYTES = 16 * 1024;
export const REQUEST_BODY_TIMEOUT_MS = 4_000;

export class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "RequestBodyError";
  }
}

/** Bound actual bytes, not the caller's Content-Length header. */
export async function readRequestJson(request: Request, parentSignal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeoutError = new RequestBodyError(408, "Request body took too long. Try again.");
  const sizeError = new RequestBodyError(413, "Request body must be at most 16 KiB.");
  const timer = setTimeout(() => controller.abort(timeoutError), REQUEST_BODY_TIMEOUT_MS);
  const signals = [request.signal, controller.signal];
  if (parentSignal) signals.push(parentSignal);
  const signal = AbortSignal.any(signals);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let complete = false;
  try {
    reader = request.body?.getReader();
    signal.throwIfAborted();
    if (!reader) throw new Error("Missing body");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    while (true) {
      signal.throwIfAborted();
      const chunk = await abortable(reader.read(), signal);
      signal.throwIfAborted();
      if (chunk.done) {
        complete = true;
        break;
      }
      bytes += chunk.value.byteLength;
      if (bytes > REQUEST_BODY_MAX_BYTES) {
        throw sizeError;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error === timeoutError || error === sizeError) throw error;
    throw new RequestBodyError(400, "Send JSON with a text field.");
  } finally {
    clearTimeout(timer);
    if (reader) {
      // Cleanup must not extend the response deadline if an underlying source stalls.
      if (!complete) void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
