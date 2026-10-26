import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";
import { DEMO_TASKS } from "@/lib/fixtures";
import { createCheckResponse } from "@/lib/http";
import { DAY_NOTE, IP_NOTE, LiveLimiter } from "@/lib/rate-limit";
import type { PipelineDeps, PipelineEvent } from "@/lib/types";

const HOUR = 60 * 60 * 1000;

describe("LiveLimiter", () => {
  it("allows 5 live checks per IP per hour, then resets", () => {
    const limiter = new LiveLimiter();
    for (let i = 0; i < 5; i++) expect(limiter.take("1.1.1.1", i).ok).toBe(true);
    expect(limiter.take("1.1.1.1", 10)).toEqual({ ok: false, note: IP_NOTE });
    expect(limiter.take("2.2.2.2", 10).ok).toBe(true);
    expect(limiter.take("1.1.1.1", HOUR + 1).ok).toBe(true);
  });

  it("caps live checks per day across all IPs", () => {
    const limiter = new LiveLimiter(5, HOUR, 3);
    expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("b", 0).ok).toBe(true);
    expect(limiter.take("c", 0).ok).toBe(true);
    expect(limiter.take("d", 0)).toEqual({ ok: false, note: DAY_NOTE });
    expect(limiter.take("d", 24 * HOUR).ok).toBe(true);
  });
});

describe("check route over the limit", () => {
  it("serves the cached demo with a note and never calls the network", async () => {
    let calls = 0;
    const deps: PipelineDeps = {
      fetch: async () => {
        calls += 1;
        throw new Error("network disabled");
      },
      env: { ...readEnv({}), mode: "live", nebiusApiKey: "k", tavilyApiKey: "k" },
      now: () => 0,
      sleep: async () => {},
      present: false,
    };
    const limiter = new LiveLimiter(0, HOUR, 200);
    const request = new Request("http://local/api/check", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify({ text: DEMO_TASKS[0].text }),
    });
    const response = await createCheckResponse(request, deps, limiter);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as PipelineEvent);
    const meta = events.find((e) => e.type === "meta");
    expect(meta).toMatchObject({ mode: "mock", note: IP_NOTE });
    expect(meta && "fixtureId" in meta && meta.fixtureId).toBeTruthy();
    expect(events.some((e) => e.type === "item")).toBe(true);
    expect(calls).toBe(0);
  });
});
