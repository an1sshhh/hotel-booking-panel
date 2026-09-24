import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_booking_amount: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  per_customer_limit: number | null;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class CouponService {
  private readonly baseUrl = `${environment.apiUrl}/api/coupons`;

  constructor(private http: HttpClient) {}

  list(active?: boolean): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(`${this.baseUrl}${active !== undefined ? '?active=' + active : ''}`);
  }

  create(payload: any): Observable<Coupon> {
    return this.http.post<Coupon>(this.baseUrl, payload);
  }

  update(id: number, payload: any): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
