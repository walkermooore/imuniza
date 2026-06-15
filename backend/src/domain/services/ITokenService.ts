export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface ITokenService {
  generate(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
