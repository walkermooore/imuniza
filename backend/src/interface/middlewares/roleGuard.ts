import { Request, Response, NextFunction } from 'express';
import { fail } from '@interface/helpers/response';

export function roleGuard(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      fail(res, 'Forbidden: insufficient permissions', 403);
      return;
    }
    next();
  };
}
