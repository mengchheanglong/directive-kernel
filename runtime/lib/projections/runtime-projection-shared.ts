import fs from "node:fs";
import path from "node:path";

export function renderDirectiveProjectionListOrPlaceholder(values: string[], placeholder = "  - n/a") {
  if (values.length === 0) {
    return placeholder;
  }
  return values.map((value) => `  - ${value}`).join("\n");
}

export function writeDirectiveProjectionUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export function sortDirectiveProjectionEvents<T extends { sequence: number; occurredAt: string }>(events: T[]) {
  return [...events].sort((left, right) =>
    left.sequence - right.sequence || left.occurredAt.localeCompare(right.occurredAt),
  );
}
