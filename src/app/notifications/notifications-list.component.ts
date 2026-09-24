import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppNotification, NotificationService } from './notification.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';

const TYPE_ICONS: Record<string, string> = {
  new_booking: 'calendar',
  cancellation: 'x',
  payment_failed: 'card',
  refund_request: 'rupee',
  low_inventory: 'box',
  review_pending: 'star',
  system: 'alert',
};

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">{{ unreadCount }} unread of {{ notifications.length }}</p>
        </div>
        @if (unreadCount) {
          <div class="page-actions">
            <button class="btn btn-secondary" (click)="markAllRead()"><app-icon name="check" [size]="15" /> Mark all as read</button>
          </div>
        }
      </div>

      <div class="table-wrap">
        @for (notification of notifications; track notification.id) {
          <div class="notification" [class.unread]="!notification.is_read" (click)="markRead(notification)">
            <span class="stat-icon" [class.slate]="notification.is_read">
              <app-icon [name]="iconFor(notification.type)" [size]="17" />
            </span>
            <div class="stack" style="flex: 1;">
              <span class="row-between">
                <span class="strong">{{ notification.title }}</span>
                <span class="cell-muted">{{ notification.created_at | date: 'MMM d, HH:mm' }}</span>
              </span>
              <span class="muted">{{ notification.message }}</span>
            </div>
            @if (!notification.is_read) { <span class="unread-dot"></span> }
          </div>
        } @empty {
          <div class="empty-state">
            <span class="empty-icon"><app-icon name="bell" [size]="22" /></span>
            <span class="empty-title">You're all caught up</span>
            <span class="empty-text">New bookings, cancellations and low-inventory alerts will show up here.</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .notification {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: background-color .15s ease;
      }
      .notification:last-child { border-bottom: none; }
      .notification:hover { background: var(--gray-50); }
      .notification.unread { background: var(--brand-50); }
      .notification.unread:hover { background: var(--brand-100); }
      .unread-dot {
        width: 8px; height: 8px;
        border-radius: var(--r-full);
        background: var(--brand-600);
        margin-top: 6px;
        flex-shrink: 0;
      }
    `,
  ],
})
export class NotificationsListComponent implements OnInit {
  notifications: AppNotification[] = [];

  constructor(
    private notificationService: NotificationService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.is_read).length;
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.notificationService.list().subscribe((n) => {
      this.notifications = n;
      this.cdr.markForCheck();
    });
  }

  iconFor(type: string): string {
    return TYPE_ICONS[type] ?? 'bell';
  }

  markRead(notification: AppNotification): void {
    if (notification.is_read) return;
    this.notificationService.markRead(notification.id).subscribe(() => this.refresh());
  }

  markAllRead(): void {
    this.notificationService.markAllRead().subscribe(() => {
      this.toast.success('All notifications marked as read');
      this.refresh();
    });
  }
}
