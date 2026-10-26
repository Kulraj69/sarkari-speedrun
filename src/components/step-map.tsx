"use client";

import { CACHED_BANNER, LIVE_BANNER, MOCK_EMPTY_BANNER } from "@/lib/copy";
import { isPublicHttpUrl } from "@/lib/trust";
import type { BoardState, GuideItem, ItemKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FileText, Flag, IndianRupee, MapPin, Route } from "lucide-react";

const KIND_LABEL: Record<ItemKind, string> = {
  step: "Step",
  document: "Document",
  fee: "Fee",
  office: "Office",
  time: "Time",
  change: "Change",
};

const KIND_ICON = {
  step: Route,
  document: FileText,
  fee: IndianRupee,
  office: MapPin,
  time: Clock,
  change: Flag,
} as const;

interface StepMapProps {
  board: BoardState;
  onCopy: () => void;
  copied: boolean;
}

export function StepMap({ board, onCopy, copied }: StepMapProps) {
  const banner =
    board.fixtureId !== null ? CACHED_BANNER : board.mode === "mock" ? MOCK_EMPTY_BANNER : board.mode === "live" ? LIVE_BANNER : null;
  const place = [board.task, board.city].filter(Boolean).join(", ");

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl leading-none">Step map</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {place || "Steps, documents, fees, and the counter, each with a quoted line."}
          </p>
        </div>
        {board.status === "running" ? <Badge variant="secondary">Drawing</Badge> : null}
      </div>

      {board.note ? (
        <p
          data-testid="limit-note"
          className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {board.note}
        </p>
      ) : null}

      {board.error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>The run stopped</CardTitle>
          </CardHeader>
          <CardContent>
            <p role="alert" data-testid="error-message">{board.error}</p>
          </CardContent>
        </Card>
      ) : null}

      {banner && board.status !== "idle" ? (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-sm leading-relaxed" data-testid="mode-banner">
          {banner}
        </p>
      ) : null}

      {board.status === "idle" ? <EmptyMap /> : null}

      {board.status === "running" && board.items.length === 0 && !board.error ? (
        <Card>
          <CardContent role="status" className="py-6 text-sm text-muted-foreground">
            {board.mode === "mock" ? "Loading the cached demo…" : "Preparing your step map…"}
          </CardContent>
        </Card>
      ) : null}

      {board.questions.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {board.questions.map((question) => (
            <li key={question.id} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              {question.id}. {question.text}
            </li>
          ))}
        </ul>
      ) : null}

      {board.items.length > 0 ? (
        <ol className="relative ml-3 space-y-3 border-l-2 border-primary/30" data-testid="step-map">
          {board.items.map((item, index) => (
            <Station key={item.id} item={item} index={index} />
          ))}
        </ol>
      ) : null}

      {board.checklist ? (
        <Card data-testid="checklist">
          <CardHeader>
            <CardTitle>Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">English</p>
                <p className="mt-1 text-sm leading-relaxed" data-testid="checklist-en">
                  {board.checklist.english}
                </p>
              </div>
              <div lang="hi">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">हिन्दी</p>
                <p className="mt-1 text-sm leading-relaxed" data-testid="checklist-hi">
                  {board.checklist.hindi}
                </p>
              </div>
            </div>
            <Button type="button" data-testid="copy-checklist" onClick={onCopy}>
              {copied ? "Copied" : "Copy checklist"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Station({ item, index }: { item: GuideItem; index: number }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li
      className="station relative pl-5"
      style={{ animationDelay: `${index * 70}ms` }}
      data-testid="guide-item"
    >
      <span className="absolute top-4 -left-[9px] grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background" />
      <article className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden />
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{KIND_LABEL[item.kind]}</span>
          {item.recentChange ? (
            <span
              className="rounded-full bg-[#f3e0c4] px-2 py-0.5 text-xs font-semibold text-[#8a4b12]"
              title="The quote mentions a date or change. Recency has not been verified."
            >
              Source date / change
            </span>
          ) : null}
          {item.basis === "live-evidence" ? (
            <span className="text-xs text-muted-foreground" title="Model estimate, not a measured accuracy score.">
              Model confidence {Math.round(item.confidence * 100)}%
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-base font-semibold leading-snug">{item.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
        <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
          “{item.quote}”
        </blockquote>
        {isPublicHttpUrl(item.url) ? (
          <a className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline" href={item.url} target="_blank" rel="noreferrer">
            {item.sourceTitle}
          </a>
        ) : (
          <p className="mt-2 text-xs font-medium">{item.sourceTitle}</p>
        )}
      </article>
    </li>
  );
}

function EmptyMap() {
  const stops = [
    { name: "Nemotron 3 Nano", text: "Plans the sub-questions: steps, papers, fee, counter, time." },
    { name: "Tavily", text: "Searches gov.in pages, prefers the last year, then extracts the top ones." },
    { name: "Nemotron 3 Super", text: "Settles conflicts and scores each line. A weak score is searched once more." },
    { name: "Nemotron 3 Nano", text: "Writes the checklist in Hindi and English." },
  ];
  return (
    <ol className="space-y-2">
      {stops.map((stop, index) => (
        <li key={`${stop.name}-${index}`} className="flex gap-3 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold">{stop.name}</p>
            <p className="text-sm text-muted-foreground">{stop.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
