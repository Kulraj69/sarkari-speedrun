import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import type { PipelineDeps } from "@/lib/types";

const urls = ["a", "b", "c", "d"].map((id) => `https://parivahan.gov.in/${id}`);
const quote = "Renewal costs Rs. 200. Bring the application form.";
const poison = "UNREQUESTED_OR_AMBIGUOUS_BODY";

// Real pipeline/provider adapters, injected fetch only; no external I/O.
describe("extraction boundary through the pipeline", () => {
  it.each(["initial", "retry"])("isolates bad bodies and exposes incomplete %s retrieval", async (stage) => {
    let extracts = 0;
    let settles = 0;
    const prompts: string[] = [];
    const deps: PipelineDeps = {
      env: { ...readEnv({}), mode: "live", nebiusApiKey: "synthetic", tavilyApiKey: "synthetic" },
      now: () => 0, sleep: async () => {}, present: false,
      fetch: async (input, init) => {
        const target = String(input);
        if (target.endsWith("/extract")) {
          extracts += 1;
          expect(JSON.parse(String(init?.body)).urls).toEqual(urls.slice(0, 3));
          const bad = stage === "initial" || extracts > 1;
          return Response.json({ results: [
            { url: urls[0], raw_content: bad ? poison : quote },
            ...(bad ? [{ url: urls[0], raw_content: quote }] : []),
            { url: urls[1], raw_content: "Unique extracted page B." },
            { url: urls[2], raw_content: "Unique extracted page C." },
            { url: urls[3], raw_content: poison },
          ] });
        }
        if (target.endsWith("/search")) return Response.json({ results: urls.map((url, index) => ({
          url, title: `Page ${index}`, content: index === 0 ? quote : `Search snippet ${index}`, score: 1 - index / 10,
        })) });
        if (!target.endsWith("/chat/completions")) throw new Error("Unexpected injected request");
        const messages = JSON.parse(String(init?.body)).messages;
        const system = messages[0].content as string;
        let content: unknown;
        if (system.includes("plan the sub-questions")) content = { questions: [{ text: "Renewal fee?" }] };
        else if (system.includes("rewrite the search query")) content = { query: "renew driving licence Amritsar Renewal fee" };
        else if (system.includes("settle conflicts between sources")) {
          prompts.push(messages[1].content);
          settles += 1;
          content = { items: [{ kind: "fee", title: "Renewal fee", detail: "Rs. 200", quote, url: urls[0],
            confidence: stage === "retry" && settles === 1 ? 0.2 : 0.9 }] };
        } else content = { hindi: "शुल्क Rs. 200।", english: "Fee Rs. 200." };
        return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
          usage: { prompt_tokens: 12, completion_tokens: 8 } });
      },
    };
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    const board = events.reduce(applyEvent, beginRun());
    expect(board.status).toBe("done");
    expect(board.items).toHaveLength(1);
    expect(extracts).toBe(stage === "retry" ? 2 : 1);
    expect(prompts).toHaveLength(extracts);
    for (const prompt of prompts) {
      expect(prompt).not.toContain(poison);
      expect(prompt).toContain(quote);
      expect(prompt).toContain("Unique extracted page B.");
      expect(prompt).toContain("Search snippet 3");
    }
    expect(board.warnings.join(" ")).toContain(stage === "retry" ? "Retry evidence retrieval incomplete" : "Evidence retrieval incomplete for");
    const trace = board.traces.find((entry) => stage === "retry" ? entry.id === "evidence-retry" : entry.step === "evidence");
    expect(trace?.detail).toContain("4 official evidence entries retained");
    if (stage === "retry") {
      const initial = board.traces.find((entry) => entry.step === "evidence");
      expect(initial?.detail).toContain("4 official evidence entries.");
      expect(initial?.detail).not.toContain("4 official pages");
    }
    expect(JSON.stringify(events)).not.toContain(poison);
  });
});
