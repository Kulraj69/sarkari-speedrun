# Demo video script (target 2:40)

**0:00–0:20: The problem**
On screen: Google results for "renew driving licence Punjab", with forums and old PDFs.
Voice: "Renewing a licence in Punjab isn't hard. Finding the real steps is. Ask a chatbot and you get a confident answer you can't check. A wrong fee or form costs you a trip."

**0:20–0:35: The idea**
On screen: the Sarkari Speedrun home page.
Voice: "Sarkari Speedrun gives you the steps, and every step quotes a line from an official government page. No quote, no step."

**0:35–1:25: A live run**
Type "renew driving licence, Amritsar" and run it. Show the trace panel filling in.
Voice: "Nemotron Nano on Nebius Token Factory splits this into questions: fees, documents, where to go. Tavily searches only parivahan.gov.in. Nemotron Super reads what came back and proposes steps, each with a quote."
Click a step to show the quote and the parivahan link.
Voice: "Our code checks that this exact line is on that page. If it isn't, the step is gone."

**1:25–1:45: The checklist**
On screen: the Hindi/English checklist.
Voice: "Nano writes the checklist in Hindi and English, using only lines that passed the check."

**1:45–2:15: When it says nothing**
On screen: the Mohali income certificate run with an empty map.
Voice: "Here it found nothing it could quote, so it shows nothing. Across seven live tasks, six returned cited steps. Super proposed 20 items and five quoted lines that weren't on the page. All five were dropped."

**2:15–2:35: Honest numbers**
On screen: the eval output.
Voice: "On ten hand-labelled questions it cited the same official site we would have in five. It never reproduced our exact line, because live search finds different pages. It's a small sample, and we show it as one."

**2:35–2:45: Close**
On screen: the URL and the repo.
Voice: "Sarkari Speedrun. Steps you can check. It's live at sarkari-speedrun.vercel.app."
