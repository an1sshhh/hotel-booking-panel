import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  role_name: string | null;
  status: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly baseUrl = `${environment.apiUrl}/api/admin-users`;

  constructor(private http: HttpClient) {}

  list(): Observable<AdminUserRow[]> {
    return this.http.get<AdminUserRow[]>(this.baseUrl);
  }

  create(payload: { name: string; email: string; password: string; roleId?: number }): Observable<AdminUserRow> {
    return this.http.post<AdminUserRow>(this.baseUrl, payload);
  }

  update(id: number, payload: { roleId?: number; status?: string }): Observable<AdminUserRow> {
    return this.http.put<AdminUserRow>(`${this.baseUrl}/${id}`, payload);
  }

  listRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.baseUrl}/roles`);
  }

}
