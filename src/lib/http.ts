import { errorMessage, isRecord } from "@/lib/json";
import { readRequestJson, RequestBodyError } from "@/lib/request-body";
import { resolveMode } from "@/lib/env";
import { createDefaultDeps, runPipeline } from "@/lib/pipeline";
import { clientIp, INSTANCE_ID, liveLimiter, type LiveLimiter } from "@/lib/rate-limit";
import type { PipelineDeps } from "@/lib/types";

const JSON_ERROR = "Send JSON with a text field.";

export async function createCheckResponse(
  request: Request,
  deps: PipelineDeps = createDefaultDeps(true),
  limiter: LiveLimiter = liveLimiter,
): Promise<Response> {
  let body: unknown;
  try {
    body = await readRequestJson(request, deps.signal);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    const message = error instanceof RequestBodyError ? error.message : JSON_ERROR;
    return Response.json({ error: message }, { status });
  }

  if (!isRecord(body) || typeof body.text !== "string") {
    return Response.json({ error: JSON_ERROR }, { status: 400 });
  }

  const text = body.text;
  if (request.signal.aborted || deps.signal?.aborted) {
    return Response.json({ error: "Request cancelled." }, { status: 400 });
  }
  if (text.length > deps.env.maxInputChars) {
    return Response.json({ error: `Keep the task under ${deps.env.maxInputChars} characters.` }, { status: 400 });
  }
  let note: string | undefined;
  let limitHeader = "not-live";
  if (text.trim() && wouldRunLive(deps)) {
    const verdict = limiter.take(clientIp(request), deps.now());
    limitHeader = verdict.ok ? `used ${verdict.used ?? 0};${INSTANCE_ID}` : `limited;${INSTANCE_ID}`;
    if (!verdict.ok) {
      note = verdict.note;
      deps = { ...deps, env: { ...deps.env, mode: "mock" } };
    }
  }
  const encoder = new TextEncoder();
  const cancellation = new AbortController();
  const signals = [request.signal, cancellation.signal];
  if (deps.signal) signals.push(deps.signal);
  deps = { ...deps, signal: AbortSignal.any(signals) };
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const raw of runPipeline(text, deps)) {
          if (cancelled) break;
          const event = note && raw.type === "meta" ? { ...raw, note } : raw;
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (error) {
        const payload = { type: "error", message: errorMessage(error) };
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      cancellation.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Live-Limit": limitHeader,
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
