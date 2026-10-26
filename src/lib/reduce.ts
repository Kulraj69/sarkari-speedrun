import type { BoardState, PipelineEvent } from "@/lib/types";

export function createBoardState(): BoardState {
  return {
    status: "idle",
    mode: null,
    sample: false,
    task: "",
    city: "",
    fixtureId: null,
    questions: [],
    evidenceByQuestion: {},
    items: [],
    checklist: null,
    traces: [],
    error: null,
  };
}

export function beginRun(): BoardState {
  return { ...createBoardState(), status: "running" };
}

export function applyEvent(state: BoardState, event: PipelineEvent): BoardState {
  switch (event.type) {
    case "meta":
      return {
        ...state,
        status: "running",
        mode: event.mode,
        sample: event.sample,
        task: event.task,
        city: event.city,
        fixtureId: event.fixtureId,
        error: null,
      };
    case "trace":
      return {
        ...state,
        status: state.status === "idle" ? "running" : state.status,
        traces: [...state.traces, event.trace],
      };
    case "plan":
      return { ...state, questions: event.questions };
    case "evidence":
      return {
        ...state,
        evidenceByQuestion: { ...state.evidenceByQuestion, [event.questionId]: event.evidence },
      };
    case "item": {
      const index = state.items.findIndex((item) => item.id === event.item.id);
      if (index === -1) return { ...state, items: [...state.items, event.item] };
      const items = state.items.slice();
      items[index] = event.item;
      return { ...state, items };
    }
    case "checklist":
      return { ...state, checklist: event.checklist };
    case "error":
      return { ...state, status: "error", error: event.message };
    case "done":
      return { ...state, status: state.error ? "error" : "done" };
    default:
      return state;
  }
}