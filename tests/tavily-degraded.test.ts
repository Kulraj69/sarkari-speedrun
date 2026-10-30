import { describe, expect, it } from "vitest";
import { gatherOfficialEvidence } from "@/lib/tavily";

const url = "https://parivahan.gov.in/fees";
const hit = { title: "Fees", url, content: "Renewal fee Rs. 200.", score: 0.8 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

async function run(kind: string) {
  let time = 0;
  let calls = 0;
  const result = await gatherOfficialEvidence({
    apiKey: "", query: "renewal fee", maxResults: 3, now: () => time,
    fetch: async (input) => {
      time += 5;
      calls += 1;
      if (kind === "search-throw") throw new Error("synthetic-private-diagnostic");
      if (String(input).includes("extract")) {
        if (kind === "extract-throw") throw new Error("synthetic-private-diagnostic");
        if (kind === "extract-http") return json({}, 503);
        if (kind === "extract-auth") return json({}, 401);
        if (kind === "extract-empty") return json({ results: [] });
        if (kind === "extract-shape") return json({ message: "synthetic-private-diagnostic" });
        return json({ results: [{ url, raw_content: hit.content }] });
      }
      if (kind === "search-shape") return json({ message: "synthetic-private-diagnostic" });
      if (kind === "search-empty") return json({ results: [] });
      return json({ results: [hit] });
    },
  });
  return { result, calls };
}

describe("retrieval evidence boundary", () => {
  it.each(["extract-throw", "extract-http", "extract-empty", "extract-shape"])("labels retained snippets after %s", async (kind) => {
    const { result } = await run(kind);
    expect(result.failed).toMatch(/extract|extraction/i);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].snippet).toBe(hit.content);
    expect(result.latencyMs).toBe(10);
    expect(JSON.stringify(result)).not.toContain("synthetic-private-diagnostic");
  });
  it.each(["search-throw", "search-shape"])("does not represent %s as a successful empty search", async (kind) => {
    const { result } = await run(kind);
    expect(result.failed).toMatch(/search/i);
    expect(result.evidence).toEqual([]);
    expect(result.latencyMs).toBe(5);
    expect(JSON.stringify(result)).not.toContain("synthetic-private-diagnostic");
  });
  it("keeps a genuinely empty search distinct from provider failure", async () => {
    const { result, calls } = await run("search-empty");
    expect(result.failed).toBeNull();
    expect(result.evidence).toEqual([]);
    expect(calls).toBe(3);
    expect(result.latencyMs).toBe(15);
  });
  it("preserves authentication failures", async () => {
    await expect(run("extract-auth")).rejects.toMatchObject({ status: 401 });
  });
  it("does not degrade successful extraction", async () => {
    const { result } = await run("success");
    expect(result.failed).toBeNull();
    expect(result.latencyMs).toBe(10);
  });
});
