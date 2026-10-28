import { createDefaultDeps } from "@/lib/pipeline";
import { scoreEval } from "@/lib/eval-run";
import { errorMessage } from "@/lib/json";

export const maxDuration = 60;

export async function POST(): Promise<Response> {
  try {
    // This unauthenticated endpoint is a cache consistency check, not a way
    // around /api/check's live budget. Live evaluation belongs in the CLI.
    const deps = createDefaultDeps(false);
    const report = await scoreEval({ ...deps, env: { ...deps.env, mode: "mock" } });
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}