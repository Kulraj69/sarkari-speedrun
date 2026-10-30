import { describe, expect, it } from "vitest";
import { gatherOfficialEvidence } from "@/lib/tavily";

const urls = ["a", "b", "c", "d"].map((id) => `https://parivahan.gov.in/${id}`);
const hits = urls.map((url, index) => ({ url, title: `Page ${index}`, content: `Search snippet ${index}`, score: 1 - index / 10 }));
const page = (url: string, raw_content: unknown = "Extracted page") => ({ url, raw_content });

async function gather(results: unknown[], count = 1, searchHits = hits.slice(0, count)) {
  const requests: string[][] = [];
  const result = await gatherOfficialEvidence({
    apiKey: "synthetic-unused", query: "renew licence", maxResults: count, now: () => 0,
    fetch: async (input, init) => {
      if (String(input).endsWith("/extract")) {
        requests.push(JSON.parse(String(init?.body)).urls);
        return Response.json({ results });
      }
      return Response.json({ results: searchHits });
    },
  });
  return { result, requests };
}

describe("extraction identity join", () => {
  it("uses the extraction limit for distinct exact URLs, not repeated search hits", async () => {
    const { result, requests } = await gather(urls.slice(0, 3).map((url) => page(url)), 4,
      [hits[0], hits[0], hits[1], hits[2]]);
    expect(requests).toEqual([urls.slice(0, 3)]);
    expect(result.evidence.map((item) => item.snippet)).toEqual(Array(4).fill("Extracted page"));
    expect(result.failed).toBeNull();
  });

  it("ignores malformed and unrequested rows beside a unique valid body", async () => {
    const { result } = await gather([null, {}, { url: 1 }, page(urls[1]), page(urls[0])]);
    expect(result.evidence[0].snippet).toBe("Extracted page");
    expect(result.failed).toBeNull();
  });

  it.each(["   ", 42, false, undefined])("retains snippets for unusable unique body %#", async (body) => {
    const { result } = await gather([{ url: urls[0], raw_content: body }]);
    expect(result.evidence[0].snippet).toBe(hits[0].content);
    expect(result.failed).toMatch(/extract.*incomplete/i);
  });

  it.each([
    [page(urls[0], "First body"), page(urls[0], "Contradictory body")],
    [page(urls[0], "Identical body"), page(urls[0], "Identical body")],
    [page(urls[0], ""), page(urls[0])],
    [page(urls[0]), page(urls[0], "   ")],
    [page(urls[0], null), page(urls[0])],
  ])("retains a snippet and flags every duplicated requested URL %#", async (...results) => {
    const { result } = await gather(results);
    expect(result.evidence[0].snippet).toBe(hits[0].content);
    expect(result.failed).toMatch(/extract.*incomplete/i);
  });

  it("does not replace unrequested evidence even when returned by extraction", async () => {
    const { result, requests } = await gather(urls.map((url) => page(url)), 4);
    expect(requests).toEqual([urls.slice(0, 3)]);
    expect(result.evidence.map((item) => item.snippet)).toEqual([
      "Extracted page", "Extracted page", "Extracted page", hits[3].content,
    ]);
    expect(result.failed).toBeNull();
  });

  it("isolates ambiguity to the affected requested URL", async () => {
    const { result } = await gather([page(urls[0]), page(urls[1]), page(urls[0], "Other")], 2);
    expect(result.evidence.map((item) => item.snippet)).toEqual([hits[0].content, "Extracted page"]);
    expect(result.failed).toMatch(/extract.*incomplete/i);
  });

  it("accepts a unique requested result without depending on response order", async () => {
    const { result } = await gather([page(urls[1], "Second"), page(urls[0], "First")], 2);
    expect(result.evidence.map((item) => item.snippet)).toEqual(["First", "Second"]);
    expect(result.failed).toBeNull();
  });

  it.each([[], [page(urls[0], "")], [page(urls[0], null)], [null], [page(`${urls[0]}?redirect=1`)]])(
    "keeps missing or unusable exact-match bodies visibly incomplete %#", async (...results) => {
      const { result } = await gather(results);
      expect(result.evidence[0].snippet).toBe(hits[0].content);
      expect(result.failed).toMatch(/extract.*incomplete/i);
    },
  );
});
