export type RateLimiterConfig = {
  requestsPerMinute: number;
  burst: number;
  now?: () => number;
};

export type RateLimiterDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  consume(key: string): RateLimiterDecision;
};

type BucketState = {
  tokens: number;
  lastRefillAt: number;
};

function assertRateLimiterConfig(config: RateLimiterConfig) {
  if (
    !Number.isInteger(config.requestsPerMinute)
    || config.requestsPerMinute < 1
  ) {
    throw new Error("rate_limit_requests_per_minute_invalid");
  }

  if (!Number.isInteger(config.burst) || config.burst < 0) {
    throw new Error("rate_limit_burst_invalid");
  }
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  assertRateLimiterConfig(config);

  const now = config.now ?? Date.now;
  const refillRatePerMs = config.requestsPerMinute / 60_000;
  // Classic token-bucket shape: burst is the maximum saved capacity, and the
  // refill rate is the steady-state requests/minute. This preserves the
  // required sliding-window bound of `requestsPerMinute + burst`; using
  // `requestsPerMinute + burst` as the saved capacity would exceed that bound
  // after an idle refill.
  const bucketCapacity = config.burst;
  const buckets = new Map<string, BucketState>();

  function readBucket(key: string, at: number) {
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }
    const created: BucketState = {
      tokens: config.burst,
      lastRefillAt: at,
    };
    buckets.set(key, created);
    return created;
  }

  return {
    consume(key: string): RateLimiterDecision {
      const at = now();
      const bucket = readBucket(key, at);
      const elapsedMs = Math.max(0, at - bucket.lastRefillAt);
      bucket.tokens = Math.min(
        bucketCapacity,
        bucket.tokens + elapsedMs * refillRatePerMs,
      );
      bucket.lastRefillAt = at;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
      }

      const retryAfterMs = (1 - bucket.tokens) / refillRatePerMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    },
  };
}
