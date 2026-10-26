import { errorMessage, isRecord } from "@/lib/json";
import { resolveMode } from "@/lib/env";
import { createDefaultDeps, runPipeline } from "@/lib/pipeline";
import { clientIp, liveLimiter, type LiveLimiter } from "@/lib/rate-limit";
import type { PipelineDeps } from "@/lib/types";

const JSON_ERROR = "Send JSON with a text field.";

export async function createCheckResponse(
  request: Request,
  deps: PipelineDeps = createDefaultDeps(true),
  limiter: LiveLimiter = liveLimiter,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: JSON_ERROR }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.text !== "string") {
    return Response.json({ error: JSON_ERROR }, { status: 400 });
  }

  const text = body.text;
  let note: string | undefined;
  if (text.trim() && wouldRunLive(deps)) {
    const verdict = limiter.take(clientIp(request), deps.now());
    if (!verdict.ok) {
      note = verdict.note;
      deps = { ...deps, env: { ...deps.env, mode: "mock" } };
    }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const raw of runPipeline(text, deps)) {
          const event = note && raw.type === "meta" ? { ...raw, note } : raw;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (error) {
        const payload = { type: "error", message: errorMessage(error) };
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function wouldRunLive(deps: PipelineDeps): boolean {
  try {
    return resolveMode(deps.env) === "live";
  } catch {
    return false;
  }
}
