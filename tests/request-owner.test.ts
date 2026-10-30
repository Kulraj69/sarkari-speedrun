import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestOwner } from "@/lib/request-owner";
import { scopedFetch } from "@/lib/cancellation";

function setup() { vi.useFakeTimers(); return createRequestOwner(); }
afterEach(() => vi.useRealTimers());

describe("UI request ownership", () => {
  it("cancels on leaving and can restart after an effect remount", () => {
    const owner = setup();
    const first = owner.start(100);
    owner.cancel();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    const second = owner.start(100);
    expect(second.isCurrent()).toBe(true);
    expect(second.signal.aborted).toBe(false);
    second.finish();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("replaces immediately; late finish cannot revoke newer ownership", () => {
    const owner = setup();
    const first = owner.start(100);
    const second = owner.start(200);
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    first.finish();
    expect(second.isCurrent()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    second.finish();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps timeout ownership so the current UI can display its error", async () => {
    const owner = setup();
    const request = owner.start(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(request.signal.aborted).toBe(true);
    expect(request.signal.reason.message).toBe("The request timed out.");
    expect(request.isCurrent()).toBe(true);
    request.finish();
    expect(request.isCurrent()).toBe(false);
  });
  it("does not abort a completed request later", async () => {
    const owner = setup();
    const request = owner.start(100);
    request.finish(); request.finish(); owner.cancel();
    await vi.advanceTimersByTimeAsync(200);
    expect(request.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("revokes ownership before firing synchronous abort listeners", () => {
    const owner = setup();
    const request = owner.start(100);
    const current: boolean[] = [];
    request.signal.addEventListener("abort", () => current.push(request.isCurrent()));
    owner.cancel(); owner.cancel();
    expect(current).toEqual([false]);
  });
  it.each(["fetch", "json"])("deadline bounds an ignoring %s operation", async (phase) => {
    const owner = setup();
    const request = owner.start(100);
    const response = new Response("{}");
    response.json = () => new Promise(() => {});
    const transport = vi.fn<typeof fetch>(() => phase === "fetch" ? new Promise(() => {}) : Promise.resolve(response));
    const run = scopedFetch(transport, request.signal)("http://localhost/api/eval").then(r => r.json());
    const rejected = expect(run).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    request.finish();
    expect(vi.getTimerCount()).toBe(0);
  });
});
