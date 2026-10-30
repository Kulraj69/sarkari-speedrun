import { describe, expect, it } from "vitest";
import { DEMO_TASKS } from "@/lib/fixtures";
import { readEnv } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import { checklistText } from "@/lib/copy";
import { PUNJAB_RTS_QUOTE } from "@/lib/sources";

const residence = DEMO_TASKS.find((task) => task.id === "punjab-residence")!;

describe("Punjab cache evidence boundaries", () => {
  it("does not add a photo-ID classification absent from the cached quote", () => {
    const identity = residence.items.find((item) => item.id === "id")!;
    expect(identity.title).toBe("Identity-document copies listed in the cached form");
  });

  it("does not use a service code as evidence of fees or processing time", () => {
    expect(residence.items.filter((item) => item.kind === "fee" || item.kind === "time")).toEqual([]);
    expect(residence.items.some((item) => item.quote === PUNJAB_RTS_QUOTE)).toBe(false);
  });

  it("does not add school-certificate instructions absent from its displayed sources", () => {
    expect(residence.english).not.toMatch(/school certificate/i);
    expect(residence.hindi).not.toContain("स्कूल प्रमाणपत्र");
    for (const item of residence.items) {
      expect(`${item.title} ${item.detail}`).not.toMatch(/school certificate|स्कूल प्रमाणपत्र/i);
    }
  });

  it("states cache limits without claiming the complete form has no fees or deadline", () => {
    expect(residence.english).toContain("This cache does not establish the current fee or processing time.");
    expect(residence.hindi).toContain("इस कैश से वर्तमान शुल्क या लगने वाला समय पता नहीं चलता");
    expect(residence.english).not.toMatch(/form does not print|Mandatory|certificate number/i);
  });

  it("keeps missing-category caveats in the actual streamed and copied checklist", async () => {
    const events = await collectPipeline(residence.text, {
      env: readEnv({ RECEIPTS_MODE: "mock" }),
      fetch: async () => { throw new Error("No network permitted"); },
      now: () => 0, sleep: async () => {}, present: false,
    });
    const board = events.reduce(applyEvent, beginRun());
    expect(board.status).toBe("done");
    expect(board.items.some((item) => item.kind === "fee" || item.kind === "time")).toBe(false);
    const copied = checklistText(board);
    expect(copied).toContain("This cache does not establish the current fee or processing time.");
    expect(copied).toContain("इस कैश से वर्तमान शुल्क या लगने वाला समय पता नहीं चलता");
    expect(copied).toContain("first and second pages of a ration card");
    expect(copied).toContain("राशन कार्ड के पहले और दूसरे पन्ने");
    expect(copied).toContain("confirm that these routes support this certificate");
    expect(copied).toContain("इस सर्टिफिकेट के लिए इनकी उपलब्धता जाँचें");
    for (const id of ["online", "sewa"]) {
      const card = board.items.find((item) => item.id === id)!;
      expect(card.detail).toContain("does not name the residence certificate");
      expect(card.detail).toMatch(/Confirm.*(available|availability)/);
    }
    expect(copied).not.toContain(PUNJAB_RTS_QUOTE);
    for (const item of residence.items) expect(copied).toContain(item.quote);
  });
});
