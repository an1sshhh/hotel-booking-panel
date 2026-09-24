import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';

export type ColumnType = 'text' | 'date' | 'int' | 'money' | 'percent' | 'decimal';
export type Audience = 'internal' | 'partner' | 'guest';

export interface ReportFilter {
  key: string;
  type: 'dateRange' | 'hotel' | 'customer' | 'select' | 'number';
  label: string;
  required?: boolean;
  default?: string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface ReportDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
  audience: Audience;
  audienceLabel: string;
  filters: ReportFilter[];
  defaultRange: string;
  defaultDates: { from: string; to: string };
  maxRangeDays: number | null;
  columns: ReportColumn[];
}

export interface ReportResult {
  key: string;
  params: Record<string, string | number | null>;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  totals: Record<string, any> | null;
  summary: { label: string; value: number | string; type: ColumnType }[];
  chart?: { title: string; type: ColumnType; layout?: 'columns' | 'bars'; data: { label: string; value: number }[] };
  subject?: string;
  note?: string | null;
  truncated?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly baseUrl = `${environment.apiUrl}/api/reports`;

  constructor(private http: HttpClient) {}

  catalog(): Observable<ReportDefinition[]> {
    return this.http.get<ReportDefinition[]>(this.baseUrl);
  }

  run(key: string, params: Record<string, unknown>): Observable<ReportResult> {
    return this.http.get<ReportResult>(`${this.baseUrl}/${key}${toQuery(params)}`);
  }

  /** Downloads the report as a file (the API is authenticated, so a plain link can't be used). */
  download(key: string, params: Record<string, unknown>, format: 'csv' | 'pdf'): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(`${this.baseUrl}/${key}/export${toQuery({ ...params, format })}`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((res: HttpResponse<Blob>) => {
          const disposition = res.headers.get('Content-Disposition') ?? '';
          const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${key}.${format}`;
          return { blob: res.body as Blob, filename };
        })
      );
  }

  /** Daily revenue for the dashboard chart. */
  revenue(from: string, to: string): Observable<{ date: string; revenue: number; bookings: number }[]> {
    return this.run('revenue-summary', { from, to, groupBy: 'day' }).pipe(
      map((r) => r.rows.map((row) => ({ date: row['date'], revenue: row['revenue'], bookings: row['bookings'] })))
    );
  }
}
