import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';
import { PagedResult } from '../bookings/booking.service';

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  total_bookings?: number;
  total_spent?: number;
  last_booking?: string;
  bookings?: any[];
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly baseUrl = `${environment.apiUrl}/api/customers`;

  constructor(private http: HttpClient) {}

  list(params: Record<string, string> = {}): Observable<PagedResult<Customer>> {
    return this.http.get<PagedResult<Customer>>(`${this.baseUrl}${toQuery(params)}`);
  }

  get(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }

  create(payload: { name: string; email: string; phone?: string }): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl, payload);
  }

  setStatus(id: number, status: string): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/${id}/status`, { status });
  }
}
