import { Buffer } from "node:buffer";

export type SanitizeTextOptions = {
  /** Field name used in error messages, e.g. "candidateName". */
  fieldName: string;
  /** Hard byte cap (UTF-8) on the post-strip string length. */
  maxBytes: number;
};

/**
 * Named UTF-8 byte limits for the kernel's API free-text fields. These map
 * one-to-one to the `maxLength` constraints declared in the request schemas
 * under `shared/schemas/`.
 */
export const TEXT_FIELD_LIMITS = {
  candidateName: 200,
  sourceTitle: 200,
  sourceReference: 2000,
  missionAlignment: 5000,
  goalStatement: 5000,
  rationale: 5000,
  missionPreviewMarkdown: 50000,
} as const;

/**
 * Strip C0 control characters (except U+0009 tab, U+000A LF, U+000D CR) and
 * U+007F DEL from the input, then assert that the resulting string fits in
 * `options.maxBytes` UTF-8 bytes. The byte cap is checked AFTER stripping so
 * it bounds the persisted size, not the raw input size.
 *
 * Throws `TypeError("sanitize_invalid_type:<fieldName>")` when called with a
 * non-string. Throws `Error("sanitize_too_long:<fieldName>:<byteLength>")`
 * when the post-strip string exceeds the cap.
 *
 * Iteration is by Unicode code point (not UTF-16 code unit) so surrogate
 * pairs (e.g. emoji) are preserved as a single character.
 */
export function sanitizeText(
  value: string,
  options: SanitizeTextOptions,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`sanitize_invalid_type:${options.fieldName}`);
  }

  let stripped = "";
  for (const codepoint of value) {
    const cp = codepoint.codePointAt(0) ?? 0;
    if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) {
      continue;
    }
    if (cp === 0x7f) {
      continue;
    }
    stripped += codepoint;
  }

  const byteLength = Buffer.byteLength(stripped, "utf8");
  if (byteLength > options.maxBytes) {
    throw new Error(
      `sanitize_too_long:${options.fieldName}:${byteLength}`,
    );
  }

  return stripped;
}
