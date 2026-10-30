import { describe, expect, it, vi } from "vitest";
import { readNdjson, STREAM_TIMEOUT_MS, MAX_LINE_CHARS, MAX_STREAM_BYTES } from "@/lib/stream";
import { createCheckResponse } from "@/lib/http";
import { readEnv } from "@/lib/env";
import { DEMO_TASKS } from "@/lib/fixtures";

const encode = (text: string) => new TextEncoder().encode(text);
const wire = (text: string) => new Response(text);

describe("browser stream lifecycle", () => {
  it("stops dispatch within a chunk when a consumer aborts", async () => {
    const controller = new AbortController();
    const response = wire('{"type":"warning","message":"first"}\n{"type":"warning","message":"second"}\n{"type":"done"}\n');
    const receive = vi.fn(() => controller.abort(new Error("consumer stopped")));
    await expect(readNdjson(response, receive, controller.signal)).rejects.toThrow("consumer stopped");
    expect(receive).toHaveBeenCalledTimes(1);
    expect(response.body?.locked).toBe(false);
  });

  it.each(["done", "error"])("holds %s until EOF and rejects later read failure", async (type) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(new ReadableStream({ start(c) { controller = c; } }));
    const receive = vi.fn();
    const result = readNdjson(response, receive);
    const rejection = expect(result).rejects.toThrow("read failed");
    controller.enqueue(encode(JSON.stringify({ type, message: "Synthetic" }) + "\n"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(receive).not.toHaveBeenCalled();
    controller.error(new Error("read failed"));
    await rejection;
    expect(receive).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });

  it("rejects incomplete UTF-8 at actual EOF after done", async () => {
    const response = new Response(new Uint8Array([...encode('{"type":"done"}\n'), 0xe0, 0xa4]));
    const receive = vi.fn();
    await expect(readNdjson(response, receive)).rejects.toThrow("unreadable event");
    expect(receive).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });

  it.each(["throw", "reject", "stall"])("does not wait for a %s cancel hook", async (mode) => {
    const response = new Response(new ReadableStream({
      start(c) { c.enqueue(encode("invalid\n")); },
      cancel() {
        if (mode === "throw") throw new Error("cancel failed");
        if (mode === "reject") return Promise.reject(new Error("cancel failed"));
        return new Promise(() => {});
      },
    }));
    await expect(readNdjson(response, vi.fn())).rejects.toThrow("unreadable event");
    expect(response.body?.locked).toBe(false);
  });

  it("releases when terminal callback throws", async () => {
    const response = wire('{"type":"done"}');
    await expect(readNdjson(response, () => { throw new Error("consumer failed"); })).rejects.toThrow("consumer failed");
    expect(response.body?.locked).toBe(false);
  });

  it.each([200, 400])("bounds stalled reads including HTTP %s", async (status) => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const response = new Response(new ReadableStream({
        start(c) { if (status === 200) c.enqueue(encode('{"type":"done"}\n')); }, cancel,
      }), { status });
      const receive = vi.fn();
      const rejected = expect(readNdjson(response, receive)).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(STREAM_TIMEOUT_MS);
      await rejected;
      expect(receive).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(response.body?.locked).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("honors a caller abort and cancels the body", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const rejected = expect(readNdjson(response, vi.fn(), controller.signal)).rejects.toThrow("caller stopped");
    controller.abort(new Error("caller stopped"));
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.body?.locked).toBe(false);
  });

  it.each([false, true])("bounds oversized line, newline=%s", async (newline) => {
    let sent = 0;
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ pull(c) {
      const size = 1024;
      c.enqueue(encode(" ".repeat(size) + (newline && sent === MAX_LINE_CHARS ? "\n" : "")));
      sent += size;
    }, cancel }));
    await expect(readNdjson(response, vi.fn())).rejects.toThrow("size limit");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.body?.locked).toBe(false);
  });

  it("bounds the total stream even with short empty lines", async () => {
    const response = wire("\n".repeat(MAX_STREAM_BYTES + 1));
    await expect(readNdjson(response, vi.fn())).rejects.toThrow("size limit");
  });

  it.each([[400, '{"error":"Send JSON with a text field."}', "Send JSON with a text field."],
    [500, "synthetic private detail", "The check failed (500)."]] as const)("preserves safe HTTP %s diagnostics", async (status, body, message) => {
    const response = new Response(body, { status });
    await expect(readNdjson(response, vi.fn())).rejects.toThrow(message);
    expect(response.body?.locked).toBe(false);
  });

  it("bounds error JSON bytes", async () => {
    await expect(readNdjson(new Response(" ".repeat(16385), { status: 400 }), vi.fn())).rejects.toThrow("size limit");
  });

  it("releases the reader after normal completion", async () => {
    const response = wire('{"type":"done"}\n');
    const receive = vi.fn();
    await readNdjson(response, receive);
    expect(receive).toHaveBeenCalledExactlyOnceWith({ type: "done" });
    expect(response.body?.locked).toBe(false);
  });

  it.each(["", "\n", '{"type":"warning","message":"partial"}\n'])("rejects missing terminal event: %j", async (text) => {
    await expect(readNdjson(wire(text), vi.fn())).rejects.toThrow("stopped before completion");
  });

  it.each(['{"type":"done"}\n{"type":"done"}', '{"type":"done"}\n{"type":"warning","message":"late"}', '{"type":"error","message":"failed"}\n{"type":"done"}'])("rejects events after terminal: %s", async (text) => {
    const receive = vi.fn();
    await expect(readNdjson(wire(text), receive)).rejects.toThrow("after completion");
    expect(receive).not.toHaveBeenCalledWith({ type: "done" });
  });

  it("accepts an error-only terminal response", async () => {
    const receive = vi.fn();
    await readNdjson(wire('{"type":"error","message":"Synthetic failure"}'), receive);
    expect(receive).toHaveBeenCalledExactlyOnceWith({ type: "error", message: "Synthetic failure" });
  });

  it("cancels without exposing parser details and releases on invalid JSON", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(encode("synthetic-private-marker\n")); }, cancel,
    }));
    await expect(readNdjson(response, vi.fn())).rejects.toThrow(/^The check stream sent an unreadable event\.$/);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.body?.locked).toBe(false);
  });

  it("cancels and releases when the consumer throws", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(encode('{"type":"warning","message":"test"}\n')); }, cancel,
    }));
    await expect(readNdjson(response, () => { throw new Error("consumer failed"); })).rejects.toThrow("consumer failed");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(response.body?.locked).toBe(false);
  });

  it.each([new Uint8Array([0xff]), new Uint8Array([0xe0, 0xa4])])("rejects malformed or truncated UTF-8", async (bytes) => {
    const text = encode('{"type":"warning","message":"');
    const tail = encode('"}\n{"type":"done"}\n');
    const body = new Uint8Array([...text, ...bytes, ...tail]);
    await expect(readNdjson(new Response(body), vi.fn())).rejects.toThrow("unreadable event");
  });

  it("keeps split multibyte Hindi and a terminal line without newline", async () => {
    const bytes = encode('{"type":"warning","message":"हिन्दी"}\r\n\n{"type":"done"}');
    const response = new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } }));
    const receive = vi.fn();
    await readNdjson(response, receive);
    expect(receive.mock.calls.map(([event]) => event)).toEqual([
      { type: "warning", message: "हिन्दी" }, { type: "done" },
    ]);
  });

  it.each([...DEMO_TASKS.map((task) => task.text), "renew arms licence, Jaipur", ""])("accepts actual cached HTTP streams: %s", async (text) => {
    const response = await createCheckResponse(new Request("http://localhost/api/check", {
      method: "POST", body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" },
    }), { env: readEnv({ RECEIPTS_MODE: "mock" }), fetch: async () => { throw new Error("Network forbidden"); },
      now: () => 0, sleep: async () => {}, present: false });
    const receive = vi.fn();
    await readNdjson(response, receive);
    expect(receive.mock.calls.at(-1)?.[0].type).toBe(text ? "done" : "error");
    expect(response.body?.locked).toBe(false);
  });
});
