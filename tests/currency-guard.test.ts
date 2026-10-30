import { describe, expect, it } from "vitest";
import { amountsAreCited, rupeeAmounts, sanitizeItem } from "@/lib/sanitize";
import { assertDemoFixtures, DEMO_TASKS } from "@/lib/fixtures";

const quote = "The official renewal fee is Rs. 200.00 for this application.";
const url = "https://parivahan.gov.in/fees";

function item(detail: string) {
  return sanitizeItem({
    raw: { kind: "fee", title: "Renewal fee", detail, quote, url, confidence: 0.9 },
    evidence: [{ title: "Fees", url, snippet: quote, score: 0.9 }],
    sample: false,
    order: 0,
  });
}

describe("currency citation boundary", () => {
  it("keeps the partial-year qualification in the cached late-fee card", () => {
    const card = DEMO_TASKS.flatMap(task => task.items).find(entry => entry.title === "After the grace period");
    expect(card?.detail).toContain("each year or part of a year");
    expect(card?.quote).toContain("each year or part thereof");
  });

  it.each([
    "Pay INR 999.", "Pay ₹९९९.", "Pay Rs. -200.", "Pay ₹+200.",
    "Pay Rs. 200 lakh.", "Pay ₹200k.", "Pay Rs. 200 करोड़.",
    "Pay ₹2,00.", "Pay ₹200.00.50.", "Pay ₹200e3.",
    "Pay -₹200.", "Pay ₹200–999.", "Pay ₹200 000.",
    "Pay ₹200/999.", "Pay ₹200/-999.", "Pay ₹200 to 999.",
    "Pay INR (999).", "Pay Rs. (999).", "Pay INR: 999.",
    "Pay ₹200, 000.", "Pay ₹200. lakh.", "Pay ₹200,-999.", "Pay ₹200 .50.",
  ])("rejects changed or unsupported recognized expression: %s", (text) => {
    expect(amountsAreCited(text, [quote])).toBe(false);
    expect(item(text)).toBeNull();
  });

  it.each(["INR 200", "₹२००", "Rs. 0200.00", "₹200/-", "Rs.200.00.", "Pay Rs. 200; amounts in INR.",
    "Pay ₹200. 2 photos are required.", "Pay ₹200.00. 2 photos are required."])(
    "accepts supported equivalent amount: %s", (text) => {
      expect(amountsAreCited(text, [quote])).toBe(true);
      expect(item(text)).not.toBeNull();
    },
  );

  it.each(["₹1,00,000", "INR 100,000", "Rs. 100000", "₹१,००,०००"])(
    "accepts conventional numeric grouping: %s", (text) => {
      expect(rupeeAmounts(text)).toEqual(["100000"]);
      expect(amountsAreCited(text, ["The fee is ₹100000."])).toBe(true);
    },
  );

  it("never cites the numeric prefix of an unsupported quote expression", () => {
    expect(amountsAreCited("Pay ₹200", ["The fee is ₹200 lakh."])).toBe(false);
    expect(amountsAreCited("Pay ₹200", ["The fee is ₹2,00."])).toBe(false);
  });

  it("requires every generated language to pass the shared guard", () => {
    expect(amountsAreCited("Pay Rs. 200. शुल्क ₹९९९ है।", [quote])).toBe(false);
  });

  it("does not find Rs inside words", () => {
    expect(rupeeAmounts("Numbers200 and hours200")).toEqual([]);
  });

  it.each([".50", " lakh", "–999", " 000"])("rejects a quote cut before %s", (suffix) => {
    const cut = "The official renewal fee is ₹200";
    expect(sanitizeItem({
      raw: { kind: "fee", title: "Fee", detail: "₹200", quote: cut, url },
      evidence: [{ title: "Fees", url, snippet: `${cut}${suffix} for this application.`, score: 1 }],
      sample: false, order: 0,
    })).toBeNull();
  });

  it.each([".", ","])("rejects a quote cut after separator %s", (separator) => {
    const cut = `The official renewal fee is ₹200${separator}`;
    expect(sanitizeItem({
      raw: { kind: "fee", title: "Fee", detail: "₹200", quote: cut, url },
      evidence: [{ title: "Fees", url, snippet: `${cut}500 for this application.`, score: 1 }],
      sample: false, order: 0,
    })).toBeNull();
  });

  it.each([
    ["₹200 la", "₹200 lakh"], ["₹200 thou", "₹200 thousand"],
    ["₹200/-", "₹200/-999"], ["₹200", "₹200 .50"],
  ])("rejects an incomplete source expression: %s", (quoted, source) => {
    const prefix = "The official renewal fee is ";
    expect(sanitizeItem({
      raw: { kind: "fee", title: "Fee", detail: "₹200", quote: prefix + quoted, url },
      evidence: [{ title: "Fees", url, snippet: prefix + source + " for renewal.", score: 1 }],
      sample: false, order: 0,
    })).toBeNull();
  });

  it.each(["hindi", "english", "item"])("rejects corrupted fixture %s", (field) => {
    const fixture = structuredClone(DEMO_TASKS[0]);
    if (field === "item") fixture.items[0].detail = "Pay ₹200–999.";
    else if (field === "hindi") fixture.hindi = "शुल्क ₹200–999 है।";
    else fixture.english = "Pay ₹200–999.";
    expect(() => assertDemoFixtures([fixture])).toThrow(/rupee amount|states a fee/);
  });
});
