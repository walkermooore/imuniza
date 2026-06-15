import { Request, Response, NextFunction } from 'express';
import { ITokenService } from '@domain/services/ITokenService';
import { fail } from '@interface/helpers/response';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      fail(res, 'Missing or invalid authorization header', 401);
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = tokenService.verify(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
      next();
    } catch {
      fail(res, 'Invalid or expired token', 401);
    }
  };
}
