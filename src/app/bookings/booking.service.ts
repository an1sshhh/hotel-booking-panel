import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';

export interface Refund {
  id: number;
  payment_id: number;
  amount: number;
  reason: string;
  status: string;
  gateway_refund_id?: string | null;
  created_at: string;
}

export interface CancellationQuote {
  bookingId: number;
  canCancel: boolean;
  daysBeforeCheckIn: number;
  refundPercent: number;
  rule: string;
  paidAmount: number;
  suggestedRefund: number;
  slabs: { days_before_checkin: number; refund_percent: number }[];
}

export interface Booking {
  id: number;
  booking_ref?: string;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  special_requests?: string | null;
  hold_expires_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  hotel_id: number;
  hotel_name: string;
  hotel_address?: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  room_type_id: number;
  room_type_name: string;
  rate_plan_id: number;
  rate_plan_name?: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  num_rooms: number;
  room_price: number;
  tax_amount: number;
  fee_amount: number;
  discount_amount: number;
  total_amount: number;
  booking_status: string;
  payment_status: string;
  created_at: string;
  payments?: any[];
  refunds?: Refund[];
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly baseUrl = `${environment.apiUrl}/api/bookings`;

  constructor(private http: HttpClient) {}

  list(params: Record<string, string> = {}): Observable<PagedResult<Booking>> {
    return this.http.get<PagedResult<Booking>>(`${this.baseUrl}${toQuery(params)}`);
  }

  get(id: number): Observable<Booking> {
    return this.http.get<Booking>(`${this.baseUrl}/${id}`);
  }

  updateStatus(id: number, status: string): Observable<Booking> {
    return this.http.put<Booking>(`${this.baseUrl}/${id}/status`, { status });
  }

  cancellationQuote(id: number): Observable<CancellationQuote> {
    return this.http.get<CancellationQuote>(`${this.baseUrl}/${id}/cancellation-quote`);
  }

  cancel(id: number, reason: string, refundAmount: number): Observable<{ booking: Booking; refundAmount: number }> {
    return this.http.post<{ booking: Booking; refundAmount: number }>(`${this.baseUrl}/${id}/cancel`, { reason, refundAmount });
  }
}
