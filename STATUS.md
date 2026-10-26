# Sarkari Speedrun: status (Oct 26, 2026, 11:30 PM IST)

## Hackathon: Nebius x NVIDIA Global AI Hackathon
Source: https://nebiusglobalaihackathon.devpost.com (rules and dates pages, read Oct 24; summarised in ../nebius-plan.md).
- Deadline: Oct 30, 2026, 10:00 AM PDT = **Oct 30, 10:30 PM IST**. Judging Dec 1-15, winners Jan 11.
- Must run on Nebius Token Factory or Nebius AI Cloud and use at least one NVIDIA open model. A runtime call to the Token Factory inference API counts.
- Submission needs: a working demo URL, a text description, a public GitHub/GitLab/Bitbucket repo with an OSS licence visible in About, a README showing Nemotron use and where Token Factory helped, a YouTube video under 3 minutes, a track choice, and feedback on the Nebius/NVIDIA tools.
- Judging: Stage 1 is pass/fail on theme fit. Stage 2 weights four criteria equally: Technological Implementation, Design, Potential Impact, Quality of the Idea.
- Prizes: $20K / $10K / $6K overall; a Jetson Orin Nano per track; Best Use of Tavily $3K (needs a runtime Tavily call); Most Valuable Feedback, $100 x 10. One project can win one overall award, or one track award plus one bonus award.
- Planned target: Apps & Agents track + Best Use of Tavily + Feedback prize.

## Done
- Code recovered from the transcript of cloud agent bc-fe21084a into this folder. Base: a create-next-app + shadcn scaffold, re-run the same way, then 120 edits replayed and the 8 files the agent deleted removed. 66 tracked files, committed locally (no remote).
- The app is Next.js 16. Nemotron Nano plans the sub-questions and writes the Hindi/English checklist, Tavily searches official domains only (gov.in, nic.in and others, past year), and Nemotron Super settles conflicts. A trace panel shows the model, tokens and latency for each step.
- Mock mode works: `RECEIPTS_MODE=mock npm run demo` serves http://127.0.0.1:41731, and /api/health reports mode "mock". There are 5 cached demos (passport in Patiala, PAN-Aadhaar in Ludhiana, DL in Amritsar, voter ID in Patiala, Punjab residence certificate).
- Checks: vitest 21/21 pass, `tsc --noEmit` clean, eslint clean (0 warnings), `npm run eval` 10/10 (in mock mode this only checks the cache).

## Missing
1. **NEBIUS_API_KEY**. There is none yet. Create one in Token Factory (org QualiaBits-9y5, kulsingh609@gmail.com) and save it to ../secrets/nebius_key.txt (chmod 600).
2. Live mode has never run. The model ids still have to be confirmed against the Token Factory catalog.
3. Not deployed. The README demo URL is a placeholder (sarkari-speedrun.vercel.app).
4. No public repo. The original agent pushed to an "origin" whose URL isn't recorded in the transcript. Needs a public GitHub/GitLab repo with MIT showing in About.
5. Video (under 3 minutes), Devpost description, and feedback write-up (Kulraj writes these; submit only with his yes).
6. Rebuild caveats: the scaffold was regenerated today, so its files (layout boilerplate, ui components, package-lock) may differ slightly from the Oct 24 originals. The README was rebuilt from a truncated read plus diffs; check it reads cleanly. The env var is still named RECEIPTS_MODE, left over from the earlier Receipts idea; harmless.

## Live mode config
Put these in `.env.local` (or the host's env):
```
NEBIUS_API_KEY=<Token Factory key>       # required
TAVILY_API_KEY=<Tavily key>              # required (exists in ../secrets/tavily_key.txt)
RECEIPTS_MODE=live                       # or auto: live when both keys are set
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1   # default
NEBIUS_NANO_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B
NEBIUS_SUPER_MODEL=nvidia/nemotron-3-super-120b-a12b
NEBIUS_CHECK_FALLBACK_MODEL=nvidia/Nemotron-3-Ultra-550b-a55b
```
Live mode needs **both** keys. With only NEBIUS_API_KEY set, `auto` stays in mock and `live` throws an error.

## Next steps
1. Create the Nebius key and write .env.local from the secrets files, without printing either key.
2. Run `RECEIPTS_MODE=live npm run demo`, then try the 5 demo tasks plus 2 new ones and `npm run eval` live. Fix any model-id or response errors.
3. Push to a public GitHub repo and deploy with render.yaml or Vercel (keys as host secrets). Update the README URL.
4. Record the video (2:45), then draft the description and feedback, then Kulraj's yes, then submit by Oct 30, 6 PM IST (4 hours of buffer).

## Oct 26, 2026: live, published, deployed

- Repo: https://github.com/Kulraj69/sarkari-speedrun (public, MIT)
- Live site: https://sarkari-speedrun.vercel.app (Vercel, live mode, keys stored as Vercel env vars)
- Live results: 6 of 7 tasks returned cited items. The quote check dropped 5 of 20 proposed items. Eval: exact gold line 0 of 10, same official site 5 of 10. Each run costs about $0.002.
- Fixes:
  - Turned off Nemotron thinking. Super's reasoning was using up the token budget and leaving no answer.
  - Restricted Tavily to each service's own portal.
  - Filtered out embassy and court pages.
  - Each evidence snippet is now the most relevant 1,600-character section of the page.
- Vercel: the CLI build left out devDependencies, so `vercel.json` now installs with `--include=dev`. The project framework is set to nextjs.
