import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'admin_token';
  private readonly userKey = 'admin_user';

  constructor(private http: HttpClient) {}

  /** Self-signup stays open only until an admin with a real mailbox exists. */
  signupStatus(): Observable<{ open: boolean }> {
    return this.http.get<{ open: boolean }>(`${environment.apiUrl}/api/auth/admin/signup-status`);
  }

  signup(name: string, email: string, password: string): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${environment.apiUrl}/api/auth/admin/signup`, { name, email, password });
  }

  requestOtp(email: string, password: string): Observable<{ email: string }> {
    return this.http.post<{ email: string }>(`${environment.apiUrl}/api/auth/admin/login`, { email, password });
  }

  verifyOtp(email: string, otp: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/admin/verify-otp`, { email, otp }).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.userKey, JSON.stringify(res.user));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): AdminUser | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
