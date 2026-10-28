# Sarkari Speedrun hackathon review

## October 28 audit update — current findings

The sections below this update preserve the October 27 review as historical context, not current verification. [STATUS.md](STATUS.md) is the current status; raw evidence is in `../hermes-reports/A2-evidence/` and the detailed audit is `../hermes-reports/A2-sarkari-speedrun.md`.

- Read-only public checks confirmed the deployed homepage responds and GitHub reports a public MIT repository. No deployed task, public eval, paid provider or credential check was performed. Devpost entry/rules direct reads were blocked, including a browser attempt; indexed official rules reconfirm the October 30 10:00 AM Pacific deadline and YouTube/public-repo/feedback requirements.
- Fixed the public evaluation budget bypass locally: `/api/eval` is now always a cache consistency check, regardless of live/auto/mock server mode. Added regression tests with synthetic inputs and a network spy, and explicit UI wording. CLI live evaluation is unchanged and must be authorized separately. This fix is **not deployed**.
- Final local checks: 29 tests, lint, production build and typecheck pass; CLI mock eval is 10/10. Production browser checks exercise five cached maps, an unsupported task, eval and mobile tabs. These are not live model accuracy or real-user impact evidence.
- Replaced stale contradictory status notes, clarified README verification boundaries, and added a concrete cached-demo script and local recording. The original root MP4 is unchanged; only its metadata was checked.
- Removed ready-to-paste AI feedback from the submission draft. **Kulraj must author that section himself.** Historical live results remain explicitly unverified until supported by the original trace.
- Still open: final-map eval semantics/error separation; city/jurisdiction routing; source freshness and meaning; translation validation; copy provenance; incomplete fallback trace accounting; distributed budget enforcement; live timeout strategy. The changes here do not fix these broader limitations.

---

## Historical October 27 review

Reviewed locally on October 27, 2026. Scope: README.md, STATUS.md, submission-draft.md, application code, and tests. Videos and demo-script.md were not opened or changed. No deployment, commit, or live provider run was performed.

## Criteria and evidence boundary

