export function normalizeSearch(search?: string): string | undefined {
  const value = search?.trim();
  if (!value) return undefined;
  return `%${value}%`;
}

export function addTextSearchCondition(
  conditions: string[],
  values: unknown[],
  search: string | undefined,
  columns: string[],
): void {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch || columns.length === 0) {
    return;
  }

  const placeholder = `$${values.length + 1}`;
  conditions.push(`(${columns.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`);
  values.push(normalizedSearch);
}
