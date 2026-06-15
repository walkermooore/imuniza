export interface PaginationParams {
  page: number;
  page_size: number;
  search?: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildMeta(page: number, page_size: number, total: number): PaginationMeta {
  const total_pages = Math.ceil(total / page_size);
  return {
    page,
    page_size,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}
