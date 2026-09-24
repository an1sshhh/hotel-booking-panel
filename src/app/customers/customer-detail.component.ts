import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Customer, CustomerService } from './customer.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { statusBadgeClass, humanize, initials } from '../shared/status';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <a class="back-link" routerLink="/customers"><app-icon name="arrowLeft" [size]="14" /> Back to customers</a>

      @if (customer) {
        <div class="page-header">
          <div class="row" style="gap: 14px;">
            <span class="avatar lg">{{ initials }}</span>
            <div class="stack">
              <div class="row wrap">
                <h1 class="page-title">{{ customer.name }}</h1>
                <span class="badge" [class]="badgeClass(customer.status)">{{ customer.status }}</span>
              </div>
              <p class="page-subtitle">{{ customer.email }} · {{ customer.phone || 'No phone on file' }}</p>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn" [class.btn-danger-soft]="customer.status === 'active'" [class.btn-primary]="customer.status !== 'active'"
                    (click)="toggleStatus()">
              {{ customer.status === 'active' ? 'Block Customer' : 'Unblock Customer' }}
            </button>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-icon"><app-icon name="calendar" [size]="18" /></span>
            <div><div class="stat-label">Total Bookings</div><div class="stat-value">{{ bookings.length }}</div></div>
          </div>
          <div class="stat-card">
            <span class="stat-icon green"><app-icon name="check" [size]="18" /></span>
            <div><div class="stat-label">Completed</div><div class="stat-value">{{ countByStatus('checked_out') }}</div></div>
          </div>
          <div class="stat-card">
            <span class="stat-icon red"><app-icon name="x" [size]="18" /></span>
            <div><div class="stat-label">Cancelled</div><div class="stat-value">{{ countByStatus('cancelled') }}</div></div>
          </div>
          <div class="stat-card">
            <span class="stat-icon green"><app-icon name="rupee" [size]="18" /></span>
            <div><div class="stat-label">Total Spent</div><div class="stat-value">₹{{ totalSpent }}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-header"><h2 class="section-title">Booking History</h2></div>
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th>Booking</th><th>Hotel</th><th>Check-in</th><th>Check-out</th><th class="text-right">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  @for (booking of bookings; track booking.id) {
                    <tr class="clickable" [routerLink]="['/bookings', booking.id]">
                      <td class="cell-strong cell-mono">#{{ booking.id }}</td>
                      <td>{{ booking.hotel_name }}</td>
                      <td class="num">{{ booking.check_in }}</td>
                      <td class="num">{{ booking.check_out }}</td>
                      <td class="text-right cell-strong num">₹{{ booking.total_amount }}</td>
                      <td><span class="badge" [class]="badgeClass(booking.booking_status)">{{ label(booking.booking_status) }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="inbox" [size]="22" /></span>
                        <span class="empty-title">No bookings yet</span>
                        <span class="empty-text">This customer hasn't made any bookings.</span>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | null = null;

  constructor(
    private customerService: CustomerService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  get bookings(): any[] {
    return this.customer?.bookings ?? [];
  }

  get initials(): string {
    return initials(this.customer?.name);
  }

  get totalSpent(): string {
    const total = this.bookings
      .filter((b) => b.booking_status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.total_amount), 0);
    return total.toLocaleString('en-IN');
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.customerService.get(id).subscribe((c) => {
      this.customer = c;
      this.cdr.markForCheck();
    });
  }

  countByStatus(status: string): number {
    return this.bookings.filter((b) => b.booking_status === status).length;
  }

  async toggleStatus(): Promise<void> {
    if (!this.customer) return;
    const blocking = this.customer.status === 'active';

    if (blocking) {
      const ok = await this.confirm.ask({
        title: 'Block this customer?',
        message: 'A blocked customer cannot make new bookings. Existing bookings are unaffected.',
        confirmLabel: 'Block customer',
        danger: true,
      });
      if (!ok) return;
    }

    this.customerService.setStatus(this.customer.id, blocking ? 'blocked' : 'active').subscribe(() => {
      this.toast.success(blocking ? 'Customer blocked' : 'Customer unblocked');
      this.load();
    });
  }

  badgeClass = statusBadgeClass;
  label = humanize;
}
