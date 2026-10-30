import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterPanel } from "@/components/router-panel";
import { readEnv } from "@/lib/env";
import { estimateUsd } from "@/lib/models";
import { chatComplete } from "@/lib/nebius";
import { collectPipeline } from "@/lib/pipeline";
import { applyEvent, beginRun } from "@/lib/reduce";
import type { PipelineDeps } from "@/lib/types";

const invalidCounts = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
const env = readEnv({});
const quote = "Renewal costs Rs. 200.";
const url = "https://parivahan.gov.in/fees";
const reply = (content: string, prompt: unknown = 12, completion: unknown = 8) => ({
  choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: prompt, completion_tokens: completion },
});

// All responses below are synthetic. No host configuration or network is used.
describe("observed model accounting", () => {
  it.each(invalidCounts)("rejects invalid usage %s in both token fields", async (count) => {
    for (const side of ["prompt", "completion"]) {
      const response = new Response();
      response.json = async () => reply("ok", side === "prompt" ? count : 12, side === "completion" ? count : 8);
      const result = await chatComplete({ fetch: async () => response, baseUrl: "https://example.invalid",
        apiKey: "synthetic", model: env.nanoModel, messages: [], temperature: 0,
        maxTokens: 1, timeoutMs: 1000, now: () => 0 });
      expect(side === "prompt" ? result.promptTokens : result.completionTokens).toBeNull();
      expect(estimateUsd(env.nanoModel, side === "prompt" ? count : 12, side === "completion" ? count : 8)).toBeNull();
    }
  });

  it("keeps valid zero usage as zero rather than unknown", async () => {
    const result = await chatComplete({ fetch: async () => Response.json(reply("ok", 0, 0)),
      baseUrl: "https://example.invalid", apiKey: "synthetic", model: env.nanoModel, messages: [],
      temperature: 0, maxTokens: 1, timeoutMs: 1000, now: () => 0 });
    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(estimateUsd(env.nanoModel, 0, 0)).toBe(0);
  });

  it.each(["plan", "settle", "settle-retry"])("retains successful response usage when %s application parsing fails", async (broken) => {
    let settles = 0;
    const deps: PipelineDeps = {
      env: { ...env, mode: "live", nebiusApiKey: "synthetic", tavilyApiKey: "synthetic" },
      now: () => 0, sleep: async () => {}, present: false,
      fetch: async (input, init) => {
        if (String(input).includes("/extract")) return Response.json({ results: [{ url, raw_content: quote }] });
        if (String(input).includes("tavily.com")) return Response.json({ results: [{ url, title: "Fees", content: quote }] });
        const body = JSON.parse(String(init?.body));
        const system: string = body.messages[0].content;
        let content: unknown;
        if (system.includes("plan the sub-questions")) {
          content = broken === "plan" ? null : { questions: [{ text: "Fee?" }] };
        } else if (system.includes("settle conflicts between sources")) {
          settles += 1;
          content = broken === "settle" || (broken === "settle-retry" && settles === 2) ? null : {
            items: [{ kind: "fee", title: "Renewal fee", detail: quote, quote, url, confidence: 0.2 }],
          };
        } else if (system.includes("rewrite the search query")) {
          content = { query: "renew driving licence Amritsar Renewal fee" };
        } else {
          content = { hindi: "शुल्क Rs. 200।", english: quote };
        }
        return Response.json(reply(content === null ? "not JSON" : JSON.stringify(content)));
      },
    };
    const events = await collectPipeline("renew driving licence, Amritsar", deps);
    const board = events.reduce(applyEvent, beginRun());
    const trace = board.traces.find(item => item.id === broken);
    expect(trace).toMatchObject({ promptTokens: 12, completionTokens: 8, outcome: "rejected" });
    expect(renderToStaticMarkup(RouterPanel({ board }))).toContain("Application rejected all or part of this response");
    expect(trace?.estimatedUsd).toBeGreaterThan(0);
    expect(board.mode).toBe("live");
    expect(board.task).toBe("renew driving licence");
    if (broken === "settle-retry") {
      expect(board.warnings.join(" ")).toContain("recheck did not complete");
      expect(board.items).toHaveLength(1);
    } else expect(board.status).toBe("error");
  });

  it("calls mixed known/unknown model costs an observed subtotal", () => {
    const board = beginRun();
    board.mode = "live";
    const trace = { id: "plan", step: "plan" as const, title: "Plan", detail: "Synthetic response",
      provider: "Nebius Token Factory" as const, modelId: env.nanoModel, modelLabel: "Nano",
      latencyMs: 10, promptTokens: 1, completionTokens: 1, estimatedUsd: 0.01 };
    board.traces = [trace, { ...trace, id: "checklist", estimatedUsd: 0.02 },
      { ...trace, id: "settle", modelId: "unknown-model", estimatedUsd: null }];
    const html = renderToStaticMarkup(RouterPanel({ board }));
    expect(html).toContain("Observed model subtotal");
    expect(html).toContain("$0.030");
    expect(html).toContain("1 model response has unknown cost");
    expect(html).toContain("Unrecorded failed attempts and Tavily credits are excluded");
  });

  it("shows unknown model cost when no response has a price", () => {
    const board = beginRun();
    board.mode = "live";
    board.traces = [{ id: "plan", step: "plan", title: "Plan", detail: "Synthetic response",
      provider: "Nebius Token Factory", modelId: "unknown-model", modelLabel: "unknown-model",
      latencyMs: 10, promptTokens: null, completionTokens: null, estimatedUsd: null }];
    const html = renderToStaticMarkup(RouterPanel({ board }));
    expect(html).toContain("Model cost unknown");
    expect(html).not.toContain("$0");
  });

  it("keeps first-call failure cost unknown with no response trace", () => {
    const board = beginRun();
    board.mode = "live";
    board.status = "error";
    const html = renderToStaticMarkup(RouterPanel({ board }));
    expect(html).toContain("Model cost unknown");
    expect(html).toContain("No model response was recorded");
    expect(html).toContain("Unrecorded failed attempts");
  });

  it("renders observed zero explicitly without implying full-run zero cost", () => {
    const board = beginRun();
    board.mode = "live";
    board.traces = [{ id: "plan", step: "plan", title: "Plan", detail: "Synthetic response",
      provider: "Nebius Token Factory", modelId: env.nanoModel, modelLabel: "Nano",
      latencyMs: 10, promptTokens: 0, completionTokens: 0, estimatedUsd: 0 }];
    const html = renderToStaticMarkup(RouterPanel({ board }));
    expect(html).toContain("$0.0000");
    expect(html).toContain("This is not the full run cost");
  });
});
