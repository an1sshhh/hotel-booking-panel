import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly baseUrl = `${environment.apiUrl}/api/notifications`;

  constructor(private http: HttpClient) {}

  list(unreadOnly = false): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.baseUrl}${unreadOnly ? '?unreadOnly=true' : ''}`);
  }

  markRead(id: number): Observable<AppNotification> {
    return this.http.put<AppNotification>(`${this.baseUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/read-all`, {});
  }
}
