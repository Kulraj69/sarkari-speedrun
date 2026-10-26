import type { Metadata } from "next";
import Link from "next/link";
import { GOLD_CHECKS, SMALL_SAMPLE_LABEL } from "@/lib/eval-set";
import { EvalRunner } from "@/components/eval-runner";

export const metadata: Metadata = {
  title: "Sample eval — Sarkari Speedrun",
  description: "A small hand-checked sample of official quotes for five government tasks.",
};

export default function EvalPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-heading text-3xl leading-none">Sample eval</h1>
            <p className="mt-2 text-sm text-muted-foreground">{SMALL_SAMPLE_LABEL}</p>
          </div>
          <Link href="/" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            Back to the map
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each row is a line copied from an official page, with the URL beside it. The score asks whether the run
          still carries that quote. In mock mode the five cached demos are replayed, so the table is not a live
          Nemotron score.
        </p>
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] text-left text-sm" data-testid="eval-gold">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Task</th>
                <th className="px-3 py-2 font-medium">Check</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {GOLD_CHECKS.map((check) => (
                <tr key={check.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 font-medium">{check.task}</td>
                  <td className="px-3 py-3">
                    <p>{check.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">“{check.quote}”</p>
                  </td>
                  <td className="px-3 py-3">
                    <a className="text-primary underline-offset-2 hover:underline" href={check.url} target="_blank" rel="noreferrer">
                      {check.checkedBy}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <EvalRunner />
      </main>
    </div>
  );
}