import { describe, expect, it } from "vitest";
import { checklistText, CACHED_BANNER, LIVE_BANNER, MOCK_EMPTY_BANNER } from "@/lib/copy";
import { DEMO_TASKS } from "@/lib/fixtures";
import { createBoardState } from "@/lib/reduce";
import type { BoardState } from "@/lib/types";

const fixture = DEMO_TASKS[0]!;
const board: BoardState = {
  ...createBoardState(), status: "done", mode: "mock", sample: true,
  task: fixture.task, city: fixture.city, fixtureId: fixture.id, items: fixture.items,
  checklist: { english: fixture.english, hindi: fixture.hindi, sample: true },
};

describe("copied checklist provenance", () => {
  it("keeps both languages, task, caution, quotes and URLs in cached copies", () => {
    const text = checklistText(board);
    for (const expected of [CACHED_BANNER, fixture.english, fixture.hindi, fixture.city,
      "Not official guidance", "not an independent check of the translation"]) {
      expect(text).toContain(expected);
    }
    for (const item of fixture.items) {
      expect(text).toContain(item.quote);
      expect(text).toContain(item.url);
    }
  });
  it("labels a live copy without implying cached provenance", () => {
    const text = checklistText({ ...board, mode: "live", fixtureId: null, sample: false });
    expect(text).toContain(LIVE_BANNER);
    expect(text).not.toContain(CACHED_BANNER);
  });
  it("labels an uncached mock task without inventing citations", () => {
    const text = checklistText({ ...board, fixtureId: null, items: [] });
    expect(text).toContain(MOCK_EMPTY_BANNER);
    expect(text).toContain("No cited map items.");
  });
  it("preserves incomplete state and rate-limit notes", () => {
    const text = checklistText({ ...board, status: "error", note: "Live limit reached." });
    expect(text).toContain("Run incomplete");
    expect(text).toContain("Live limit reached.");
  });
  it("does not invent a checklist when none exists", () => {
    expect(checklistText(createBoardState())).toBe("");
  });
});
