export function requireRuntimeWriterString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

export function optionalRuntimeWriterString(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRuntimeWriterList(values?: string[] | null) {
  return (values ?? [])
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export function renderRuntimeWriterList(
  values: string[],
  options?: {
    placeholder?: string;
    bulletPrefix?: string;
  },
) {
  const placeholder = options?.placeholder ?? "n/a";
  const bulletPrefix = options?.bulletPrefix ?? "  - ";
  if (values.length === 0) {
    return `${bulletPrefix}${placeholder}`;
  }
  return values.map((value) => `${bulletPrefix}${value}`).join("\n");
}
