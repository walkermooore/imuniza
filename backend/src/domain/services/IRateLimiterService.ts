export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface IRateLimiterService {
  check(key: string): RateLimitResult;
}
