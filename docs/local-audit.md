# Local audit mechanics — October 28, 2026

These changes were pushed and deployed on October 30, 2026. Synthetic provider tests and cached browser checks are not live sponsor evidence.

October29 extraction identity follow-up: only an exact requested URL with one nonblank result can replace a snippet. Duplicate results, including blank or identical duplicates, leave the search snippet and an incomplete-extraction warning. Unrequested extraction results are ignored. Both initial retrieval and retry use the same gather function. This is an identity join check, not source authentication, freshness or semantic verification.

Copy checklist now keeps both languages, the task/city, cached/live label, caution, and each visible item's quote and source URL. Clipboard denial shows an error instead of failing silently. These changes are local, not deployed.

Live map IDs are assigned by the application, so a repeated model ID cannot hide another item. Source titles come from the matched retrieved snippet, not the checker. Missing or non-finite confidence becomes zero, not certainty. These checks do not authenticate the retrieval provider or calibrate confidence.

The checker processes at most eight proposed items per response. Rejected items and unchecked overflow now leave separate warnings; the map can keep the valid subset. The trace marks a response as rejected when all or part was discarded, retaining reported usage. Such runs are excluded from evaluation. The retry prompt receives the original title and kind; its best matching improvement replaces only that card, keeping its ID and position.

Evaluation scores the final map using the same replacement reducer as the UI. Failed, incomplete or degraded pipelines produce **not scored**, not a miss or partial success; those checks are counted separately and excluded from the scored denominator. The CLI exits nonzero if any check was not scored. A completed empty map without warnings still counts as a miss.

Retrieval, low-confidence recheck and checklist failures now leave visible warnings on the map and in copied text. Failed or missing extraction keeps available search snippets and labels them as such; malformed result lists are not treated as successful empty searches. A rejected checklist falls back to cited titles, not a verified Hindi translation. With no evidence, the pipeline skips the settling/checklist model calls. These paths are tested with synthetic provider responses, not live sponsor calls.

The task and city in the map come from your input, not the planner's suggested replacement. Use `task, city` to supply an explicit city; no city is inferred if that suffix is absent. National service portals are search hints; state-service queries no longer default to Punjab portals. This is not jurisdiction verification: model subquestions and wider searches can still introduce the wrong state's page. An invalid rewrite, or one missing task/city words, uses a deterministic task/city/title fallback, with a warning in the map, trace and copied text. Retry replacements must keep the original title and kind. These lexical checks can reject useful synonyms and do not detect conflicting extra locations or wrong advice under a matching title.

