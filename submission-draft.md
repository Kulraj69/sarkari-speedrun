# Sarkari Speedrun: Devpost draft

**Tagline:** Type a government task and a city. Get the steps, each one quoted from an official page.

**Planned track:** Apps & Agents. **Planned bonus entries:** Best Use of Tavily and Most Valuable Feedback, as recorded in STATUS.md.

## Inspiration

Renewing a driving licence in Punjab is not hard. Finding out how is. The real instructions are spread across parivahan.gov.in, a state portal, an old FAQ, and a forum post that may be three years out of date. Most people end up asking an agent or a cousin.

Language models make this worse in one specific way. Ask one and you get a confident answer that is often wrong, with no way to check it. For a fee or a form number, a wrong answer costs a wasted trip to an office.

So we wanted the opposite: an answer where every line can be checked against the official page it came from.

## What it does

You type something like "renew driving licence, Amritsar". Sarkari Speedrun returns a step map of the cited items found: steps, documents, fees, the office or portal, processing time, and source dates or changes. The map can be incomplete or empty.

Every item links to an official page and includes a quote. In live mode, quotes absent from the retrieved text for that URL are dropped, as are items whose numeric `₹` or `Rs` amounts are absent from their quote. Nano drafts a checklist in Hindi and English from the surviving items. Cached demos replay hand-copied quotes without a live search.

A matching quote does not prove the advice is current, applies to the user's city, or has been paraphrased or translated correctly. The confidence score is a model estimate, and the source date/change badge does not verify recency.

The rule we built around: an empty answer is better than an invented one.

## How we built it

- Nemotron 3 Nano on Nebius Token Factory breaks the task into sub-questions: steps, documents, fees, where to go, time, recent changes.
- Tavily searches service-specific domains first, for example parivahan.gov.in for a licence or eci.gov.in for voter ID. If no official results survive, it removes the date filter, then widens the search; only gov.in or nic.in hosts survive. A host-name filter removes common embassy and court results. From extracted pages we keep a relevant window of up to 1,600 characters; failed extracts retain search snippets.
- Nemotron 3 Super reads that evidence and proposes items. Each item has to carry a quote. Code checks that it occurs in retrieved text from the cited URL, ignoring case and whitespace.
- Nano writes the bilingual checklist from the surviving lines only.
- The trace panel shows each model call, its tokens, and its latency.

It is a Next.js app deployed on Vercel. The main check endpoint has soft limits per IP and per day; after either limit it serves cached demos with a note, or an empty map for uncached tasks. The eval endpoint currently runs outside those limits.

## Results

The project notes record seven tasks run live on Oct 26, 2026, once each without manual reruns. These results were not re-measured during this review; the pipeline can automatically recheck a low-confidence item.

- 6 of 7 returned cited items: passport (Patiala), PAN–Aadhaar link (Ludhiana), driving licence (Amritsar), voter ID address change (Patiala), residence certificate (Patiala), birth certificate (Jalandhar).
- The seventh, an income certificate in Mohali, came back empty. Nothing survived the quote check, so we showed nothing.
- Across these runs Super proposed 20 items. The quote check rejected 5 because their quotes were absent from the retrieved text for the cited URL. That does not establish the correctness of the remaining items.
- Runs took 9 to 24 seconds.
- On 10 hand-labelled quote checks across five tasks, the live system cited the same official site we had picked by hand in 5 of 10 cases. It matched the gold quote at the gold URL in 0 of 10. Neither metric measures answer correctness, and the scores alone do not explain missing matches. That is a small sample, not a benchmark.

## Challenges

- Nemotron 3 thinks by default. Super used its whole token budget on reasoning and returned nothing. Turning thinking off for the settle step fixed it.
- Early searches returned embassy pages and city homepages. Restricting each task to its own official domain mattered more than any prompt change.
- The first 700 characters of a government page are usually navigation, so we pick the most relevant section of the page instead.

## What we learned

The quote check is the product's core constraint. In the recorded seven-run sample, it dropped 5 of Super's 20 proposed items. The next accuracy question is whether each surviving quote supports the advice and applies to the user's circumstances.

## Feedback on Nebius and NVIDIA tools

Token Factory's shared API shape let us use Nano for planning and checklists, Super for checking, and an Ultra availability fallback without separate SDKs. Nemotron's default thinking exhausted the answer budget in early runs; setting `chat_template_kwargs.enable_thinking` to `false` resolved that failure. Clearer examples of reasoning versus answer token budgets would have made setup easier.

## What's next

- Coverage beyond Punjab.
- Better handling of PDFs, where many Indian government forms live.
- Re-checking each step on a schedule and flagging when a cited line changes.

## Built with

Next.js, TypeScript, NVIDIA Nemotron 3 (Nano, Super), Nebius Token Factory, Tavily, Vercel.

Links: https://sarkari-speedrun.vercel.app · https://github.com/Kulraj69/sarkari-speedrun
