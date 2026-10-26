import { connection } from "next/server";
import { describeRuntime, readEnv } from "@/lib/env";

export async function GET(): Promise<Response> {
  await connection();
  const report = describeRuntime(readEnv());
  return Response.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}