import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';

export type Audience = 'guest' | 'admin';

export interface EmailTemplateSummary {
  key: string;
  kind: 'email' | 'layout';
  audience: Audience;
  name: string;
  description: string | null;
  subject: string | null;
  is_enabled: boolean;
  is_custom: boolean;
  required: boolean;
  /** Soft-deleted: hidden from the main list, never sent, restorable. */
  deleted: boolean;
  /** False for the admin login code and layouts, which the platform can't work without. */
  deletable: boolean;
  updated_at: string;
  stats: { sent: number; failed: number };
}

export interface EmailTemplate extends Omit<EmailTemplateSummary, 'stats' | 'deleted' | 'deletable'> {
  html: string;
}

export interface EmailPreview {
  subject: string;
  html: string;
  text: string;
}

export interface OutboxRow {
  id: number;
  template_key: string;
  to_email: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  last_error: string | null;
  subject: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  send_after: string;
  sent_at: string | null;
  created_at: string;
}

export interface OutboxPage {
  data: OutboxRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<OutboxRow['status'], number>>;
}

export interface OutboxView {
  subject: string;
  html: string;
  text: string;
  to: string;
  status: string;
  note: string;
}

export interface TemplateDraft {
  subject?: string;
  html?: string;
  name?: string;
  isEnabled?: boolean;
}

export interface EmailSettings {
  adminRecipients: string[];
  guestFromName: string;
  adminFromName: string;
  replyTo: string;
  mailConfigured: boolean;
  senderAddress: string | null;
  siteUrl: string;
  supportEmail: string;
}

@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  private readonly baseUrl = `${environment.apiUrl}/api/email-templates`;

  constructor(private http: HttpClient) {}

  list(): Observable<EmailTemplateSummary[]> {
    return this.http.get<EmailTemplateSummary[]>(this.baseUrl);
  }

  get(key: string): Observable<EmailTemplate> {
    return this.http.get<EmailTemplate>(`${this.baseUrl}/${key}`);
  }

  create(payload: { name: string; audience: Audience; duplicateFrom?: string | null }): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(this.baseUrl, payload);
  }

  update(key: string, payload: TemplateDraft): Observable<EmailTemplate> {
    return this.http.put<EmailTemplate>(`${this.baseUrl}/${key}`, payload);
  }

  remove(key: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${key}`);
  }

  restore(key: string): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(`${this.baseUrl}/${key}/restore`, {});
  }

  preview(key: string, draft: { subject?: string | null; html?: string }): Observable<EmailPreview> {
    return this.http.post<EmailPreview>(`${this.baseUrl}/${key}/preview`, draft);
  }

  /** Queues a custom template for real recipients and/or a booking's guest. */
  send(key: string, payload: { recipients?: string; bookingId?: number | null }): Observable<{ queued: number; skipped: string[] }> {
    return this.http.post<{ queued: number; skipped: string[] }>(`${this.baseUrl}/${key}/send`, payload);
  }

  reset(key: string): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(`${this.baseUrl}/${key}/reset`, {});
  }

  /** Sends the given draft (or the saved version when omitted) with sample data. */
  sendTest(key: string, to: string, draft: { subject?: string; html?: string } = {}): Observable<{ to: string; subject: string }> {
    return this.http.post<{ to: string; subject: string }>(`${this.baseUrl}/${key}/test`, { to, ...draft });
  }

  outbox(params: Record<string, string | number> = {}): Observable<OutboxPage> {
    return this.http.get<OutboxPage>(`${this.baseUrl}/outbox${toQuery(params)}`);
  }

  viewOutbox(id: number): Observable<OutboxView> {
    return this.http.get<OutboxView>(`${this.baseUrl}/outbox/${id}`);
  }

  retry(id: number): Observable<OutboxRow> {
    return this.http.post<OutboxRow>(`${this.baseUrl}/outbox/${id}/retry`, {});
  }

  getSettings(): Observable<EmailSettings> {
    return this.http.get<EmailSettings>(`${this.baseUrl}/settings`);
  }

  saveSettings(payload: {
    adminRecipients: string[] | string;
    guestFromName?: string;
    adminFromName?: string;
    replyTo?: string;
  }): Observable<EmailSettings> {
    return this.http.put<EmailSettings>(`${this.baseUrl}/settings`, payload);
  }
}
