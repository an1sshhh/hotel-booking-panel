/**
 * Builds a query string, dropping null/undefined/empty values.
 *
 * `new URLSearchParams({ a: undefined })` stringifies to "a=undefined", which the
 * API then treats as a real filter value — that silently emptied list pages.
 */
export function toQuery(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const asString = String(value).trim();
    if (asString === '' || asString === 'undefined' || asString === 'null') continue;
    search.set(key, asString);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}
