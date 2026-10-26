# Sarkari Speedrun: Devpost draft

**Tagline:** Type a government task and a city. Get the steps, each one quoted from an official page.

## Inspiration

Renewing a driving licence in Punjab is not hard. Finding out how is. The real instructions are spread across parivahan.gov.in, a state portal, an old FAQ, and a forum post that may be three years out of date. Most people end up asking an agent or a cousin.

Language models make this worse in one specific way. Ask one and you get a confident answer that is often wrong, with no way to check it. For a fee or a form number, a wrong answer costs a wasted trip to an office.

So we wanted the opposite: an answer where every line can be checked against the official page it came from.

## What it does

You type something like "renew driving licence, Amritsar". Sarkari Speedrun returns a step map: steps, documents, fees, the office or portal, processing time, and a flag when the source itself says something changed.

Every item links to an official page and quotes a line from it. If the quote is not actually on that page, the item is dropped. If a rupee amount is not in the quote, the item is dropped too. At the end you get the same checklist in Hindi and English.

The rule we built around: an empty answer is better than an invented one.

## How we built it

- Nemotron 3 Nano on Nebius Token Factory breaks the task into sub-questions: steps, documents, fees, where to go, time, recent changes.
- Tavily searches only that service's own official domains, for example parivahan.gov.in for a licence or eci.gov.in for voter ID. Embassy and court pages are filtered out. From each page we keep the 1,600 characters that match the question best.
- Nemotron 3 Super reads that evidence and proposes items. Each item has to carry a quote. Our code, not the model, checks that the quote appears word for word in the page text.
- Nano writes the bilingual checklist from the surviving lines only.
- The trace panel shows each model call, its tokens, and its latency.

It is a Next.js app deployed on Vercel. Live checks are limited per visitor and per day, and past either limit the site serves the cached demos with a note saying so.

## Results

We ran seven tasks live, once each, no retries:

- 6 of 7 returned cited items: passport (Patiala), PAN–Aadhaar link (Ludhiana), driving licence (Amritsar), voter ID address change (Patiala), residence certificate (Patiala), birth certificate (Jalandhar).
- The seventh, an income certificate in Mohali, came back empty. Nothing survived the quote check, so we showed nothing.
- Across these runs Super proposed 20 items. 5 of them quoted lines that were not on the cited page. The check caught all 5.
- Runs took 9 to 24 seconds.
- On a 10-question hand-labelled set, the live system cited the same official site we had picked by hand in 5 of 10 cases. It reproduced our exact hand-copied line in 0 of 10, because live search finds different pages from the ones we copied. That is a small sample, not a benchmark.

## Challenges

- Nemotron 3 thinks by default. Super used its whole token budget on reasoning and returned nothing. Turning thinking off for the settle step fixed it.
- Early searches returned embassy pages and city homepages. Restricting each task to its own official domain mattered more than any prompt change.
- The first 700 characters of a government page are usually navigation, so we pick the most relevant section of the page instead.

## What we learned

The quote check is the product. A model that can't point to a line on an official page doesn't get to put anything on the map. It drops a quarter of what Super proposes, and that's the quarter you'd want gone.

## What's next

- Coverage beyond Punjab.
- Better handling of PDFs, where many Indian government forms live.
- Re-checking each step on a schedule and flagging when a cited line changes.

## Built with

Next.js, TypeScript, NVIDIA Nemotron 3 (Nano, Super), Nebius Token Factory, Tavily, Vercel.

Links: https://sarkari-speedrun.vercel.app · https://github.com/Kulraj69/sarkari-speedrun
