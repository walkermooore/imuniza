import { Request, Response, NextFunction } from 'express';
import { IRateLimiterService } from '@domain/services/IRateLimiterService';
import { fail } from '@interface/helpers/response';

export function createRateLimitMiddleware(rateLimiter: IRateLimiterService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const result = rateLimiter.check(key);

    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
      fail(res, 'Too many requests, please try again later', 429);
      return;
    }

    next();
  };
}
