import { afterEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";
import { createCheckResponse } from "@/lib/http";
import { collectPipeline } from "@/lib/pipeline";
import { chatComplete } from "@/lib/nebius";
import { searchTavily } from "@/lib/tavily";
import type { PipelineDeps } from "@/lib/types";

function deps(fetchImpl: typeof fetch, extra: Partial<PipelineDeps> = {}): PipelineDeps {
  const env = readEnv({});
  env.mode = "live";
  // Non-credential sentinel; all transports are injected and never use the network.
  env.nebiusApiKey = "synthetic";
  env.tavilyApiKey = "synthetic";
  return { env, fetch: fetchImpl, now: Date.now, sleep: async () => {}, present: false, ...extra };
}
const never = () => new Promise<Response>(() => {});
const request = (signal?: AbortSignal) => new Request("http://localhost/api/check", {
  method: "POST", body: JSON.stringify({ text: "renew passport, Patiala" }), signal,
});
afterEach(() => vi.useRealTimers());

describe("run lifetime", () => {
  it("clears its deadline after normal cached completion", async () => {
    vi.useFakeTimers();
    const pipelineDeps = deps(vi.fn<typeof fetch>(never));
    pipelineDeps.env.mode = "mock";
    expect((await collectPipeline("renew passport, Patiala", pipelineDeps)).at(-1)?.type).toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels concurrent searches without starting queued questions or retries", async () => {
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes("chat/completions")) {
        return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          questions: ["Fee?", "Office?", "Documents?", "Timeline?"].map(text => ({ text })),
        }) } }] });
      }
      signals.push(init!.signal!);
      return never();
    });
    const result = collectPipeline("renew passport, Patiala", deps(fetchImpl, { signal: controller.signal }));
    await vi.waitFor(() => expect(signals).toHaveLength(3));
    controller.abort();
    const events = await result;
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(events.at(-1)?.type).toBe("error");
    expect(events.some(event => event.type === "done")).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("ends a stalled fetch before the hosting deadline and aborts its signal", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => { signal = init?.signal; return never(); });
    const result = collectPipeline("renew passport, Patiala", deps(fetchImpl));
    await vi.advanceTimersByTimeAsync(55_001);
    expect(signal?.aborted).toBe(true);
    const events = await result;
    expect(events[0]).toMatchObject({ type: "meta", mode: "live", task: "renew passport", city: "Patiala" });
    expect(events.at(-1)).toEqual({ type: "error", message: "This run exceeded its time limit. Results are incomplete; try again later." });
    expect(events.some(event => event.type === "done")).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a stalled response body, not just time to headers", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({ start() {} })));
    const result = collectPipeline("renew passport, Patiala", deps(fetchImpl));
    await vi.advanceTimersByTimeAsync(55_001);
    expect((await result).at(-1)?.type).toBe("error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not start provider work for an already disconnected request", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>(never);
    const response = await createCheckResponse(request(controller.signal), deps(fetchImpl));
    const text = await response.text();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(text).not.toContain('"type":"done"');
  });

  it("stops in-flight work when the request disconnects", async () => {
    const controller = new AbortController();
    let signal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => { signal = init?.signal; return never(); });
    const response = await createCheckResponse(request(controller.signal), deps(fetchImpl));
    const result = response.text();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    controller.abort();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(await result).not.toContain('"type":"done"');
  });

  it("aborts provider work when the response reader cancels", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => { signal = init?.signal; return never(); });
    const response = await createCheckResponse(request(), deps(fetchImpl));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await response.body!.cancel();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("complete response latency", () => {
  it("includes model body parsing in latency", async () => {
    let now = 10;
    const response = new Response();
    response.json = async () => { now = 60; return { choices: [{ finish_reason: "stop", message: { content: "ok" } }] }; };
    const env = deps(async () => response).env;
    const result = await chatComplete({ fetch: async () => response, baseUrl: "https://example.invalid",
      apiKey: env.nebiusApiKey, model: "synthetic", messages: [], temperature: 0,
      maxTokens: 1, timeoutMs: 1000, now: () => now });
    expect(result.latencyMs).toBe(50);
  });

  it("includes search body parsing in latency", async () => {
    let now = 10;
    const response = new Response();
    response.json = async () => { now = 60; return { results: [] }; };
    const env = deps(async () => response).env;
    const result = await searchTavily({ fetch: async () => response, apiKey: env.tavilyApiKey,
      query: "synthetic", maxResults: 1, now: () => now });
    expect(result.latencyMs).toBe(50);
  });
});
