// Fixed-window rate limiting: one counter per hour, stored in Workers KV.
// KV is eventually consistent, so this isn't perfectly atomic under
// concurrent requests -- but it's sufficient as a cost backstop for a
// low-traffic personal tool. The goal is capping runaway/scripted abuse
// of a leaked or scraped shared secret, not precise per-second limiting.
export function rateLimitKeyForHour(date = new Date()) {
  return `ratelimit:${date.toISOString().slice(0, 13)}`;
}

export function isOverLimit(currentCount, limit) {
  return currentCount >= limit;
}
