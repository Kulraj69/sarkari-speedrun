import { createDefaultDeps } from "@/lib/pipeline";
import { scoreEval } from "@/lib/eval-run";
import { errorMessage } from "@/lib/json";

export const maxDuration = 60;

export async function POST(): Promise<Response> {
  try {
    const report = await scoreEval(createDefaultDeps(false));
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}