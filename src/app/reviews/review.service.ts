import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';

export interface Review {
  id: number;
  hotel_id: number;
  hotel_name: string;
  customer_name: string;
  rating: number;
  review_text: string;
  status: 'pending' | 'published' | 'hidden';
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly baseUrl = `${environment.apiUrl}/api/reviews`;

  constructor(private http: HttpClient) {}

  list(params: Record<string, string> = {}): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.baseUrl}${toQuery(params)}`);
  }

  approve(id: number): Observable<Review> {
    return this.http.put<Review>(`${this.baseUrl}/${id}/approve`, {});
  }

  hide(id: number): Observable<Review> {
    return this.http.put<Review>(`${this.baseUrl}/${id}/hide`, {});
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
