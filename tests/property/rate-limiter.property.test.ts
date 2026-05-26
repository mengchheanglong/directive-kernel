import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createRateLimiter } from "../../hosts/standalone-host/rate-limiter.ts";

function cumulativeTimestamps(deltas: readonly number[]) {
  let current = 0;
  return deltas.map((delta) => {
    current += delta;
    return current;
  });
}

function maxAcceptedInSixtySecondWindow(acceptedAt: readonly number[]) {
  let max = 0;
  let right = 0;
  for (let left = 0; left < acceptedAt.length; left += 1) {
    const windowEnd = acceptedAt[left] + 60_000;
    while (right < acceptedAt.length && acceptedAt[right] < windowEnd) {
      right += 1;
    }
    max = Math.max(max, right - left);
  }
  return max;
}

describe("rate-limiter", () => {
  // Property 8: Rate limiter sliding-window invariant.
  // Design: design.md -> "Correctness Properties -> Property 8".
  // For any positive requestsPerMinute, non-negative burst, and increasing
  // timestamp sequence for one key, accepted requests in any half-open
  // 60-second window are bounded by `requestsPerMinute + burst`.
  // Validates: Requirements 4.3, 4.4, 4.8.
  it("Property 8: accepted requests never exceed requestsPerMinute + burst per 60-second window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        fc.integer({ min: 0, max: 40 }),
        fc.array(fc.integer({ min: 0, max: 10_000 }), {
          minLength: 1,
          maxLength: 300,
        }),
        (requestsPerMinute, burst, deltas) => {
          let virtualNow = 0;
          const limiter = createRateLimiter({
            requestsPerMinute,
            burst,
            now: () => virtualNow,
          });
          const acceptedAt: number[] = [];

          for (const timestamp of cumulativeTimestamps(deltas)) {
            virtualNow = timestamp;
            const decision = limiter.consume("same-token");
            if (decision.allowed) {
              acceptedAt.push(timestamp);
            }
          }

          expect(
            maxAcceptedInSixtySecondWindow(acceptedAt),
          ).toBeLessThanOrEqual(requestsPerMinute + burst);
        },
      ),
      { numRuns: 100 },
    );
  });
});
