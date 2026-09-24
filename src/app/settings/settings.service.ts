import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TaxRule {
  id: number;
  name: string;
  applies_to: 'tax' | 'service_charge';
  value_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly baseUrl = `${environment.apiUrl}/api/settings`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Record<string, any>> {
    return this.http.get<Record<string, any>>(this.baseUrl);
  }

  update(key: string, value: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/${key}`, value);
  }

  listTaxRules(): Observable<TaxRule[]> {
    return this.http.get<TaxRule[]>(`${this.baseUrl}/tax-rules`);
  }

  createTaxRule(payload: { name: string; appliesTo: string; valueType: string; value: number }): Observable<TaxRule> {
    return this.http.post<TaxRule>(`${this.baseUrl}/tax-rules`, payload);
  }

  updateTaxRule(id: number, payload: { value?: number; active?: boolean }): Observable<TaxRule> {
    return this.http.put<TaxRule>(`${this.baseUrl}/tax-rules/${id}`, payload);
  }
}
