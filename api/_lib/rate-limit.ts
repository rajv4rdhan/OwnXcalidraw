/**
 * Best-effort in-memory rate limiter for the login endpoint.
 *
 * This state lives on a single warm serverless instance; it is intentionally
 * simple and only meant to slow down brute-force guessing, not to be a
 * distributed guarantee.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const isRateLimited = (
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
};
