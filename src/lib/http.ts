import { errorMessage, isRecord } from "@/lib/json";
import { createDefaultDeps, runPipeline } from "@/lib/pipeline";
import type { PipelineDeps } from "@/lib/types";

const JSON_ERROR = "Send JSON with a text field.";

export async function createCheckResponse(
  request: Request,
  deps: PipelineDeps = createDefaultDeps(true),
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
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(text, deps)) {
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