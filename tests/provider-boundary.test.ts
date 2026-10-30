import { describe, expect, it } from "vitest";
import { chatComplete, type ChatRequest } from "@/lib/nebius";
import { readEnv } from "@/lib/env";
import { collectPipeline } from "@/lib/pipeline";
import { extractJson } from "@/lib/json";
import { applyEvent, beginRun } from "@/lib/reduce";

const privateDiagnostic = "synthetic-private-diagnostic";
const envelope = (choice: Record<string, unknown> = {}) => ({
  choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"questions":[{"text":"Fee?"}]}' }, ...choice }],
});
const request = (fetcher: typeof fetch): ChatRequest => ({
  fetch: fetcher, baseUrl: "https://example.invalid", apiKey: "synthetic",
  model: "synthetic-model", messages: [], temperature: 0, maxTokens: 100,
  timeoutMs: 1000, now: () => 0,
});

// Injected responses only: no host environment, real credentials or network.
describe("provider completion boundary", () => {
  it("does not leak model text from a failed embedded-JSON parse", () => {
    let error: unknown;
    try { extractJson(`prefix {"x":${privateDiagnostic}} suffix`); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Model did not return JSON.");
    expect(String(error)).not.toContain(privateDiagnostic);
  });

  it.each(["settle", "rewrite", "recheck", "checklist"])("rejects incomplete %s output through the real pipeline", async (failure) => {
    const url = "https://parivahan.gov.in/fees";
    const quote = "Renewal costs Rs. 200.";
    let settles = 0;
    const called: string[] = [];
    const events = await collectPipeline("renew driving licence, Amritsar", {
      env: { ...readEnv({}), mode: "live", nebiusApiKey: "synthetic", tavilyApiKey: "synthetic" },
      present: false, now: () => 0, sleep: async () => {},
      fetch: async (input, init) => {
        if (String(input).includes("/extract")) return Response.json({ results: [{ url, raw_content: quote }] });
        if (String(input).includes("tavily.com")) return Response.json({ results: [{ url, title: "Fees", content: quote }] });
        const system: string = JSON.parse(String(init?.body)).messages[0].content;
        const stage = system.includes("plan the sub-questions") ? "plan"
          : system.includes("rewrite the search query") ? "rewrite"
          : system.includes("settle conflicts between sources") ? (++settles === 1 ? "settle" : "recheck") : "checklist";
        called.push(stage);
        const content = stage === "plan" ? { questions: [{ text: "Fee?" }] }
          : stage === "rewrite" ? { query: "renew driving licence Amritsar Renewal fee" }
          : stage === "checklist" ? { hindi: "शुल्क Rs. 200।", english: quote }
          : { items: [{ kind: "fee", title: "Renewal fee",
            detail: stage === "recheck" ? "Rejected replacement detail" : quote, quote, url,
            confidence: stage === "recheck" ? 0.99 : failure === "rewrite" || failure === "recheck" ? 0.2 : 0.9 }] };
        return Response.json(envelope({ finish_reason: stage === failure ? "length" : "stop",
          message: { role: "assistant", content: JSON.stringify(content) } }));
      },
    });
    const board = events.reduce(applyEvent, beginRun());
    expect(called).toContain(failure);
    if (failure === "settle") {
      expect(board.status).toBe("error");
      expect(board.items).toEqual([]);
      expect(called).toEqual(["plan", "settle"]);
    } else {
      expect(board.status).toBe("done");
      expect(board.items).toHaveLength(1);
      expect(board.warnings.length).toBeGreaterThan(0);
      expect(JSON.stringify(board)).not.toContain("Rejected replacement detail");
      if (failure === "recheck") expect(board.items[0]).toMatchObject({ detail: quote, confidence: 0.2 });
      if (failure === "rewrite") expect(called).not.toContain("recheck");
      if (failure === "checklist") expect(board.checklist?.english).not.toBe(quote);
    }
  });
  it.each(["length", "content_filter", "tool_calls", "function_call", "unknown", null, 0])(
    "rejects complete-looking JSON when finish_reason is %s", async (reason) => {
      await expect(chatComplete(request(async () => Response.json(envelope({ finish_reason: reason })))))
        .rejects.toMatchObject({ name: "ProviderError", status: 0 });
    },
  );

  it("rejects missing completion status", async () => {
    const payload = envelope();
    delete (payload.choices[0] as Record<string, unknown>).finish_reason;
    await expect(chatComplete(request(async () => Response.json(payload)))).rejects.toMatchObject({ name: "ProviderError" });
  });

  it.each([
    { role: "assistant", content: "{}", refusal: "synthetic refusal" },
    { role: "tool", content: "{}" },
    { role: "assistant", content: [{ type: "text", text: "{}" }, { type: "refusal", refusal: "no" }] },
    { role: "assistant", content: [{ type: "image", text: "{}" }] },
    { role: "assistant", content: "{}", tool_calls: [{ id: "synthetic-call" }] },
    { role: "assistant", content: "{}", function_call: { name: "synthetic" } },
  ])("does not discard non-answer content: %j", async (message) => {
    await expect(chatComplete(request(async () => Response.json(envelope({ message }))))).rejects.toMatchObject({ name: "ProviderError" });
  });

  it("accepts complete text and text blocks", async () => {
    for (const content of ["{}", [{ type: "text", text: "{" }, { type: "text", text: "}" }]]) {
      const result = await chatComplete(request(async () => Response.json(envelope({ message: { role: "assistant", content, refusal: null } }))));
      expect(result.content).toBe("{}");
    }
  });

  it.each(["transport", "body"])("does not expose private %s diagnostics", async (stage) => {
    const response = new Response();
    response.json = async () => { throw new Error(privateDiagnostic); };
    const fetcher: typeof fetch = async () => {
      if (stage === "transport") throw new Error(privateDiagnostic);
      return response;
    };
    const error = await chatComplete(request(fetcher)).catch((value: unknown) => value);
    expect(error).toMatchObject({ name: "ProviderError", status: 0 });
    expect(String(error)).not.toContain(privateDiagnostic);
  });

  it.each(["length", "transport", "body"])("fails the initial pipeline safely after %s without downstream requests", async (failure) => {
    let calls = 0;
    const events = await collectPipeline("renew driving licence, Amritsar", {
      env: { ...readEnv({}), mode: "live", nebiusApiKey: "synthetic", tavilyApiKey: "synthetic" },
      present: false, now: () => 0, sleep: async () => {},
      fetch: async () => {
        calls += 1;
        if (failure === "transport") throw new Error(privateDiagnostic);
        if (failure === "body") return new Response(privateDiagnostic);
        return Response.json(envelope({ finish_reason: "length" }));
      },
    });
    expect(calls).toBe(1);
    expect(events.at(-1)?.type).toBe("error");
    expect(events.some((event) => event.type === "done" || event.type === "item")).toBe(false);
    expect(JSON.stringify(events)).not.toContain(privateDiagnostic);
  });
});
