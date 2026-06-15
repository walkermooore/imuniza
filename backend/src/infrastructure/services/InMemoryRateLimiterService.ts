import { IRateLimiterService, RateLimitResult } from '@domain/services/IRateLimiterService';

interface WindowEntry {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export class InMemoryRateLimiterService implements IRateLimiterService {
  private readonly store = new Map<string, WindowEntry>();

  constructor(private readonly options: RateLimiterOptions) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const { maxRequests, windowMs } = this.options;
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowMs),
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.windowStart + windowMs),
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: new Date(entry.windowStart + windowMs),
    };
  }
}
