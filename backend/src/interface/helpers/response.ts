import { Response } from 'express';
import { PaginatedResult } from '@domain/shared/Pagination';

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function paginated<T>(res: Response, result: PaginatedResult<T>): void {
  res.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export function fail(res: Response, error: string, status: number, details?: unknown): void {
  const body: Record<string, unknown> = { success: false, error };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}
