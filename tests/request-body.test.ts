import { afterEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { createCheckResponse } from "@/lib/http";
import { readRequestJson, RequestBodyError } from "@/lib/request-body";
import { LiveLimiter } from "@/lib/rate-limit";
import type { PipelineDeps } from "@/lib/types";

const encoder = new TextEncoder();
function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new Error("Network disabled"); });
  const deps: PipelineDeps = { env: { ...readEnv({}), mode: "live" }, fetch,
    now: Date.now, sleep: async () => {}, present: false };
  deps.env.nebiusApiKey = "synthetic";
  deps.env.tavilyApiKey = "synthetic";
  const limiter = new LiveLimiter();
  const take = vi.spyOn(limiter, "take");
  return { deps, limiter, take, fetch };
}
function streamed(chunks: string[], options: { signal?: AbortSignal; close?: boolean; length?: string; cancel?: () => void | Promise<void> } = {}) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (options.close !== false) controller.close();
    },
    cancel: options.cancel,
  });
  return new Request("http://localhost/api/check", {
    method: "POST", body: stream, duplex: "half", signal: options.signal,
    headers: options.length ? { "Content-Length": options.length } : undefined,
  } as RequestInit);
}
afterEach(() => vi.useRealTimers());

describe("bounded request ingestion", () => {
  it.each([undefined, "1"])("bounds actual chunked bytes regardless of declared length %s", async (length) => {
    const { deps, limiter, fetch, take } = setup();
    const cancel = vi.fn();
    const response = await createCheckResponse(streamed(['{"text":"', "a".repeat(17_000)],
      { length, close: false, cancel }), deps, limiter);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(take).not.toHaveBeenCalled();
  });

  it("counts UTF-8 bytes, including ignored JSON properties", async () => {
    const { deps, limiter } = setup();
    const response = await createCheckResponse(streamed([JSON.stringify({ text: "hello", extra: "क".repeat(6000) })]), deps, limiter);
    expect(response.status).toBe(413);
  });

  it("rejects a task over the character limit before live quota consumption", async () => {
    const { deps, limiter, take, fetch } = setup();
    deps.env.mode = "live";
    deps.env.nebiusApiKey = "synthetic";
    deps.env.tavilyApiKey = "synthetic";
    const response = await createCheckResponse(streamed([JSON.stringify({ text: "a".repeat(2001) })]), deps, limiter);
    expect(response.status).toBe(400);
    expect(take).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("times out a stalled upload and cancels its reader", async () => {
    vi.useFakeTimers();
    const { deps, limiter, take } = setup();
    const cancel = vi.fn();
    const work = createCheckResponse(streamed([], { close: false, cancel }), deps, limiter);
    await vi.advanceTimersByTimeAsync(4001);
    expect((await work).status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(take).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not wait for a non-cooperative reader cancel", async () => {
    vi.useFakeTimers();
    const { deps, limiter } = setup();
    const work = createCheckResponse(streamed([], { close: false, cancel: () => new Promise(() => {}) }), deps, limiter);
    await vi.advanceTimersByTimeAsync(4001);
    expect((await work).status).toBe(408);
  });

  it("stops ingestion when the client disconnects", async () => {
    const { deps, limiter, fetch } = setup();
    const controller = new AbortController();
    const cancel = vi.fn();
    const work = createCheckResponse(streamed([], { close: false, cancel, signal: controller.signal }), deps, limiter);
    controller.abort();
    expect((await work).status).toBe(400);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves a normal split JSON cached request and clears timers", async () => {
    vi.useFakeTimers();
    const { deps, limiter, fetch } = setup();
    deps.env.mode = "mock";
    const response = await createCheckResponse(streamed(['{"text":"renew pass', 'port, Patiala"}']), deps, limiter);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the upload timer when another reader already owns the body", async () => {
    vi.useFakeTimers();
    const request = streamed(['{"text":"hello"}']);
    const reader = request.body!.getReader();
    const { deps, limiter, take } = setup();
    expect((await createCheckResponse(request, deps, limiter)).status).toBe(400);
    expect(take).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    reader.releaseLock();
  });

  it("does not trust an adapter error's status or diagnostic", async () => {
    const { deps, limiter, take } = setup();
    const body = new ReadableStream({ start(controller) {
      controller.error(new RequestBodyError(299, "Synthetic private adapter diagnostic"));
    } });
    const request = new Request("http://localhost/api/check", { method: "POST", body, duplex: "half" } as RequestInit);
    const response = await createCheckResponse(request, deps, limiter);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private adapter");
    expect(take).not.toHaveBeenCalled();
  });

  it("rejects an EOF cancellation race before quota consumption", async () => {
    const { deps, limiter, take, fetch } = setup();
    const controller = new AbortController();
    let read = 0;
    const request = streamed([], { signal: controller.signal });
    const reader = {
      async read() {
        if (read++ === 0) return { done: false, value: encoder.encode('{"text":"hello"}') };
        queueMicrotask(() => controller.abort());
        return { done: true, value: undefined };
      },
      cancel: vi.fn(async () => {}), releaseLock: vi.fn(),
    };
    vi.spyOn(request.body!, "getReader").mockReturnValue(reader as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>);
    expect((await createCheckResponse(request, deps, limiter)).status).toBe(400);
    expect(take).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sanitizes parent cancellation reasons and cancels ingestion", async () => {
    const { deps, limiter, take, fetch } = setup();
    const parent = new AbortController();
    deps.signal = parent.signal;
    const cancel = vi.fn();
    const result = createCheckResponse(streamed([], { close: false, cancel }), deps, limiter);
    parent.abort(new RequestBodyError(299, "Synthetic private reason"));
    const response = await result;
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private reason");
    expect(cancel).toHaveBeenCalledOnce();
    expect(take).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts exactly 16 KiB and rejects one byte more", async () => {
    for (const bytes of [16384, 16385]) {
      const text = JSON.stringify({ text: "hello", extra: "" });
      const raw = text.replace('"extra":""', '"extra":"' + "a".repeat(bytes - encoder.encode(text).length) + '"');
      const { deps, limiter } = setup();
      deps.env.mode = "mock";
      const response = await createCheckResponse(streamed([raw]), deps, limiter);
      expect(response.status).toBe(bytes === 16384 ? 200 : 413);
      await response.text();
    }
  });

  it("decodes UTF-8 characters split across byte chunks", async () => {
    const bytes = encoder.encode(JSON.stringify({ text: "परीक्षण" }));
    const body = new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } });
    const request = new Request("http://localhost/api/check", { method: "POST", body, duplex: "half" } as RequestInit);
    expect(await readRequestJson(request)).toEqual({ text: "परीक्षण" });
  });
});
