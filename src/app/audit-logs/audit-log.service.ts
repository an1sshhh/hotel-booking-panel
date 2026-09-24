import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditLog {
  id: number;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value: any;
  after_value: any;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly baseUrl = `${environment.apiUrl}/api/audit-logs`;

  constructor(private http: HttpClient) {}

  list(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.baseUrl);
  }
}
