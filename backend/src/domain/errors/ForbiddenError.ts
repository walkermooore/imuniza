export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Forbidden: insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
