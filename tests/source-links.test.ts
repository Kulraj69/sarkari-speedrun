import { describe, expect, it } from "vitest";
import { isPublicHttpUrl } from "@/lib/trust";
import { sanitizeItem } from "@/lib/sanitize";
import { gatherOfficialEvidence } from "@/lib/tavily";
import { checklistText } from "@/lib/copy";
import { DEMO_TASKS } from "@/lib/fixtures";
import { createBoardState } from "@/lib/reduce";

const malformed = [
  " https://parivahan.gov.in/fee", "https://parivahan.gov.in/fee\n",
  "https://pari\tvahan.gov.in/fee", "https:parivahan.gov.in/fee",
  "https:///parivahan.gov.in/fee", "https://parivahan.gov.in\\fee",
  "https://reader@parivahan.gov.in/fee", "https://parivahan.gov.in:8443/fee",
  "https://%70arivahan.gov.in/fee",
  "https://.gov.in/fee", "https://a..gov.in/fee", "https://-a.gov.in/fee",
  "https://a-.gov.in/fee", `https://${"a".repeat(64)}.gov.in/fee`,
];
const nonofficial = [
  "https://127.0.0.1/fee", "http://localhost/fee", "http://[::1]/fee",
  "https://parivahan.gov.in.example.org/fee", "https://example.org/fee",
  "javascript:alert(1)", "file:///fee",
];
const fixture = DEMO_TASKS[0]!;
const original = fixture.items[0]!;
const quote = "Synthetic official fee page for this source-link regression.";

function sanitize(url: string) {
  return sanitizeItem({ raw: { ...original, url, quote, title: "Read the source", detail: "Read the source" },
    evidence: [{ url, title: "Synthetic source", snippet: quote, score: 1 }], sample: false, order: 0 });
}

describe("source-link boundary", () => {
  it.each(malformed)("does not repair an ambiguous HTTP URL: %s", (url) => {
    expect(isPublicHttpUrl(url)).toBe(false);
  });
  it.each([...malformed, ...nonofficial])("rejects an unusable item source: %s", (url) => {
    expect(sanitize(url)).toBeNull();
  });
  it.each([" ", "\n", "\u00a0"])("does not trim a model URL to match clean evidence: %j", (padding) => {
    const url = "https://parivahan.gov.in/fee";
    for (const rawUrl of [padding + url, url + padding]) {
      expect(sanitizeItem({
        raw: { ...original, url: rawUrl, quote, title: "Read the source", detail: "Read the source" },
        evidence: [{ url, title: "Synthetic source", snippet: quote, score: 1 }],
        sample: false, order: 0,
      })).toBeNull();
    }
  });
  it.each([...malformed, ...nonofficial])("does not restore a rejected URL in copied citations: %s", (url) => {
    const text = checklistText({ ...createBoardState(), status: "done", mode: "mock", fixtureId: fixture.id,
      items: [{ ...original, url }], checklist: { english: "Synthetic checklist", hindi: "परीक्षण", sample: true } });
    expect(text).not.toContain(url);
    expect(text).toContain("Source link withheld: unsupported source URL.");
  });
  it.each([
    "https://parivahan.gov.in/fee?lang=hi#charges", "http://www.nic.in/page",
    "https://PARIVAHAN.GOV.IN:443/fee", "https://parivahan.gov.in/fees%20table",
  ])("preserves accepted source identifiers exactly: %s", (url) => {
    expect(sanitize(url)?.url).toBe(url);
  });
  it("filters rejected search links before constructing an extraction request", async () => {
    const valid = "https://parivahan.gov.in/fees";
    const requested: string[][] = [];
    const result = await gatherOfficialEvidence({ apiKey: "synthetic-unused", query: "fee", maxResults: 10, now: () => 0,
      fetch: async (input, init) => {
        if (String(input).endsWith("/extract")) {
          requested.push(JSON.parse(String(init?.body)).urls);
          return Response.json({ results: [{ url: valid, raw_content: quote }] });
        }
        return Response.json({ results: [...malformed, ...nonofficial, valid].map((url) => ({ url, title: "Synthetic", content: quote, score: 1 })) });
      } });
    expect(requested).toEqual([[valid]]);
    expect(result.evidence.map((item) => item.url)).toEqual([valid]);
  });
});
