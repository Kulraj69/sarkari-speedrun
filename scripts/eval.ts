import { readEnv } from "../src/lib/env";
import { formatAccuracyTable } from "../src/lib/eval-score";
import { scoreEval } from "../src/lib/eval-run";
import { createDefaultDeps } from "../src/lib/pipeline";

async function main(): Promise<void> {
  const deps = createDefaultDeps(false);
  deps.env = readEnv(process.env);
  const report = await scoreEval(deps);
  process.stdout.write(`${formatAccuracyTable(report)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "eval failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});