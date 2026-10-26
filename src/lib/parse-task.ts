export interface ParsedTaskLine {
  task: string;
  city: string;
}

export function parseTaskLine(text: string): ParsedTaskLine {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const comma = trimmed.lastIndexOf(",");
  if (comma > 0 && comma < trimmed.length - 1) {
    const task = trimmed.slice(0, comma).trim();
    const city = trimmed.slice(comma + 1).trim();
    if (task && city) return { task, city };
  }
  return { task: trimmed, city: "" };
}