The criteria below come from the **Hackathon** section of [STATUS.md](STATUS.md), which attributes its summary to the [Devpost rules and dates pages](https://nebiusglobalaihackathon.devpost.com), read October 24. It records Stage 1 as pass/fail on theme fit and Stage 2 as four equally weighted criteria. The detailed official scoring rubric and any subsequent rule changes are **unknown in this review**; the live rules were not rechecked. The submission draft supplies the project narrative, not an independent rubric.

STATUS.md is a historical log: its final “live, published, deployed” update supersedes the earlier missing-key, never-run-live, and undeployed notes. It records public repository and deployment URLs, but their current availability and public repository metadata were not verified here. The live-run counts and timings in the submission remain previously recorded results, not new measurements. No raw live-run report was found among the reviewed project files.

## Mapping criteria to gaps

| Recorded criterion | Evidence in the project | Gap and practical next step |
| --- | --- | --- |
| **Stage 1: theme fit (pass/fail)** | [pipeline.ts](src/lib/pipeline.ts) calls NVIDIA Nemotron Nano and Super through Nebius Token Factory, with Ultra as an availability fallback. [nebius.ts](src/lib/nebius.ts) contains the runtime inference request. | Code demonstrates the integration path; cached demos make no provider calls. Preserve a redacted live trace showing actual model IDs and the live-mode indicator for judges. Current hosted operation remains unverified. |
| **Technological Implementation (equal weight)** | Service-focused Tavily search/extract, official-host filtering, quote and fee guards, a low-confidence second pass, streamed results, and provider-failure tests. | Quote presence does not establish that advice follows from it. Checklist translations, dates, addresses, applicability, and confidence are not independently validated. The eval can count superseded items and does not distinguish provider errors from misses. Follow up with final-map scoring, explicit error reporting, and human checks of whether each quote supports its advice. |
| **Design (equal weight)** | Step cards expose quotes and source links; cached/live labels, mobile tabs, bilingual checklist, copy action, and an empty-map state support the core flow. | Copy failure is silent, copied checklists omit citations and cached/live context, and mobile/keyboard/screen-reader usability has no recorded user validation. Manually check those flows and preserve provenance when copying. Small input, language, status, and confidence-label fixes are included in this review. |
| **Potential Impact (equal weight)** | The app addresses fragmented government instructions and language access. Five cached Punjab examples make the intended use concrete; the recorded live results include an empty outcome. | No measured task completion, avoided trips, time savings, or user study is documented. Service-domain routing in [config.ts](src/lib/config.ts) ignores the city and routes several certificate tasks to Punjab portals. Validate with intended users and establish jurisdiction coverage before making broader reach or impact claims. |
| **Quality of the Idea (equal weight)** | The specific constraint—an item must carry a matching quote from an official URL—makes the answer inspectable. The cached voter-ID example exposes conflicting guidance. | No comparison with direct portal search or a generic cited assistant is documented. “Every line can be checked” is stronger than the implemented checks on paraphrases and checklists. Demonstrate a concrete conflict or rejected item, explain the remaining uncertainty, and evaluate whether users reach the right next action. |

## Submission requirements and bonus entries

These are requirements or planned entries recorded in STATUS.md, not additional weighted judging criteria.

| Recorded requirement / entry | Local evidence and remaining gap |
| --- | --- |
| Working demo and public source repository with visible OSS licence | README and STATUS link the Vercel site and GitHub repository; [LICENSE](LICENSE) is MIT. Current URL availability and the repository's About licence display still need verification before submission. |
| Description, README explaining Nemotron and Token Factory, track selection | README explains each model's role and shared API; the draft contains the description and now explicitly records the planned Apps & Agents track. Actual Devpost field completion is unknown. |
| YouTube video under three minutes | This requirement is recorded in STATUS.md. Upload/link, duration, and content compliance are unknown here: all videos and demo-script.md were deliberately left uninspected and untouched. |
| Best Use of Tavily | [tavily.ts](src/lib/tavily.ts) implements runtime search and extract, service-domain preferences, date-filter fallback, and rejection of non-official hosts. Cached playback does not demonstrate runtime use. Preserve live evidence and show why retrieval changes the result. |
| Nebius/NVIDIA feedback / Most Valuable Feedback | The draft now includes concrete feedback about the shared API and default thinking consuming the answer budget. A redacted reproducible example and a specific documentation suggestion would strengthen it. Submission status is unknown. |

## Accuracy and reliability gaps to prioritize

1. **Validate meaning, jurisdiction, and freshness.** [sanitize.ts](src/lib/sanitize.ts) checks a normalized substring at the exact evidence URL. Retrieval may supply only a search snippet or a clipped extract. A correct quote can accompany an incorrect title or detail; a date in the quote does not establish recency. The numeric fee guard recognizes `₹` and `Rs` prefixes, not every currency spelling or number written in words. The checklist gets a numeric fee check but no full semantic or translation check. Several cached details also go beyond their displayed quote, such as excluding police-verification time from the passport clock. Review those against the complete source before strengthening claims; this pass did not alter source facts without evidence.

2. **Make evaluation evidence interpretable.** [eval-run.ts](src/lib/eval-run.ts) accumulates every item event, including an item later replaced on the visible map, and ignores pipeline error events. The gold set and cached fixtures share [sources.ts](src/lib/sources.ts), so a passing mock eval checks consistency, not independent accuracy. Historical exact-line and same-site results cannot explain failures or certify advice. Score the final map, report errors separately, and retain redacted inputs, outputs, model IDs, and source excerpts alongside any future results.

3. **Bound the public eval and long runs.** [api/eval/route.ts](src/app/api/eval/route.ts) bypasses [http.ts](src/lib/http.ts)'s limiter and runs the task set sequentially. Both API routes declare a 60-second duration, while the pipeline can perform multiple provider calls, fallbacks, and a second pass. Slow runs can exceed that duration. The main check limits are also per-instance soft caps. Follow up with explicit eval access/limits and a deadline strategy that reports an incomplete run clearly. This review did not change hosting or route behavior.

4. **Keep the trace honest about coverage.** Model confidence is self-reported. Failed model attempts are absent from successful fallback traces, and their latency/usage is not accounted for in the displayed totals. Extraction failures silently retain snippets. Label retrieval provenance and incomplete accounting before using traces as evidence of end-to-end performance.

## Small changes made in this review

- README and submission copy now describe normalized quote checks, partial maps, service-domain fallback, source-date heuristics, and historical evaluation results without claiming measured correctness. The README also corrects the number of model calls in the second pass. The draft adds the planned track and concrete tool feedback.
- Fee matching preserves nonzero decimal amounts: an uncited paise amount can no longer pass because its whole-rupee part matches. Quote validation now accepts any matching snippet from the cited URL, while still rejecting a quote found only at another URL. Regression tests cover both cases.
- The task input has a visible label and input-length limit, and cannot submit via the keyboard while a run is active. Hindi content has its language declared; loading and error messages have announcement roles. Confidence is labelled as a model estimate, and the change badge no longer promises recency.

## Verification

- Baseline `npm test`: 24 tests passed.
- After changes, `npm test`: 26 tests passed, including the new fee and repeated-URL regression cases.
- `npm run build`: passed, including TypeScript checking and production page generation.
- `npm run lint`: passed.
- Live APIs, hosted availability, video compliance, and real-user usability were not tested. Local passing checks do not resolve those gaps.
