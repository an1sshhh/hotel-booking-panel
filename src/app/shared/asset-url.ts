import { environment } from '../../environments/environment';

/** Stored image URLs are absolute (Supabase Storage) when hosted, or /uploads/... paths served by the local API. */
export function assetUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${environment.apiUrl}${path}`;
}
