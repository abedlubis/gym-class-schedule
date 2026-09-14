/**
 * In-memory fixed-window limiter.
 *
 * Correct for a single-instance free tier and nothing more — on two instances
 * each keeps its own counter. That is an accepted limit, not an oversight: the
 * endpoint it guards is a login only the owner uses, and reaching for Redis
 * here would add a paid dependency to stop an attack that has not happened.
 */
type Entry = { count: number; resetAt: number }

export class RateLimiter {
  private hits = new Map<string, Entry>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
    const entry = this.hits.get(key)
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, retryAfter: 0 }
    }
    entry.count++
    if (entry.count > this.max) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
    }
    return { allowed: true, retryAfter: 0 }
  }

  reset(key: string) {
    this.hits.delete(key)
  }

  /** Called opportunistically; the map is tiny and bounded by distinct keys. */
  sweep(now = Date.now()) {
    for (const [key, entry] of this.hits) if (now >= entry.resetAt) this.hits.delete(key)
  }
}
