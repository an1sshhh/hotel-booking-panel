import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLog, AuditLogService } from './audit-log.service';
import { IconComponent } from '../shared/icon.component';
import { initials } from '../shared/status';

@Component({
  selector: 'app-audit-logs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Audit Logs</h1>
          <p class="page-subtitle">Every important admin action is recorded here with before/after values.</p>
        </div>
      </div>

      <div class="toolbar">
        <select class="select" [(ngModel)]="entityFilter">
          <option value="">All entity types</option>
          @for (type of entityTypes; track type) { <option [value]="type">{{ type | titlecase }}</option> }
        </select>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Changes</th></tr></thead>
            <tbody>
              @for (log of visibleLogs; track log.id) {
                <tr>
                  <td class="cell-muted" style="white-space: nowrap;">{{ log.created_at | date: 'MMM d, y HH:mm' }}</td>
                  <td>
                    <div class="row" style="gap: 8px;">
                      <span class="avatar" style="width: 26px; height: 26px; font-size: 10px;">{{ initials(log.admin_name) }}</span>
                      <span class="cell-strong">{{ log.admin_name || 'system' }}</span>
                    </div>
                  </td>
                  <td><span class="badge" [class]="actionClass(log.action)">{{ log.action }}</span></td>
                  <td class="cell-mono">{{ log.entity_type }} #{{ log.entity_id }}</td>
                  <td>
                    @if (log.before_value || log.after_value) {
                      <button class="link-btn" (click)="expanded === log.id ? expanded = null : expanded = log.id">
                        {{ expanded === log.id ? 'Hide' : 'View' }} changes
                      </button>
                      @if (expanded === log.id) {
                        <pre class="diff">{{ diff(log) }}</pre>
                      }
                    } @else {
                      <span class="cell-muted">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5">
                  <div class="empty-state">
                    <span class="empty-icon"><app-icon name="file" [size]="22" /></span>
                    <span class="empty-title">No audit entries yet</span>
                    <span class="empty-text">Hotel, booking and refund changes will be logged here.</span>
                  </div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .diff {
        margin: 8px 0 0;
        padding: 10px;
        max-width: 460px;
        max-height: 220px;
        overflow: auto;
        border-radius: var(--r-sm);
        background: var(--gray-950);
        color: #cbd5e1;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ],
})
export class AuditLogsListComponent implements OnInit {
  logs: AuditLog[] = [];
  expanded: number | null = null;
  entityFilter = '';

  constructor(
    private auditLogService: AuditLogService,
    private cdr: ChangeDetectorRef
  ) {}

  get entityTypes(): string[] {
    return [...new Set(this.logs.map((l) => l.entity_type))];
  }

  get visibleLogs(): AuditLog[] {
    return this.entityFilter ? this.logs.filter((l) => l.entity_type === this.entityFilter) : this.logs;
  }

  ngOnInit(): void {
    this.auditLogService.list().subscribe((logs) => {
      this.logs = logs;
      this.cdr.markForCheck();
    });
  }

  initials(name: string | null): string {
    return initials(name, 'S');
  }

  actionClass(action: string): string {
    if (action.includes('delete') || action.includes('cancel') || action.includes('suspend')) return 'badge-danger';
    if (action.includes('create')) return 'badge-success';
    return 'badge-info';
  }

  diff(log: AuditLog): string {
    const parts: string[] = [];
    if (log.before_value) parts.push(`before: ${JSON.stringify(log.before_value, null, 2)}`);
    if (log.after_value) parts.push(`after:  ${JSON.stringify(log.after_value, null, 2)}`);
    return parts.join('\n\n');
  }
}
