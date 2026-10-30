"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/json";
import { createRequestOwner } from "@/lib/request-owner";
import { scopedFetch } from "@/lib/cancellation";
import { STREAM_TIMEOUT_MS } from "@/lib/stream";
import type { EvalReport } from "@/lib/eval-score";
import { Button } from "@/components/ui/button";

export function EvalRunner() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [requests] = useState(createRequestOwner);

  useEffect(() => () => {
    requests.cancel();
    setRunning(false);
  }, [requests]);

  async function run(): Promise<void> {
    const request = requests.start(STREAM_TIMEOUT_MS);
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const response = await scopedFetch(fetch, request.signal)("/api/eval", { method: "POST" });
      const payload: unknown = await response.json();
      if (!request.isCurrent()) return;
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "The sample could not be scored.";
        setError(message);
        setReport(null);
        return;
      }
      setReport(payload as EvalReport);
    } catch (caught) {
      if (request.isCurrent()) {
        setError(errorMessage(caught));
        setReport(null);
      }
    } finally {
      if (request.isCurrent()) setRunning(false);
      request.finish();
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Cached fixtures only. This does not call Token Factory or Tavily and is not a live model score.
      </p>
      <Button type="button" data-testid="eval-run" disabled={running} onClick={() => void run()}>
        {running ? "Scoring the sample…" : "Score this sample"}
      </Button>
      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm" data-testid="eval-error">
          {error}
        </p>
      ) : null}
      {report ? (
        <div className="space-y-2" data-testid="eval-score">
          <p className="text-sm font-semibold">{report.heading}</p>
          <p className="text-sm text-muted-foreground">{report.note}</p>
          <p className="text-sm">
            Matched {report.agreement} of {report.total}. Mode: {report.mode}.
          </p>
          <p className="text-sm" role="status">
            Failed/incomplete checks: {report.failed} of {report.rows.length}; excluded from scoring.
            {" "}Includes degraded runs with retrieval or generation warnings.
          </p>
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className="px-3 py-2 font-medium">Check</th>
                  <th className="px-3 py-2 font-medium">Found</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{row.task}</td>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2">{row.error || (row.found === null ? "not scored" : row.found ? "yes" : "no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}