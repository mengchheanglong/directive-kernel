import { Buffer } from "node:buffer";
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { sanitizeText } from "../../shared/lib/text-sanitizer.ts";

// Property tests for `shared/lib/text-sanitizer.ts`. Each `it` corresponds
// to a numbered security correctness property.

function isStrippedControl(codePoint: number) {
  return (
    (codePoint < 0x20
      && codePoint !== 0x09
      && codePoint !== 0x0a
      && codePoint !== 0x0d)
    || codePoint === 0x7f
  );
}

function stripControls(value: string) {
  let stripped = "";
  for (const codePointText of value) {
    const codePoint = codePointText.codePointAt(0) ?? 0;
    if (!isStrippedControl(codePoint)) {
      stripped += codePointText;
    }
  }
  return stripped;
}

const fieldNameArb = fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/);

describe("text-sanitizer", () => {
  // Property 5: Text sanitizer strip-and-preserve.
  // Design: design.md -> "Correctness Properties -> Property 5".
  // For any string, the output equals the input with exactly the strip-set
  // code points removed and every other code point preserved in order.
  // Validates: Requirements 6.2, 6.3, 6.5.
  it("Property 5: removes exactly stripped controls and preserves all other code points", () => {
    fc.assert(
      fc.property(fc.string(), fieldNameArb, (value, fieldName) => {
        const expected = stripControls(value);
        const output = sanitizeText(value, {
          fieldName,
          maxBytes: Buffer.byteLength(expected, "utf8"),
        });
        expect(output).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Property 6: Text sanitizer length cap.
  // Design: design.md -> "Correctness Properties -> Property 6".
  // For any string whose UTF-8 byte length after stripping exceeds
  // `options.maxBytes`, the sanitizer throws `sanitize_too_long:`.
  // Validates: Requirement 6.4.
  it("Property 6: rejects post-strip text whose UTF-8 byte length exceeds maxBytes", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fieldNameArb,
        fc.integer({ min: 0, max: 500 }),
        (value, fieldName, maxBytes) => {
          const stripped = stripControls(value);
          const byteLength = Buffer.byteLength(stripped, "utf8");
          if (byteLength <= maxBytes) {
            fc.pre(false);
            return;
          }
          expect(() =>
            sanitizeText(value, { fieldName, maxBytes }),
          ).toThrow(new RegExp(`^sanitize_too_long:${fieldName}:`));
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 7: Text sanitizer idempotence.
  // Design: design.md -> "Correctness Properties -> Property 7".
  // For any string and options that accept the first sanitization pass,
  // `sanitizeText(sanitizeText(x, o), o)` deep-equals `sanitizeText(x, o)`.
  // Validates: Requirement 6.9.
  it("Property 7: sanitizeText(sanitizeText(x, o), o) deep-equals sanitizeText(x, o)", () => {
    fc.assert(
      fc.property(fc.string(), fieldNameArb, (value, fieldName) => {
        const stripped = stripControls(value);
        const options = {
          fieldName,
          maxBytes: Buffer.byteLength(stripped, "utf8"),
        };
        const once = sanitizeText(value, options);
        const twice = sanitizeText(once, options);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });
});
