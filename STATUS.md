# Sarkari Speedrun — status, October 28, 2026

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
Quote presence and numeric fee checks do not validate meaning, translation, dates, addresses, jurisdiction or legal applicability. Some certificate routing is Punjab-specific and ignores the city. Live eval may count superseded item events and treats provider errors as misses. Failed fallback attempts are not fully represented in trace totals. The live limiter is in-memory per instance; slow multi-provider requests can exceed the route's 60-second duration. These are documented gaps, not fixed or measured impact claims.