"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { errorMessage } from "@/lib/json";
import { applyEvent, beginRun, createBoardState } from "@/lib/reduce";
import { readNdjson } from "@/lib/stream";
import type { BoardState, HealthReport } from "@/lib/types";
import { RouterPanel } from "@/components/router-panel";
import { StepMap } from "@/components/step-map";
import { TaskForm } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Pane = "task" | "map" | "models";

const STOPPED_EARLY = "The run stopped before a checklist was ready.";

function modeLabel(board: BoardState, health: HealthReport | null, healthReady: boolean): string {
  if (board.mode === "live") return "Live · Token Factory + Tavily";
  if (board.mode === "mock") return "Mock · cached demos";
  if (!healthReady) return "Checking setup…";
  if (health?.mode === "live") return "Live · Token Factory + Tavily";
  if (health?.mode === "mock") return "Mock · cached demos";
  if (health?.mode === "misconfigured") return "Live mode needs both keys";
  return "Setup unavailable";
}

export function SpeedrunApp() {
  const [draft, setDraft] = useState("renew passport, Patiala");
  const [board, setBoard] = useState<BoardState>(createBoardState());
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthReady, setHealthReady] = useState(false);
  const [pane, setPane] = useState<Pane>("task");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error("health failed");
        return (await response.json()) as HealthReport;
      })
      .then((report) => {
        if (!cancelled) setHealth(report);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      })
      .finally(() => {
        if (!cancelled) setHealthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runTask(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    setCopied(false);
    setDraft(trimmed);
    let latest = beginRun();
    setBoard(latest);
    if (window.matchMedia("(max-width: 1023px)").matches) setPane("map");

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      await readNdjson(response, (event) => {
        latest = applyEvent(latest, event);
        setBoard(latest);
      });
      if (latest.status === "running") {
        latest = applyEvent(latest, { type: "error", message: STOPPED_EARLY });
        setBoard(latest);
      }
    } catch (error) {
      latest = applyEvent(latest, { type: "error", message: errorMessage(error) });
      setBoard(latest);
    }
  }

  async function copyChecklist(): Promise<void> {
    if (!board.checklist) return;
    const text = `${board.checklist.english}\n\n${board.checklist.hindi}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const running = board.status === "running";

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              S
            </span>
            <div>
              <h1 className="font-heading text-2xl leading-none tracking-tight">Sarkari Speedrun</h1>
              <p className="text-xs text-muted-foreground">A cited step map for a government task</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/eval" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              Sample eval
            </Link>
            <Badge data-testid="mode-pill" variant="secondary">
              {modeLabel(board, health, healthReady)}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-3 lg:hidden">
        <Tabs
          value={pane}
          onValueChange={(value) => {
            if (value === "task" || value === "map" || value === "models") setPane(value);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="task">Task</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_18rem]">
        <div className={pane === "task" ? "block" : "hidden lg:block"}>
          <TaskForm draft={draft} running={running} onDraft={setDraft} onRun={(text) => void runTask(text)} />
        </div>
        <div className={pane === "map" ? "block" : "hidden lg:block"}>
          <StepMap
            board={board}
            copied={copied}
            onCopy={() => {
              void copyChecklist();
            }}
          />
        </div>
        <div className={pane === "models" ? "block" : "hidden lg:block"}>
          <RouterPanel board={board} />
        </div>
      </main>

      <footer className="mx-auto max-w-6xl space-y-1 px-4 pb-8 text-xs text-muted-foreground">
        <p>
          Nemotron Nano plans the questions and writes the Hindi and English checklist. Tavily searches official
          domains and extracts the top pages. Nemotron Super settles conflicts. Ultra runs only if Super is unavailable.
        </p>
        <p>A quoted line can still be out of date. Open the page before you pay or travel.</p>
      </footer>
    </div>
  );
}