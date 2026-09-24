import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Payment {
  id: number;
  booking_id: number;
  customer_name: string;
  hotel_name: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transaction_ref: string;
  gateway_ref: string;
  created_at: string;
  refunds?: Refund[];
}

export interface Refund {
  id: number;
  payment_id: number;
  booking_id: number;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly baseUrl = `${environment.apiUrl}/api/payments`;

  constructor(private http: HttpClient) {}

  list(status?: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.baseUrl}${status ? '?status=' + status : ''}`);
  }

  get(id: number): Observable<Payment> {
    return this.http.get<Payment>(`${this.baseUrl}/${id}`);
  }

  createRefund(paymentId: number, amount: number, reason: string): Observable<Refund> {
    return this.http.post<Refund>(`${this.baseUrl}/${paymentId}/refunds`, { amount, reason });
  }

}
