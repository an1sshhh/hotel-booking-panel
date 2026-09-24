import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type OfferTheme = 'beach' | 'mountains' | 'city' | 'heritage' | 'forest' | 'festive';

export interface Offer {
  id: number;
  title: string;
  subtitle: string | null;
  badge: string | null;
  terms: string | null;
  coupon_id: number | null;
  image_url: string | null;
  theme: OfferTheme;
  cta_label: string | null;
  cta_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  show_at_checkout: boolean;
  sort_order: number;
  coupon_code: string | null;
  coupon_discount_type: 'percentage' | 'fixed' | null;
  coupon_discount_value: string | null;
  coupon_min_booking_amount: string | null;
  coupon_max_discount: string | null;
  status: { key: 'live' | 'scheduled' | 'expired' | 'hidden' | 'coupon_unavailable'; label: string };
}

export interface OfferPayload {
  title?: string;
  subtitle?: string | null;
  badge?: string | null;
  terms?: string | null;
  couponId?: number | null;
  theme?: OfferTheme;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
  showAtCheckout?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class OfferService {
  private readonly baseUrl = `${environment.apiUrl}/api/offers`;

  constructor(private http: HttpClient) {}

  list(): Observable<Offer[]> {
    return this.http.get<Offer[]>(this.baseUrl);
  }

  create(payload: OfferPayload): Observable<Offer> {
    return this.http.post<Offer>(this.baseUrl, payload);
  }

  update(id: number, payload: OfferPayload): Observable<Offer> {
    return this.http.put<Offer>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  uploadImage(id: number, file: File): Observable<Offer> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<Offer>(`${this.baseUrl}/${id}/image`, form);
  }

  removeImage(id: number): Observable<Offer> {
    return this.http.delete<Offer>(`${this.baseUrl}/${id}/image`);
  }

  imageUrl(path: string | null): string | null {
    return path ? `${environment.apiUrl}${path}` : null;
  }
}
