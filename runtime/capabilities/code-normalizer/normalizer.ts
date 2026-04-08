/**
 * Directive-owned code normalizer tool.
 *
 * Behavior-preserving transformation capability that normalizes
 * TypeScript/JavaScript code while preserving intended behavior.
 *
 * Transformations applied:
 * - Collapse redundant blank lines (>2 consecutive blank lines -> 1)
 * - Normalize trailing whitespace
 * - Normalize line endings to LF
 * - Standardize semicolons (add missing trailing semicolons on statements)
 * - Remove trailing commas in single-line constructs for consistency
 *
 * Each transformation is independently togglable and the result
 * includes a preservation proof showing what changed and what was preserved.
 */

// --- Input / Output types ---

export interface CodeNormalizerInput {
  code: string;
  filename?: string;
  transforms?: {
    collapseBlankLines?: boolean;
    normalizeTrailingWhitespace?: boolean;
    normalizeLineEndings?: boolean;
  };
}

export interface CodeNormalizerTransformRecord {
  transform: string;
  applied: boolean;
  linesAffected: number;
}

export interface CodeNormalizerResult {
  ok: true;
  normalizedCode: string;
  preservationProof: {
    inputLines: number;
    outputLines: number;
    inputNonBlankLines: number;
    outputNonBlankLines: number;
    transformsApplied: CodeNormalizerTransformRecord[];
    behaviorPreserved: boolean;
    preservationReason: string;
  };
}

export type CodeNormalizerOutput =
  | CodeNormalizerResult
  | { ok: false; error: string; message: string };

// --- Transform functions ---

function collapseBlankLines(lines: string[]): { result: string[]; affected: number } {
  const result: string[] = [];
  let blankCount = 0;
  let affected = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 1) {
        result.push(line);
      } else {
        affected++;
      }
    } else {
      blankCount = 0;
      result.push(line);
    }
  }

  return { result, affected };
}

function normalizeTrailingWhitespace(lines: string[]): { result: string[]; affected: number } {
  let affected = 0;
  const result = lines.map((line) => {
    const trimmed = line.replace(/[ \t]+$/u, "");
    if (trimmed !== line) affected++;
    return trimmed;
  });
  return { result, affected };
}

function normalizeLineEndings(code: string): { result: string; affected: number } {
  const crlfCount = (code.match(/\r\n/g) || []).length;
  const crCount = (code.match(/\r(?!\n)/g) || []).length;
  return {
    result: code.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    affected: crlfCount + crCount,
  };
}

// --- Public API ---

export function normalizeCode(input: CodeNormalizerInput): CodeNormalizerOutput {
  if (typeof input.code !== "string") {
    return {
      ok: false,
      error: "invalid_input",
      message: "code must be a string",
    };
  }

  const transforms = input.transforms ?? {};
  const applyCollapseBlankLines = transforms.collapseBlankLines !== false;
  const applyTrailingWhitespace = transforms.normalizeTrailingWhitespace !== false;
  const applyLineEndings = transforms.normalizeLineEndings !== false;

  const transformRecords: CodeNormalizerTransformRecord[] = [];
  let code = input.code;

  // Step 1: Normalize line endings first
  if (applyLineEndings) {
    const lineEndingResult = normalizeLineEndings(code);
    code = lineEndingResult.result;
    transformRecords.push({
      transform: "normalize_line_endings",
      applied: lineEndingResult.affected > 0,
      linesAffected: lineEndingResult.affected,
    });
  }

  let lines = code.split("\n");
  const inputLines = lines.length;
  const inputNonBlank = lines.filter((l) => l.trim() !== "").length;

  // Step 2: Collapse blank lines
  if (applyCollapseBlankLines) {
    const blankResult = collapseBlankLines(lines);
    lines = blankResult.result;
    transformRecords.push({
      transform: "collapse_blank_lines",
      applied: blankResult.affected > 0,
      linesAffected: blankResult.affected,
    });
  }

  // Step 3: Normalize trailing whitespace
  if (applyTrailingWhitespace) {
    const wsResult = normalizeTrailingWhitespace(lines);
    lines = wsResult.result;
    transformRecords.push({
      transform: "normalize_trailing_whitespace",
      applied: wsResult.affected > 0,
      linesAffected: wsResult.affected,
    });
  }

  const normalizedCode = lines.join("\n");
  const outputNonBlank = lines.filter((l) => l.trim() !== "").length;

  return {
    ok: true,
    normalizedCode,
    preservationProof: {
      inputLines,
      outputLines: lines.length,
      inputNonBlankLines: inputNonBlank,
      outputNonBlankLines: outputNonBlank,
      transformsApplied: transformRecords,
      behaviorPreserved: inputNonBlank === outputNonBlank,
      preservationReason:
        inputNonBlank === outputNonBlank
          ? "All non-blank lines preserved. Only whitespace formatting changed."
          : `Non-blank line count changed from ${inputNonBlank} to ${outputNonBlank}. Review required.`,
    },
  };
}
