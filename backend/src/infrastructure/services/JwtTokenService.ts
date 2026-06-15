import jwt from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '@domain/services/ITokenService';
import { env } from '@main/config/env';

export class JwtTokenService implements ITokenService {
  generate(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  verify(token: string): TokenPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return decoded as TokenPayload;
  }
}
