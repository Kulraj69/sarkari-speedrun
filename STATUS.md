# Sarkari Speedrun — status, October 28, 2026

## 20:20 continuation — map integrity (local only)
Current branch `work/a2-evidence-routing`, uncommitted; older branch/test counts below are historical. Application-owned IDs prevent duplicate model IDs hiding cards. Retry prompts preserve target title/kind and rebind only the intended card. Retrieved source titles and finite-confidence handling verified; citation/identity rejection and unchecked overflow have distinct warnings and trace outcomes. Demo startup now binds localhost.

Fresh source install, 135 tests, lint/build/typecheck, cache eval10/10 and nine browser groups pass. New actual labelled cached video `demo/sarkari-cached-integrity.mp4` (34.48s) fully decodes; per-card quote/title/URL clipboard readbacks pass. Report `../hermes-reports/A2-map-integrity-rounds.md` contains two supplementary review/fix rounds. Required cheap+ missing; last review not passing/rescored, so epic remains blocked. Six npm advisories remain (including two critical development-chain entries); no dependency-security or live-provider sign-off. All publication/submission/live evidence/human feedback gates below remain.

## Evening continuation — failure visibility
Retrieval, low-confidence recheck and checklist degradation is now explicit in the map and copied text; degraded evaluation rows are not scored. Search/extraction shape failures are distinguished from empty results, missing extraction stays labelled snippet-only, and no-evidence runs skip remaining model calls. Authentication failures remain terminal. This is local only; provider tests use injected responses. Verification and current demo evidence are in the A2 report.

## Afternoon continuation — supersedes affected audit counts below
- Fixed final-map scoring: superseded item events no longer earn credit. Failed/incomplete runs are explicitly unscored and separated from completed misses; CLI returns nonzero on unscored checks.
- Copy preserves cached/live context, both languages, all visible quotes/URLs, caution and incomplete-run notes. Clipboard denial is visible.
- Fresh verification: 40 tests, lint, production build, typecheck; cache eval 10/10 with zero failed checks; ten browser check groups including real clipboard readback for all five fixtures and mobile denial handling.
- New local video: `demo/sarkari-cached-provenance.mp4`, 35.28 seconds, H.264 1440×964, silent, permanent cached/no-provider label. Original recordings preserved. No upload/deploy/push/commit/paid calls.
- Evidence: `../hermes-reports/A2-evidence/continuation-*` and `verify-continuation.py`. Remaining errors swallowed inside optional retrieval/retry paths, jurisdiction, semantics, trace accounting and distributed limits are not fixed.

## Submission and deadline
- Handoff reports **already submitted**. The actual public entry, selected track, feedback and video link remain **unverified**: direct Devpost requests returned 403 and the browser hit Cloudflare. Do not create a duplicate entry.
- Indexed [official rules](https://nebiusglobalaihackathon.devpost.com/rules) say October 30, 2026, 10:00 AM Pacific. Python zoneinfo confirms **October 30, 10:30 PM IST**. Recheck the actual form before acting; direct rules/schedule access was blocked.
- Indexed rules require a public licensed repo, functioning demo video publicly visible on YouTube under three minutes, model/Token Factory README coverage, track and tool feedback. The prior rules summary in `../nebius-plan.md` records runtime Nebius/NVIDIA use and runtime Tavily use for its bonus prize.
- Target remains Apps & Agents; actual track/bonus selections are unknown. Feedback must be written by Kulraj from his own experience.

## Verified now
- [Deployed homepage](https://sarkari-speedrun.vercel.app): unauthenticated GET returned 200 with the task form, five cached-demo choices, trace explanation and caution about outdated quotes. No task was run on this public deployment.
- [Repository](https://github.com/Kulraj69/sarkari-speedrun): unauthenticated GitHub API reports public, default branch `master`, detected MIT. Raw public LICENSE returned 200 with MIT text.
- Local checkout: `master`, initial HEAD `dcdcaa7`. Initial untracked `demo.mp4` preserved. No commits, pushes or deployments in this audit.
- Local production build, lint, typecheck and 29 tests pass. Cached CLI evaluation: 10/10 exact lines and same sites, a consistency check only.
- Production-browser verification: all five cached demos, unsupported-task empty map, public mock eval, mobile tabs and no browser errors/external requests.
- Nemotron Nano/Super/Ultra requests and Tavily search/extract are implemented and covered by mocked-network tests. These tests are not live sponsor-use proof.

## Local fix — not deployed
The unauthenticated `/api/eval` previously called the full pipeline in server-selected mode, bypassing `/api/check`'s live limiter. It now always scores cached fixtures. The UI explicitly says so. Live evaluation remains an operator CLI action requiring separate provider-use authorization. Regression tests cover live/auto/mock configurations with synthetic test inputs and an injected fetch spy.

## Evidence and demo
- Audit report: `../hermes-reports/A2-sarkari-speedrun.md`.
- Raw verification: `../hermes-reports/A2-evidence/` (test/build/lint/typecheck/eval logs, public retrieval, browser checks and recording script).
- Existing `demo.mp4`: 128.64 seconds, 1920×1080 H.264/AAC, inspected with ffprobe only. Audio/content/publication compliance not verified; file unchanged.
- New `demo/sarkari-cached-walkthrough.mp4`: local recording of the real production UI in explicit cached/mock mode. This is not proof of live provider use. No upload performed.
- `demo-script.md` gives a concrete local walkthrough and separate live-proof requirements.

## Historical notes, not re-measured
October 26 project notes report live Nebius/Tavily runs, publication and deployment. They supersede the old missing-key/never-deployed claims. Current credentials were not inspected, so neither presence nor validity is asserted. Historical counts and timings retained in README/submission-draft have no raw live trace in the reviewed source files; Kulraj must verify them before reusing them.

## Blockers / needs Kulraj
1. Inspect the existing Devpost entry and confirm its exact URL, selected track, source/demo links and deadline.
2. Write the feedback in your own words; verify or remove historical live statistics from the final description.
3. Supply already-redacted live evidence, or explicitly authorize a separately bounded live Token Factory/Tavily smoke test. No paid calls were made here.
4. Review these local changes, then separately approve the exact public push and deployment. The public eval exposure may remain until deployed.
5. Review a final video and separately approve its public YouTube upload; then approve the exact revised Devpost fields. A local video alone does not satisfy the entry requirements.

## Remaining technical limits
Quote presence and numeric fee checks do not validate meaning, translation, dates, addresses, jurisdiction or legal applicability. Some certificate routing is Punjab-specific and ignores the city. Eval handles final-map replacement and pipeline error/incomplete/warning events. Failed fallback attempts are not fully represented in trace totals; warnings are not complete request accounting. Invalid rewrite replies can still use a deterministic query fallback. The live limiter is in-memory per instance; slow multi-provider requests can exceed the route's 60-second duration. These remaining gaps are not fixed or measured impact claims.