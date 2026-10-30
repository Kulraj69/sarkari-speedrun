# Feedback on Nebius Token Factory and NVIDIA Nemotron

NOT READY TO SUBMIT. Kulraj must write this from his own experience. The earlier first-person draft was not authenticated as his account and must not be pasted into Devpost.

Questions for Kulraj:
- Which tools and models did you personally run, and for which steps?
- What worked well? Give one concrete example from that session.
- What failed? Include the actual symptom, model and fix only if you reproduced them.
- What documentation change would have helped? Would you use the tools again, and why?

Code facts to check, not personal feedback: the implementation uses one OpenAI-compatible chat-completions interface for planning, checking and checklist generation; requests set `chat_template_kwargs.enable_thinking` to `false`. This does not prove what happened in a live session.

Historical run counts, latency, cost and rejection statistics are excluded from the proposed form text until their original evidence is verified. Cached footage does not supply that evidence.
