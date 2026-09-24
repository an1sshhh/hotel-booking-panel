import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, switchMap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Audience,
  EmailSettings,
  EmailTemplate,
  EmailTemplateService,
  EmailTemplateSummary,
  OutboxPage,
  OutboxRow,
  OutboxView,
} from './email-template.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { AuthService } from '../auth/auth.service';
import { humanize, statusBadgeClass } from '../shared/status';

type Tab = 'templates' | 'log' | 'settings';
type LogStatus = '' | OutboxRow['status'];
type TypeFilter = 'all' | 'guest' | 'admin' | 'custom' | 'layout' | 'deleted';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'guest', label: 'Guest emails' },
  { value: 'admin', label: 'Admin emails' },
  { value: 'custom', label: 'Custom' },
  { value: 'layout', label: 'Layouts' },
  { value: 'deleted', label: 'Deleted' },
];

const LOG_STATUSES: { value: LogStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Email Templates</h1>
          <p class="page-subtitle">
            Every email the platform sends, stored in the database and loaded each time an email goes out.
            Guest emails use the website's theme; admin emails use the admin panel's theme.
          </p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" [size]="15" /> New template</button>
        </div>
      </div>

      @if (settings && !settings.mailConfigured) {
        <div class="alert alert-warning" style="margin-bottom: 16px;">
          Email sending isn't configured on the admin server (EMAIL_USER / EMAIL_APP_PASSWORD). Emails will queue up and send once it is.
        </div>
      }

      <div class="tabs">
        <button type="button" class="tab" [class.active]="tab === 'templates'" (click)="switchTab('templates')">Templates <span class="count">{{ countOf('all') }}</span></button>
        <button type="button" class="tab" [class.active]="tab === 'log'" (click)="switchTab('log')">
          Delivery log @if (logCounts.failed) { <span class="count" style="background: var(--danger-50); color: var(--danger-700);">{{ logCounts.failed }} failed</span> }
        </button>
        <button type="button" class="tab" [class.active]="tab === 'settings'" (click)="switchTab('settings')">Settings</button>
      </div>

      <!-- ============================== Templates table ============================== -->
      @if (tab === 'templates') {
        <div class="et-toolbar">
          <div class="et-status-chips">
            @for (f of typeFilters; track f.value) {
              @if (f.value !== 'deleted' || countOf('deleted') || typeFilter === 'deleted') {
                <button type="button" class="et-status" [class.active]="typeFilter === f.value" [class.et-status-muted]="f.value === 'deleted'" (click)="typeFilter = f.value">
                  {{ f.label }} <span>{{ countOf(f.value) }}</span>
                </button>
              }
            }
          </div>
          <div class="et-search">
            <app-icon name="search" [size]="15" />
            <input class="input" type="search" placeholder="Search templates…" [(ngModel)]="search" />
          </div>
        </div>

        @if (listError) {
          <div class="et-error" style="margin-bottom: 12px;">
            <strong>Couldn't load templates</strong><span>{{ listError }}</span>
            <button class="btn btn-secondary btn-sm" (click)="loadList()"><app-icon name="refresh" [size]="14" /> Retry</button>
          </div>
        }

        <div class="table-wrap">
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th class="text-right" title="Sent in the last 30 days">Sent</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (listLoading && !templates.length) {
                  @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                    <tr><td colspan="5"><div class="skeleton skeleton-text" style="height: 16px;"></div></td></tr>
                  }
                }
                @for (t of visibleTemplates; track t.key) {
                  <tr>
                    <td>
                      <button type="button" class="et-name" (click)="openEdit(t.key)">{{ t.name }}</button>
                      <div class="cell-muted et-desc">{{ t.description }}</div>
                    </td>
                    <td>
                      <span class="badge no-dot" [class.badge-brand]="t.audience === 'guest'" [class.badge-neutral]="t.audience === 'admin'">
                        {{ typeLabel(t) }}
                      </span>
                    </td>
                    <td>
                      @if (t.deleted) {
                        <span class="badge badge-neutral">Deleted</span>
                      } @else if (t.kind === 'layout') {
                        <span class="cell-muted">Always used</span>
                      } @else if (t.required) {
                        <span class="badge badge-success">Always on</span>
                      } @else {
                        <label class="switch" [title]="t.is_enabled ? 'Enabled — click to switch off' : 'Off — click to switch on'">
                          <input type="checkbox" [checked]="t.is_enabled" (change)="toggleEnabled(t)" />
                          <span class="switch-track"><span class="switch-thumb"></span></span>
                          <span>{{ t.is_enabled ? 'On' : 'Off' }}</span>
                        </label>
                      }
                    </td>
                    <td class="text-right num">
                      @if (t.kind === 'email' && !t.deleted) {
                        {{ t.stats.sent }}
                        @if (t.stats.failed) { <span style="color: var(--danger-600);"> · {{ t.stats.failed }} failed</span> }
                      } @else { <span class="cell-muted">—</span> }
                    </td>
                    <td class="text-right">
                      <!-- Icon-only, fixed order: Edit and Delete line up in every row; Send exists only for custom emails. -->
                      <div class="et-row-actions">
                        @if (t.deleted) {
                          <button class="et-icon-btn" (click)="restoreTemplate(t)" title="Restore" aria-label="Restore"><app-icon name="refresh" [size]="16" /></button>
                        } @else {
                          @if (t.is_custom) {
                            <button class="et-icon-btn" (click)="openSend(t)" title="Send to recipients" aria-label="Send"><app-icon name="upload" [size]="16" /></button>
                          }
                          <button class="et-icon-btn" (click)="openEdit(t.key)" title="Edit" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
                          <button class="et-icon-btn danger" (click)="deleteTemplate(t)" [disabled]="!t.deletable" aria-label="Delete"
                                  [title]="t.deletable ? 'Delete' : (t.kind === 'layout' ? 'Layouts can’t be deleted — every email of this theme uses it' : 'The login code email can’t be deleted — nobody could sign in without it')">
                            <app-icon name="trash" [size]="16" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  @if (!listLoading) {
                    <tr><td colspan="5"><div class="empty-state"><span class="empty-icon"><app-icon name="mail" [size]="22" /></span>
                      <span class="empty-title">No templates match</span>
                      <span class="empty-text">Try another filter, or create a new template.</span></div></td></tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- ============================== Delivery log ============================== -->
      @if (tab === 'log') {
        <div class="et-toolbar">
          <div class="et-status-chips">
            @for (s of logStatuses; track s.value) {
              <button type="button" class="et-status" [class.active]="logStatus === s.value" (click)="setLogStatus(s.value)">
                {{ s.label }} <span>{{ s.value ? (logCounts[s.value] || 0) : logAll }}</span>
              </button>
            }
          </div>
          <div class="row wrap" style="gap: 8px;">
            <select class="select" style="max-width: 240px;" [(ngModel)]="logTemplate" (ngModelChange)="logPage = 1; loadLog()">
              <option value="">All emails</option>
              @for (t of emails; track t.key) { <option [value]="t.key">{{ t.name }}</option> }
            </select>
            <button class="btn btn-secondary btn-sm" (click)="loadLog()" [disabled]="logLoading"><app-icon name="refresh" [size]="14" /> {{ logLoading ? 'Refreshing…' : 'Refresh' }}</button>
            <span class="cell-muted" style="font-size: 12px;">Auto-refreshes every 10 s</span>
          </div>
        </div>
        @if (logError) {
          <div class="et-error" style="margin-bottom: 12px;"><strong>Couldn't load the delivery log</strong><span>{{ logError }}</span>
            <button class="btn btn-secondary btn-sm" (click)="loadLog()">Retry</button></div>
        }
        <div class="table-wrap">
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>When</th><th>Email</th><th>To</th><th>Subject</th><th>Status</th><th>Details</th><th></th></tr></thead>
              <tbody>
                @for (row of log; track row.id) {
                  <tr>
                    <td class="num cell-muted" style="white-space: nowrap;">{{ (row.sent_at || row.created_at) | date: 'MMM d, h:mm a' }}</td>
                    <td>{{ nameOf(row.template_key) }}</td>
                    <td class="cell-mono">{{ row.to_email }}</td>
                    <td class="cell-muted" style="max-width: 300px;">{{ row.subject || '—' }}</td>
                    <td><span class="badge" [class]="logBadge(row.status)">{{ logLabel(row.status) }}</span></td>
                    <td class="cell-muted" style="max-width: 260px;">
                      @if (row.last_error) { <div>{{ row.last_error }}</div> }
                      @if (row.status === 'pending' && row.attempts) { <div>Attempt {{ row.attempts + 1 }} at {{ row.send_after | date: 'h:mm a' }}</div> }
                      @if (row.related_entity_type === 'booking') { <a [routerLink]="['/bookings', row.related_entity_id]">Booking #{{ row.related_entity_id }}</a> }
                    </td>
                    <td class="text-right" style="white-space: nowrap;">
                      <button class="link-btn" (click)="viewEmail(row)">View</button>
                      @if (row.status === 'failed' || row.status === 'skipped') {
                        <button class="link-btn" style="margin-left: 10px;" (click)="retry(row)">Retry</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7"><div class="empty-state"><span class="empty-icon"><app-icon name="inbox" [size]="22" /></span>
                    <span class="empty-title">{{ logLoading ? 'Loading…' : 'No emails here yet' }}</span>
                    <span class="empty-text">Every email appears here the moment it's queued — with its status, attempts and any error.</span></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (logPages > 1) {
            <div class="row-between" style="padding: 10px 14px; border-top: 1px solid var(--border);">
              <span class="cell-muted">Page {{ logPage }} of {{ logPages }} · {{ logTotal }} emails</span>
              <span class="row" style="gap: 6px;">
                <button class="btn btn-secondary btn-sm" [disabled]="logPage <= 1" (click)="logPage = logPage - 1; loadLog()">‹ Newer</button>
                <button class="btn btn-secondary btn-sm" [disabled]="logPage >= logPages" (click)="logPage = logPage + 1; loadLog()">Older ›</button>
              </span>
            </div>
          }
        </div>
      }

      <!-- ============================== Settings ============================== -->
      @if (tab === 'settings') {
        @if (!settingsDraft) {
          <div class="card"><div class="card-body">
            @if (settingsError) {
              <div class="et-error"><strong>Couldn't load settings</strong><span>{{ settingsError }}</span>
                <button class="btn btn-secondary btn-sm" (click)="loadSettings()">Retry</button></div>
            } @else { <div class="skeleton" style="height: 180px;"></div> }
          </div></div>
        } @else {
          <div class="et-settings">
            <div class="card">
              <div class="card-header"><span class="card-title">Sending preferences</span></div>
              <div class="card-body">
                <div class="form-grid">
                  <div class="field span-2">
                    <label class="field-label">Admin alert recipients</label>
                    <textarea class="textarea" rows="3" [(ngModel)]="settingsDraft.recipients" placeholder="ops@yourhotel.com, owner@yourhotel.com"></textarea>
                    <span class="field-hint">
                      “New booking” and “Refund needed” alerts go to these addresses (comma or new line separated).
                      @if (!settings?.adminRecipients?.length) { <strong style="color: var(--warning-700);">No recipients yet — admin alerts are currently off.</strong> }
                    </span>
                  </div>
                  <div class="field">
                    <label class="field-label">Sender name — guest emails</label>
                    <input class="input" maxlength="60" [(ngModel)]="settingsDraft.guestFromName" />
                  </div>
                  <div class="field">
                    <label class="field-label">Sender name — admin emails</label>
                    <input class="input" maxlength="60" [(ngModel)]="settingsDraft.adminFromName" />
                  </div>
                  <div class="field span-2">
                    <label class="field-label">Reply-to for guest emails</label>
                    <input class="input" type="email" [(ngModel)]="settingsDraft.replyTo" [placeholder]="settings?.supportEmail || ''" />
                    <span class="field-hint">Where guest replies go. Leave empty to use the support address.</span>
                  </div>
                </div>
              </div>
              <div class="modal-footer" style="justify-content: space-between;">
                <span class="cell-muted">
                  @if (settingsSavedAt && !settingsDirty) { <span style="color: var(--success-700);">✓ Saved at {{ settingsSavedAt | date: 'h:mm:ss a' }}</span> }
                  @else if (settingsDirty) { Unsaved changes }
                </span>
                <span class="row" style="gap: 8px;">
                  <button class="btn btn-secondary" (click)="resetSettingsDraft()" [disabled]="busy || !settingsDirty">Discard</button>
                  <button class="btn btn-primary" (click)="saveSettings()" [disabled]="busy || !settingsDirty">{{ busy ? 'Saving…' : 'Save settings' }}</button>
                </span>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Delivery setup</span></div>
              <div class="card-body">
                <dl class="definition-list">
                  <dt>Status</dt>
                  <dd>
                    <span class="badge" [class.badge-success]="settings?.mailConfigured" [class.badge-danger]="!settings?.mailConfigured">
                      {{ settings?.mailConfigured ? 'Ready to send' : 'Not configured' }}
                    </span>
                  </dd>
                  <dt>Sending account</dt><dd class="cell-mono">{{ settings?.senderAddress || '—' }}</dd>
                  <dt>Links point to</dt><dd class="cell-mono">{{ settings?.siteUrl }}</dd>
                  <dt>Support address</dt><dd class="cell-mono">{{ settings?.supportEmail }}</dd>
                  <dt>Emails (all time)</dt>
                  <dd>{{ logCounts.sent || 0 }} sent · {{ logCounts.failed || 0 }} failed · {{ logCounts.pending || 0 }} queued</dd>
                </dl>
                <p class="field-hint" style="margin-top: 12px;">
                  These come from the admin server's .env (EMAIL_USER, EMAIL_APP_PASSWORD, SITE_URL, SUPPORT_EMAIL) and can't be changed here.
                </p>
                <button class="btn btn-secondary btn-sm" style="margin-top: 8px;" (click)="switchTab('log')"><app-icon name="inbox" [size]="14" /> Open delivery log</button>
              </div>
            </div>
          </div>
        }
      }
    </div>

    <!-- ============================== Edit modal: code | preview ============================== -->
    @if (editOpen) {
      <div class="modal-backdrop et-editor-backdrop">
        <div class="et-editor-modal" role="dialog" aria-modal="true" [attr.aria-label]="'Edit ' + (selected?.name || 'template')">
          <div class="et-editor-head">
            @if (selected) {
              <div class="stack" style="gap: 2px; min-width: 0; flex: 1;">
                <div class="row wrap" style="gap: 8px;">
                  @if (selected.is_custom) {
                    <input class="input et-name-input" maxlength="120" [(ngModel)]="draftName" (ngModelChange)="changed()" aria-label="Template name" />
                  } @else {
                    <span class="et-editor-title">{{ selected.name }}</span>
                  }
                  <span class="badge no-dot" [class.badge-brand]="currentAudience === 'guest'" [class.badge-neutral]="currentAudience === 'admin'">
                    {{ currentAudience === 'guest' ? 'Guest · website theme' : 'Admin · admin panel theme' }}
                  </span>
                  @if (dirty) { <span class="badge badge-warning no-dot">Unsaved changes</span> }
                </div>
                <span class="cell-muted et-ellipsis">{{ selected.description }}</span>
              </div>
            } @else {
              <span class="et-editor-title">Loading…</span>
            }
            <button class="btn btn-ghost btn-icon" (click)="closeEdit()" title="Close"><app-icon name="x" [size]="18" /></button>
          </div>

          @if (templateError) {
            <div class="et-error" style="margin: 16px;"><strong>Couldn't open this template</strong><span>{{ templateError }}</span>
              <button class="btn btn-secondary btn-sm" (click)="retryEdit()">Retry</button></div>
          } @else if (selected) {
            <div class="et-editor-body">
              <!-- Left half: code -->
              <section class="et-half et-code-half">
                @if (selected.kind === 'email') {
                  <label class="field-label" for="et-subject">Subject</label>
                  <input id="et-subject" class="input" [(ngModel)]="draftSubject" (ngModelChange)="changed()" />
                }
                <label class="field-label" for="et-html" style="margin-top: 12px;">
                  {{ selected.kind === 'layout' ? 'Layout HTML' : 'HTML' }}
                  <span class="cell-muted" style="font-weight: 400;">· {{ lineCount }} lines</span>
                </label>
                <textarea id="et-html" #codeInput class="et-code" spellcheck="false" [(ngModel)]="draftHtml" (ngModelChange)="changed()" (keydown)="onCodeKey($event)"></textarea>
                @if (previewError) { <div class="alert alert-danger" style="margin-top: 8px; font-size: 12px;">{{ previewError }}</div> }
              </section>

              <!-- Right half: view-only preview -->
              <section class="et-half et-preview-half">
                <div class="et-preview-head">
                  <div class="stack" style="gap: 2px; min-width: 0;">
                    <span class="cell-muted et-ellipsis">From: {{ currentAudience === 'admin' ? settings?.adminFromName : settings?.guestFromName }}</span>
                    <span class="strong et-ellipsis">{{ previewSubject || '—' }}</span>
                  </div>
                  <div class="et-device">
                    <button type="button" [class.active]="device === 'desktop'" (click)="setDevice('desktop')">Desktop</button>
                    <button type="button" [class.active]="device === 'mobile'" (click)="setDevice('mobile')">Mobile</button>
                  </div>
                </div>
                <div class="et-preview-scroll" [class.loading]="previewLoading">
                  <div class="et-frame-wrap" [class.mobile]="device === 'mobile'">
                    <!-- View-only: no scripts (sandbox), and pointer-events: none so links/buttons can't be clicked.
                         The frame is sized to its content; this pane does the scrolling. -->
                    <iframe #previewFrame class="et-frame" sandbox="allow-same-origin" tabindex="-1" aria-hidden="true"
                            [srcdoc]="previewDoc" [style.height.px]="frameHeight" (load)="fitFrame()" title="Email preview"></iframe>
                  </div>
                </div>
              </section>
            </div>

            <div class="et-editor-foot">
              <div class="row wrap" style="gap: 8px;">
                @if (!selected.is_custom) {
                  <button class="btn btn-secondary btn-sm" (click)="resetToDefault()" [disabled]="busy">Reset to default</button>
                }
                @if (!selected.required && selected.kind !== 'layout') {
                  <button class="btn btn-danger-soft btn-sm" (click)="deleteTemplate(selected)" [disabled]="busy"><app-icon name="trash" [size]="14" /> Delete</button>
                }
                <button class="btn btn-secondary btn-sm" (click)="openTest()" [disabled]="busy"><app-icon name="mail" [size]="14" /> Send test</button>
              </div>
              <div class="row" style="gap: 8px;">
                <button class="btn btn-secondary" (click)="closeEdit()" [disabled]="busy">Close</button>
                <button class="btn btn-primary" (click)="save()" [disabled]="busy || !dirty">{{ busy ? 'Saving…' : 'Save changes' }}</button>
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- New template -->
    @if (createOpen) {
      <div class="modal-backdrop" (click)="createOpen = false">
        <div class="modal" style="max-width: 560px;" (click)="$event.stopPropagation()">
          <div class="modal-header"><span class="modal-title">New email template</span></div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field span-2">
                <label class="field-label">Name <span class="req">*</span></label>
                <input class="input" maxlength="120" [(ngModel)]="createDraft.name" placeholder="e.g. Diwali getaway promo" />
              </div>
              <div class="field span-2">
                <label class="field-label">Theme</label>
                <div class="et-theme-pick">
                  <button type="button" [class.selected]="createDraft.audience === 'guest'" (click)="createDraft.audience = 'guest'">
                    <span class="et-swatch" style="background: linear-gradient(135deg, #0c2350 60%, #f2682f 60%);"></span>
                    <span><strong>Guest</strong><br /><span class="cell-muted">Website theme — for travellers</span></span>
                  </button>
                  <button type="button" [class.selected]="createDraft.audience === 'admin'" (click)="createDraft.audience = 'admin'">
                    <span class="et-swatch" style="background: linear-gradient(135deg, #111827 60%, #4f46e5 60%);"></span>
                    <span><strong>Admin</strong><br /><span class="cell-muted">Admin panel theme — for staff</span></span>
                  </button>
                </div>
              </div>
              <div class="field span-2">
                <label class="field-label">Start from</label>
                <select class="select" [(ngModel)]="createDraft.duplicateFrom">
                  <option [ngValue]="null">Blank starter</option>
                  @for (t of emails; track t.key) { <option [ngValue]="t.key">Copy of “{{ t.name }}”</option> }
                </select>
              </div>
            </div>
            <p class="field-hint" style="margin-top: 12px;">
              Custom emails aren't triggered by events — you send them from the table, to a list of addresses or to a booking's guest.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="createOpen = false" [disabled]="busy">Cancel</button>
            <button class="btn btn-primary" (click)="create()" [disabled]="busy || !createDraft.name.trim()">{{ busy ? 'Creating…' : 'Create & edit' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Send test -->
    @if (testOpen && selected) {
      <div class="modal-backdrop" style="z-index: 1200;" (click)="testOpen = false">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><span class="modal-title">Send a test email</span></div>
          <div class="modal-body">
            <p class="muted" style="margin-top: 0;">
              Sends this template exactly as it is in the editor{{ dirty ? ' (including your unsaved changes)' : '' }}, filled with sample data.
              The subject is prefixed with [Test]. Nothing is saved.
            </p>
            <label class="field">
              <span class="field-label">Send to</span>
              <input class="input" type="email" [(ngModel)]="testTo" />
            </label>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="testOpen = false" [disabled]="busy">Cancel</button>
            <button class="btn btn-primary" (click)="sendTest()" [disabled]="busy || !testTo">{{ busy ? 'Sending…' : 'Send test' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Send custom email -->
    @if (sendTarget) {
      <div class="modal-backdrop" (click)="sendTarget = null">
        <div class="modal" style="max-width: 540px;" (click)="$event.stopPropagation()">
          <div class="modal-header"><span class="modal-title">Send “{{ sendTarget.name }}”</span></div>
          <div class="modal-body">
            @if (sendResult) {
              <div class="alert alert-success">{{ sendResult.queued }} email(s) queued — they'll go out within a few seconds.</div>
              @if (sendResult.skipped.length) {
                <div class="alert alert-warning" style="margin-top: 8px;">Skipped (reserved test domains): {{ sendResult.skipped.join(', ') }}</div>
              }
            } @else {
              <div class="form-grid">
                <div class="field span-2">
                  <label class="field-label">Recipients</label>
                  <textarea class="textarea" [(ngModel)]="sendDraft.recipients" placeholder="guest@gmail.com, another@company.com"></textarea>
                  <span class="field-hint">Up to 50 addresses, comma or new line separated.</span>
                </div>
                <div class="field span-2">
                  <label class="field-label">…and/or a booking's guest</label>
                  <input class="input" type="number" min="1" [(ngModel)]="sendDraft.bookingId" placeholder="Booking ID, e.g. 42" />
                  <span class="field-hint">Emails that booking's guest, with the booking's details filled in.</span>
                </div>
              </div>
            }
          </div>
          <div class="modal-footer">
            @if (sendResult) {
              <button class="btn btn-secondary" (click)="sendTarget = null; switchTab('log')">Open delivery log</button>
              <button class="btn btn-primary" (click)="sendTarget = null">Done</button>
            } @else {
              <button class="btn btn-secondary" (click)="sendTarget = null" [disabled]="busy">Cancel</button>
              <button class="btn btn-primary" (click)="send()" [disabled]="busy || (!sendDraft.recipients.trim() && !sendDraft.bookingId)">{{ busy ? 'Queuing…' : 'Send' }}</button>
            }
          </div>
        </div>
      </div>
    }

    <!-- View a logged email -->
    @if (viewing) {
      <div class="modal-backdrop" (click)="viewing = null">
        <div class="modal" style="max-width: 760px;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="stack" style="gap: 2px; min-width: 0;">
              <span class="modal-title et-ellipsis">{{ viewing.subject }}</span>
              <span class="cell-muted">To {{ viewing.to }} · {{ logLabel(viewing.status) }}</span>
            </span>
            <button class="btn btn-ghost btn-icon" (click)="viewing = null"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <div class="cell-muted" style="padding: 8px 16px; font-size: 12px; border-bottom: 1px solid var(--border);">{{ viewing.note }}</div>
            <iframe class="et-frame" style="height: 560px; border: 0; border-radius: 0; pointer-events: none;" sandbox="" tabindex="-1" [srcdoc]="viewingDoc" title="Sent email"></iframe>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tab .count { margin-left: 4px; }
      .et-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
      .et-status-chips { display: inline-flex; gap: 6px; flex-wrap: wrap; }
      .et-status { border: 1px solid var(--border); background: var(--bg-surface, #fff); border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--text-muted); }
      .et-status span { margin-left: 4px; font-weight: 700; color: var(--text-primary); }
      .et-status.active { border-color: var(--brand-500); background: var(--brand-50); color: var(--brand-700); }
      .et-search { position: relative; display: flex; align-items: center; width: 280px; max-width: 100%; }
      .et-search app-icon { position: absolute; left: 10px; color: var(--text-muted); pointer-events: none; }
      .et-search .input { padding-left: 32px; }
      .et-row-actions { display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end; }
      .et-icon-btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
                     background: var(--bg-surface, #fff); color: var(--text-muted); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
      .et-icon-btn:hover:not(:disabled) { color: var(--brand-600); border-color: var(--brand-500); background: var(--brand-50); }
      .et-icon-btn.danger:hover:not(:disabled) { color: var(--danger-600); border-color: #fecaca; background: var(--danger-50); }
      .et-icon-btn:disabled { opacity: .35; cursor: not-allowed; }
      .et-status-muted:not(.active) { border-style: dashed; }
      .et-name { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--text-primary); cursor: pointer; text-align: left; }
      .et-name:hover { color: var(--brand-600); text-decoration: underline; }
      .et-desc { font-size: 12px; max-width: min(520px, 36vw); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .et-error { display: flex; flex-direction: column; gap: 8px; padding: 14px; font-size: 13px; color: var(--danger-700); background: var(--danger-50); border-radius: var(--r-md); }
      .et-error span { color: #4b5563; }
      .et-error .btn { align-self: flex-start; }
      .et-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .switch input { display: none; }
      .switch-track { width: 34px; height: 20px; border-radius: 999px; background: var(--gray-300); position: relative; transition: background .15s; }
      .switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
      .switch input:checked + .switch-track { background: var(--success-600); }
      .switch input:checked + .switch-track .switch-thumb { transform: translateX(14px); }

      /* ---- Edit modal: two equal halves ---- */
      .et-editor-backdrop { padding: 2vh 2vw; align-items: stretch; }
      .et-editor-modal { background: var(--bg-surface, #fff); border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.25);
                         width: 100%; height: 96vh; display: flex; flex-direction: column; overflow: hidden; }
      .et-editor-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
      .et-editor-title { font-size: 16px; font-weight: 700; }
      .et-name-input { font-size: 15px; font-weight: 700; max-width: 360px; padding: 6px 10px; }
      .et-editor-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; }
      .et-half { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
      .et-code-half { padding: 16px; border-right: 1px solid var(--border); }
      .et-code { flex: 1; min-height: 200px; width: 100%; resize: none; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
                 line-height: 1.55; tab-size: 2; padding: 12px; margin-top: 6px; border: 1px solid var(--border-strong); border-radius: var(--r-md);
                 background: #0f172a; color: #e2e8f0; }
      .et-code:focus { outline: none; border-color: var(--brand-500); box-shadow: 0 0 0 3px var(--brand-50); }
      .et-preview-half { background: #f3f4f6; }
      .et-preview-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px; background: var(--bg-surface, #fff); border-bottom: 1px solid var(--border); }
      .et-device { display: inline-flex; background: var(--gray-100); padding: 3px; border-radius: 8px; flex-shrink: 0; }
      .et-device button { border: 0; background: none; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; color: var(--text-muted); }
      .et-device button.active { background: #fff; color: var(--text-primary); box-shadow: var(--shadow-xs); }
      .et-preview-scroll { flex: 1; min-height: 0; overflow: auto; padding: 16px; transition: opacity .15s; }
      .et-preview-scroll.loading { opacity: .6; }
      .et-frame-wrap { margin: 0 auto; width: 100%; }
      .et-frame-wrap.mobile { width: 375px; max-width: 100%; }
      .et-frame { display: block; width: 100%; border: 1px solid var(--border); border-radius: 10px; background: #fff;
                  pointer-events: none; user-select: none; }
      .et-editor-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
      @media (max-width: 900px) {
        .et-editor-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
        .et-code-half { border-right: 0; border-bottom: 1px solid var(--border); }
      }

      .et-settings { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
      @media (max-width: 1100px) { .et-settings { grid-template-columns: 1fr; } }
      .et-theme-pick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .et-theme-pick button { display: flex; gap: 10px; align-items: center; text-align: left; padding: 10px; border: 2px solid var(--border); border-radius: 10px; background: none; cursor: pointer; font-size: 13px; color: inherit; }
      .et-theme-pick button.selected { border-color: var(--brand-600); background: var(--brand-50); }
      .et-swatch { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; }
    `,
  ],
})
export class EmailTemplatesComponent implements OnInit, OnDestroy {
  @ViewChild('codeInput') codeInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('previewFrame') previewFrame?: ElementRef<HTMLIFrameElement>;

  tab: Tab = 'templates';
  typeFilters = TYPE_FILTERS;
  typeFilter: TypeFilter = 'all';
  search = '';
  logStatuses = LOG_STATUSES;

  templates: EmailTemplateSummary[] = [];
  listLoading = false;
  listError = '';

  // ---- edit modal
  editOpen = false;
  selected: EmailTemplate | null = null;
  templateError = '';
  private editingKey: string | null = null;
  draftSubject = '';
  draftHtml = '';
  draftName = '';
  previewSubject = '';
  /**
   * Angular's HTML sanitizer strips every style attribute, which would make the
   * preview lie about how the email looks. Trusting it is safe because the frame
   * can't run scripts (sandbox without allow-scripts) and can't be interacted with.
   */
  previewDoc: SafeHtml = '';
  previewError = '';
  previewLoading = false;
  frameHeight = 600;
  device: 'desktop' | 'mobile' = 'desktop';
  busy = false;

  createOpen = false;
  createDraft: { name: string; audience: Audience; duplicateFrom: string | null } = { name: '', audience: 'guest', duplicateFrom: null };

  testOpen = false;
  testTo = '';

  sendTarget: EmailTemplateSummary | null = null;
  sendDraft: { recipients: string; bookingId: number | null } = { recipients: '', bookingId: null };
  sendResult: { queued: number; skipped: string[] } | null = null;

  // ---- delivery log
  log: OutboxRow[] = [];
  logTotal = 0;
  logPage = 1;
  logPageSize = 25;
  logCounts: OutboxPage['counts'] = {};
  logTemplate = '';
  logStatus: LogStatus = '';
  logLoading = false;
  logError = '';
  viewing: OutboxView | null = null;
  viewingDoc: SafeHtml = '';
  private logTimer?: ReturnType<typeof setInterval>;

  // ---- settings
  settings: EmailSettings | null = null;
  settingsError = '';
  settingsSavedAt: Date | null = null;
  settingsDraft: { recipients: string; guestFromName: string; adminFromName: string; replyTo: string } | null = null;

  private preview$ = new Subject<void>();
  private sub?: Subscription;

  constructor(
    private api: EmailTemplateService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.preview$
      .pipe(
        debounceTime(350),
        switchMap(() => {
          if (!this.selected) return of(null);
          this.previewLoading = true;
          this.cdr.markForCheck();
          return this.api
            .preview(this.selected.key, { subject: this.selected.kind === 'email' ? this.draftSubject : undefined, html: this.draftHtml })
            .pipe(
              catchError((err) => {
                this.previewError = this.describe(err);
                return of(null);
              })
            );
        })
      )
      .subscribe((p) => {
        this.previewLoading = false;
        if (p) {
          this.previewSubject = p.subject;
          this.previewDoc = this.sanitizer.bypassSecurityTrustHtml(p.html);
          this.previewError = '';
        }
        this.cdr.markForCheck();
      });

    this.loadList();
    this.loadSettings();
    this.loadLog();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.stopLogTimer();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.testOpen) this.testOpen = false;
    else if (this.editOpen) this.closeEdit();
  }

  // ------------------------------------------------------------------ helpers

  get emails(): EmailTemplateSummary[] {
    return this.templates.filter((t) => t.kind === 'email' && !t.deleted);
  }

  private matchesType(t: EmailTemplateSummary, f: TypeFilter): boolean {
    if (f === 'deleted') return t.deleted;
    if (t.deleted) return false;
    if (f === 'all') return true;
    if (f === 'layout') return t.kind === 'layout';
    if (f === 'custom') return t.is_custom;
    return t.kind === 'email' && !t.is_custom && t.audience === f;
  }

  countOf(f: TypeFilter): number {
    return this.templates.filter((t) => this.matchesType(t, f)).length;
  }

  get visibleTemplates(): EmailTemplateSummary[] {
    const q = this.search.trim().toLowerCase();
    return this.templates.filter(
      (t) =>
        this.matchesType(t, this.typeFilter) &&
        (!q || [t.name, t.description, t.subject, t.key].some((v) => (v ?? '').toLowerCase().includes(q)))
    );
  }

  typeLabel(t: EmailTemplateSummary): string {
    const theme = t.audience === 'guest' ? 'Guest' : 'Admin';
    if (t.kind === 'layout') return `${theme} layout`;
    return t.is_custom ? `Custom · ${theme}` : `${theme} email`;
  }

  get currentAudience(): Audience {
    return this.selected?.audience ?? 'guest';
  }

  get dirty(): boolean {
    const s = this.selected;
    if (!s) return false;
    if (this.draftHtml !== s.html) return true;
    if (s.kind === 'email' && this.draftSubject !== (s.subject ?? '')) return true;
    return s.is_custom && this.draftName.trim() !== s.name;
  }

  get lineCount(): number {
    return this.draftHtml.split('\n').length;
  }

  nameOf(key: string): string {
    return this.templates.find((t) => t.key === key)?.name ?? key;
  }

  logLabel(status: string): string {
    return ({ pending: 'Queued', sent: 'Sent', failed: 'Failed', skipped: 'Skipped' } as Record<string, string>)[status] ?? humanize(status);
  }

  logBadge(status: string): string {
    return status === 'sent' ? 'badge-success' : status === 'skipped' ? 'badge-neutral' : statusBadgeClass(status);
  }

  get logAll(): number {
    return Object.values(this.logCounts).reduce((a, b) => a + (b ?? 0), 0);
  }

  get logPages(): number {
    return Math.max(1, Math.ceil(this.logTotal / this.logPageSize));
  }

  /** Turns an HTTP failure into something an admin can act on (never a silent empty page). */
  private describe(err: any): string {
    if (err?.status === 0) {
      return `Could not reach the admin server (${environment.apiUrl}). Check it is running — and if your browser has an ad/tracker blocker (e.g. Brave Shields), allow this address.`;
    }
    const msg = err?.error?.message || err?.message || 'Unexpected error';
    return err?.status ? `${msg} (HTTP ${err.status})` : msg;
  }

  // ------------------------------------------------------------------ table

  loadList(): void {
    this.listLoading = true;
    this.listError = '';
    this.api.list().subscribe({
      next: (list) => {
        this.templates = list;
        this.listLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.listLoading = false;
        this.listError = this.describe(err);
        this.cdr.markForCheck();
      },
    });
  }

  toggleEnabled(t: EmailTemplateSummary): void {
    const next = !t.is_enabled;
    t.is_enabled = next; // optimistic; reverted on error
    this.api.update(t.key, { isEnabled: next }).subscribe({
      next: () => {
        this.toast.success(next ? `“${t.name}” switched on` : `“${t.name}” switched off — it won't be sent`);
        this.loadList();
      },
      error: (err) => {
        t.is_enabled = !next;
        this.toast.error(this.describe(err));
        this.cdr.markForCheck();
      },
    });
  }

  // ------------------------------------------------------------------ edit modal

  openEdit(key: string): void {
    if (this.templates.find((t) => t.key === key)?.deleted) {
      this.toast.error('Restore this template before editing it');
      return;
    }
    this.editOpen = true;
    this.editingKey = key;
    this.selected = null;
    this.templateError = '';
    this.previewDoc = '';
    this.previewSubject = '';
    this.device = 'desktop';
    this.api.get(key).subscribe({
      next: (t) => this.applyTemplate(t),
      error: (err) => {
        this.templateError = this.describe(err);
        this.cdr.markForCheck();
      },
    });
  }

  retryEdit(): void {
    if (this.editingKey) this.openEdit(this.editingKey);
  }

  async closeEdit(): Promise<void> {
    if (this.busy) return;
    if (this.dirty) {
      const ok = await this.confirm.ask({
        title: 'Discard unsaved changes?',
        message: `Your edits to “${this.selected!.name}” haven't been saved.`,
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    this.editOpen = false;
    this.selected = null;
    this.cdr.markForCheck();
  }

  private applyTemplate(t: EmailTemplate): void {
    this.selected = t;
    this.draftSubject = t.subject ?? '';
    this.draftHtml = t.html;
    this.draftName = t.name;
    this.previewError = '';
    this.cdr.markForCheck();
    this.preview$.next();
  }

  changed(): void {
    this.preview$.next();
  }

  setDevice(device: 'desktop' | 'mobile'): void {
    this.device = device;
    // Width changes reflow the email; re-measure once the new width applies.
    setTimeout(() => this.fitFrame(), 50);
  }

  /** Grows the preview frame to its content so the pane scrolls instead of the (non-interactive) frame. */
  fitFrame(): void {
    const doc = this.previewFrame?.nativeElement.contentDocument;
    if (!doc?.documentElement) return;
    const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (height && Math.abs(height - this.frameHeight) > 2) {
      this.frameHeight = height + 2;
      this.cdr.markForCheck();
    }
  }

  /** Tab indents instead of leaving the editor. */
  onCodeKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const el = this.codeInput?.nativeElement;
    const start = el?.selectionStart ?? this.draftHtml.length;
    const end = el?.selectionEnd ?? this.draftHtml.length;
    this.draftHtml = this.draftHtml.slice(0, start) + '  ' + this.draftHtml.slice(end);
    this.changed();
    setTimeout(() => el?.setSelectionRange(start + 2, start + 2));
  }

  save(): void {
    if (!this.selected) return;
    const s = this.selected;
    if (s.is_custom && !this.draftName.trim()) {
      this.toast.error('Give the template a name');
      return;
    }
    this.busy = true;
    const payload =
      s.kind === 'layout'
        ? { html: this.draftHtml }
        : s.is_custom
          ? { subject: this.draftSubject, html: this.draftHtml, name: this.draftName.trim() }
          : { subject: this.draftSubject, html: this.draftHtml };
    this.api.update(s.key, payload).subscribe({
      next: (t) => {
        this.busy = false;
        this.applyTemplate(t);
        this.toast.success('Template saved — the next email will use this version');
        this.loadList();
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(this.describe(err));
        this.cdr.markForCheck();
      },
    });
  }

  async resetToDefault(): Promise<void> {
    if (!this.selected) return;
    const ok = await this.confirm.ask({
      title: 'Reset to the default template?',
      message: 'Your subject and HTML changes to this template will be replaced with the original version.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (!ok) return;
    this.api.reset(this.selected.key).subscribe({
      next: (t) => {
        this.applyTemplate(t);
        this.toast.success('Template reset to default');
        this.loadList();
      },
      error: (err) => this.toast.error(this.describe(err)),
    });
  }

  async deleteTemplate(t: { key: string; name: string; is_custom: boolean; kind: string; required?: boolean; deletable?: boolean }): Promise<void> {
    if (t.deletable === false || t.required || t.kind === 'layout') return;
    const ok = await this.confirm.ask({
      title: `Delete “${t.name}”?`,
      message: t.is_custom
        ? 'The template is removed from the list. Emails already sent stay in the delivery log. You can restore it from the Deleted filter.'
        : 'This is a system email — once deleted it will no longer be sent automatically. You can restore it any time from the Deleted filter.',
      confirmLabel: 'Delete template',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(t.key).subscribe({
      next: () => {
        this.toast.success(`“${t.name}” deleted — restore it from the Deleted filter`);
        if (this.selected?.key === t.key) {
          this.editOpen = false;
          this.selected = null;
        }
        this.loadList();
      },
      error: (err) => this.toast.error(this.describe(err)),
    });
  }

  restoreTemplate(t: EmailTemplateSummary): void {
    this.api.restore(t.key).subscribe({
      next: () => {
        this.toast.success(`“${t.name}” restored`);
        this.loadList();
        if (this.countOf('deleted') <= 1) this.typeFilter = 'all';
      },
      error: (err) => this.toast.error(this.describe(err)),
    });
  }

  openCreate(): void {
    this.createDraft = { name: '', audience: 'guest', duplicateFrom: null };
    this.tab = 'templates';
    this.createOpen = true;
  }

  create(): void {
    this.busy = true;
    const d = this.createDraft;
    this.api.create({ name: d.name.trim(), audience: d.audience, duplicateFrom: d.duplicateFrom }).subscribe({
      next: (t) => {
        this.busy = false;
        this.createOpen = false;
        this.toast.success(`“${t.name}” created`);
        this.loadList();
        this.openEdit(t.key);
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(this.describe(err));
        this.cdr.markForCheck();
      },
    });
  }

  openTest(): void {
    this.testTo = this.testTo || this.auth.getUser()?.email || '';
    this.testOpen = true;
  }

  sendTest(): void {
    if (!this.selected) return;
    this.busy = true;
    const s = this.selected;
    const draft = s.kind === 'email' ? { subject: this.draftSubject, html: this.draftHtml } : { html: this.draftHtml };
    this.api.sendTest(s.key, this.testTo.trim(), draft).subscribe({
      next: (r) => {
        this.busy = false;
        this.testOpen = false;
        this.toast.success(`Test sent to ${r.to}`);
        this.loadLog();
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(this.describe(err));
        this.cdr.markForCheck();
      },
    });
  }

  openSend(t: EmailTemplateSummary): void {
    this.sendTarget = t;
    this.sendDraft = { recipients: '', bookingId: null };
    this.sendResult = null;
  }

  send(): void {
    if (!this.sendTarget) return;
    this.busy = true;
    const d = this.sendDraft;
    this.api.send(this.sendTarget.key, { recipients: d.recipients, bookingId: d.bookingId || null }).subscribe({
      next: (r) => {
        this.busy = false;
        this.sendResult = r;
        this.loadList();
        this.loadLog();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(this.describe(err));
        this.cdr.markForCheck();
      },
    });
  }

  // ------------------------------------------------------------------ tabs

  switchTab(tab: Tab): void {
    this.tab = tab;
    this.stopLogTimer();
    if (tab === 'log') {
      this.loadLog();
      this.logTimer = setInterval(() => this.loadLog(true), 10000);
    }
    if (tab === 'settings') this.loadSettings();
    if (tab === 'templates') this.loadList();
    this.cdr.markForCheck();
  }

  private stopLogTimer(): void {
    if (this.logTimer) clearInterval(this.logTimer);
    this.logTimer = undefined;
  }

  // ------------------------------------------------------------------ delivery log

  setLogStatus(status: LogStatus): void {
    this.logStatus = status;
    this.logPage = 1;
    this.loadLog();
  }

  loadLog(silent = false): void {
    if (!silent) this.logLoading = true;
    this.api
      .outbox({ templateKey: this.logTemplate, status: this.logStatus, page: this.logPage, pageSize: this.logPageSize })
      .subscribe({
        next: (r) => {
          this.log = r.data;
          this.logTotal = r.total;
          this.logCounts = r.counts ?? {};
          this.logLoading = false;
          this.logError = '';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logLoading = false;
          if (!silent) this.logError = this.describe(err);
          this.cdr.markForCheck();
        },
      });
  }

  viewEmail(row: OutboxRow): void {
    this.api.viewOutbox(row.id).subscribe({
      next: (v) => {
        this.viewing = v;
        this.viewingDoc = this.sanitizer.bypassSecurityTrustHtml(v.html);
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(this.describe(err)),
    });
  }

  retry(row: OutboxRow): void {
    this.api.retry(row.id).subscribe({
      next: () => {
        this.toast.success('Queued for another attempt');
        this.loadLog();
      },
      error: (err) => this.toast.error(this.describe(err)),
    });
  }

  // ------------------------------------------------------------------ settings

  get settingsDirty(): boolean {
    const s = this.settings;
    const d = this.settingsDraft;
    if (!s || !d) return false;
    const recipients = d.recipients.split(/[,\n;]/).map((e) => e.trim().toLowerCase()).filter(Boolean).join(',');
    return (
      recipients !== s.adminRecipients.join(',') ||
      d.guestFromName.trim() !== s.guestFromName ||
      d.adminFromName.trim() !== s.adminFromName ||
      d.replyTo.trim() !== (s.replyTo ?? '')
    );
  }

  loadSettings(): void {
    this.settingsError = '';
    this.api.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        if (!this.settingsDraft || !this.settingsDirty) this.resetSettingsDraft();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.settingsError = this.describe(err);
        this.cdr.markForCheck();
      },
    });
  }

  resetSettingsDraft(): void {
    const s = this.settings;
    if (!s) return;
    this.settingsDraft = {
      recipients: s.adminRecipients.join(', '),
      guestFromName: s.guestFromName,
      adminFromName: s.adminFromName,
      replyTo: s.replyTo ?? '',
    };
  }

  saveSettings(): void {
    if (!this.settingsDraft) return;
    this.busy = true;
    this.api
      .saveSettings({
        adminRecipients: this.settingsDraft.recipients,
        guestFromName: this.settingsDraft.guestFromName,
        adminFromName: this.settingsDraft.adminFromName,
        replyTo: this.settingsDraft.replyTo,
      })
      .subscribe({
        next: (s) => {
          this.busy = false;
          this.settings = s;
          this.settingsSavedAt = new Date();
          this.resetSettingsDraft();
          this.toast.success('Email settings saved');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.busy = false;
          this.toast.error(this.describe(err));
          this.cdr.markForCheck();
        },
      });
  }
}
