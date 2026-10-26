"use client";

import { formatLatency, formatUsd } from "@/lib/format";
import type { BoardState, StepTrace } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RouterPanelProps {
  board: BoardState;
}

export function RouterPanel({ board }: RouterPanelProps) {
  const cost = board.traces.reduce((sum, trace) => sum + (trace.estimatedUsd ?? 0), 0);
  const hasCost = board.traces.some((trace) => trace.estimatedUsd !== null);

  return (
    <aside className="space-y-3" data-testid="router-panel">
      <div>
        <h2 className="font-heading text-2xl leading-none">Trace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Model, tokens, and latency for each step.
        </p>
      </div>

      {board.traces.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            After a run, this panel lists Nemotron Nano, Tavily, and Nemotron Super with tokens and latency.
            In mock mode the times are recorded samples and the APIs are not called.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-2">
          {board.traces.map((trace) => (
            <li key={trace.id}>
              <TraceRow trace={trace} />
            </li>
          ))}
        </ol>
      )}

      {hasCost ? (
        <p className="text-xs text-muted-foreground">
          List-price estimate {formatUsd(cost)}. Public Token Factory rates, not an invoice. Tavily credits are not included.
        </p>
      ) : board.mode === "mock" && board.traces.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No token counts on a cached demo, because no model was called.
        </p>
      ) : null}
    </aside>
  );
}

function TraceRow({ trace }: { trace: StepTrace }) {
  const tokens =
    trace.promptTokens === null || trace.completionTokens === null
      ? "—"
      : `${trace.promptTokens} in / ${trace.completionTokens} out`;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{trace.title}</CardTitle>
        <Badge variant="outline">{trace.provider}</Badge>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{trace.modelLabel}</p>
        {trace.modelId ? <p className="break-all">{trace.modelId}</p> : null}
        <p>
          {formatLatency(trace.latencyMs)} · tokens {tokens}
          {trace.estimatedUsd !== null ? ` · ${formatUsd(trace.estimatedUsd)}` : ""}
        </p>
        <p>{trace.detail}</p>
      </CardContent>
    </Card>
  );
}