"use client";

import { DEMO_TASKS } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface TaskFormProps {
  draft: string;
  running: boolean;
  onDraft: (value: string) => void;
  onRun: (text: string) => void;
}

export function TaskForm({ draft, running, onDraft, onRun }: TaskFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          data-testid="task-input"
          value={draft}
          placeholder="renew passport, Patiala"
          rows={3}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onRun(draft);
            }
          }}
        />
        <Button type="button" data-testid="run-button" disabled={running || draft.trim().length === 0} onClick={() => onRun(draft)}>
          {running ? "Mapping…" : "Map the steps"}
        </Button>
        <div className="flex flex-wrap gap-2">
          {DEMO_TASKS.map((task) => (
            <Button
              key={task.id}
              type="button"
              variant="outline"
              size="sm"
              data-testid={`demo-${task.id}`}
              disabled={running}
              onClick={() => onRun(task.text)}
            >
              {task.title}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Five cached demos run with no keys. Any other task stays an empty map until both API keys are set.
        </p>
      </CardContent>
    </Card>
  );
}