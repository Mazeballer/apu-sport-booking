// Very small in-memory sliding window limiter
// Good for single region servers. For multi region, use Redis (snippet below).
type Bucket = { hits: number[] }; // unix ms timestamps
const store = new Map<string, Bucket>();

export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number; // allowed hits
  windowMs: number; // window in ms
}) {
  const now = Date.now();
  const b = store.get(key) ?? { hits: [] };
  // keep only hits inside window
  b.hits = b.hits.filter((ts) => now - ts < windowMs);
  const allowed = b.hits.length < limit;
  if (allowed) {
    b.hits.push(now);
    store.set(key, b);
  }
  const remaining = Math.max(0, limit - b.hits.length);
  const reset = windowMs - (now - (b.hits[0] ?? now));
  return { allowed, remaining, reset };
}
