import type { PaginatedMeta } from '../types'

/**
 * Slices an in-memory array following the same PaginatedMeta contract used by
 * the real API.  Keeps client-side tables consistent with server-paginated ones
 * until the underlying endpoints are integrated.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { data: T[]; meta: PaginatedMeta } {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  const start = (clampedPage - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    meta: {
      page: clampedPage,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_next: clampedPage < totalPages,
      has_prev: clampedPage > 1,
    },
  }
}
