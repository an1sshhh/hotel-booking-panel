/** Maps a domain status to a badge variant so every screen colours it identically. */
const MAP: Record<string, string> = {
  // hotels / rooms / generic
  active: 'badge-success',
  published: 'badge-success',
  completed: 'badge-success',
  captured: 'badge-success',
  confirmed: 'badge-brand',
  draft: 'badge-warning',
  pending: 'badge-warning',
  processing: 'badge-warning',
  authorized: 'badge-info',
  maintenance: 'badge-warning',
  checked_in: 'badge-info',
  checked_out: 'badge-success',
  inactive: 'badge-neutral',
  hidden: 'badge-neutral',
  blocked: 'badge-danger',
  disabled: 'badge-neutral',
  suspended: 'badge-danger',
  cancelled: 'badge-danger',
  failed: 'badge-danger',
  refunded: 'badge-neutral',
  partially_refunded: 'badge-info',
};

export function statusBadgeClass(status: string): string {
  return MAP[status] ?? 'badge-neutral';
}

/** "checked_in" -> "checked in" for display. */
export function humanize(value: string): string {
  return (value || '').replace(/_/g, ' ');
}

/** "Jane Doe" -> "JD", for avatar badges. */
export function initials(name: string | null | undefined, fallback = '?'): string {
  return (name || fallback).split(' ').map((p) => p[0]).slice(0, 2).join('');
}
