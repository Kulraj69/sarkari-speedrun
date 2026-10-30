import type { BoardState } from "@/lib/types";
import { isOfficialSourceUrl } from "@/lib/trust";

export function checklistText(board: BoardState): string {
  if (!board.checklist) return "";
  const banner = board.fixtureId !== null ? CACHED_BANNER
    : board.mode === "mock" ? MOCK_EMPTY_BANNER : LIVE_BANNER;
  const sources = board.items.map((item, index) =>
    `${index + 1}. ${item.title}\nQuote: ${item.quote}\n${isOfficialSourceUrl(item.url)
      ? `Source: ${item.url}` : "Source link withheld: unsupported source URL."}`,
  );
  return [
    "Sarkari Speedrun — " + [board.task, board.city].filter(Boolean).join(", "),
    banner,
    "Not official guidance. Quotes may be outdated or inapplicable; verify the source before paying or travelling.",
    board.status !== "done" ? "Run incomplete; this is a partial checklist." : "",
    board.note ?? "",
    board.warnings.length ? "Run degraded:\n" + board.warnings.join("\n") : "",
    board.checklist.english,
    board.checklist.hindi,
    sources.length ? "Cited map items (not an independent check of the translation):\n" + sources.join("\n\n") : "No cited map items.",
  ].filter(Boolean).join("\n\n");
}

export const CACHED_BANNER =
  "Cached demo. These lines are quotes from the linked official pages. No Token Factory or Tavily call was made.";

export const MOCK_EMPTY_BANNER =
  "Mock mode. This task was not searched on the live web, so the map stays empty.";

export const LIVE_BANNER =
  "Live run. Read the quoted line before you pay or travel. A step can still be wrong.";

export const RECORDED_TRACE_DETAIL =
  "Recorded sample timing. No Token Factory or Tavily call was made.";

export const EMPTY_CHECKLIST_EN =
  "Mock mode did not search the live web, so no step was filled in. This is not official guidance.";

export const EMPTY_CHECKLIST_HI =
  "मॉक मोड में लाइव खोज नहीं हुई, इसलिए कोई कदम नहीं भरा गया। यह आधिकारिक सलाह नहीं है।";

export const NO_CITED_EN =
  "No item kept a quote from the pages that came back, so this checklist stays empty.";

export const NO_CITED_HI =
  "जो पन्ने लौटे, उनमें से किसी उद्धरण के साथ कोई कदम नहीं बचा, इसलिए यह सूची खाली है।";

export const EMPTY_PLAN_EN =
  "Nothing in that line looked like a government task, so no page was opened.";

export const EMPTY_PLAN_HI =
  "इस पंक्ति में कोई सरकारी काम नहीं दिखा, इसलिए कोई पन्ना नहीं खोला गया।";