import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Payment, PaymentService } from './payment.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { statusBadgeClass, humanize } from '../shared/status';

@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Payments</h1>
          <p class="page-subtitle">Transactions and refunds. Refunds are capped at the captured amount server-side.</p>
        </div>
      </div>

      <div class="toolbar">
        <select class="select" [(ngModel)]="status" (ngModelChange)="refresh()">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
        </select>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr><th>Transaction</th><th>Booking</th><th>Customer</th><th>Hotel</th><th class="text-right">Amount</th><th>Method</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              @for (payment of payments; track payment.id) {
                <tr>
                  <td class="cell-mono cell-strong">{{ payment.transaction_ref || '—' }}</td>
                  <td><a class="cell-mono" [routerLink]="['/bookings', payment.booking_id]">#{{ payment.booking_id }}</a></td>
                  <td>{{ payment.customer_name || '—' }}</td>
                  <td>{{ payment.hotel_name || '—' }}</td>
                  <td class="text-right cell-strong num">₹{{ payment.amount }}</td>
                  <td>{{ payment.method || '—' }}</td>
                  <td><span class="badge" [class]="badgeClass(payment.status)">{{ label(payment.status) }}</span></td>
                  <td class="cell-muted">{{ payment.created_at | date: 'mediumDate' }}</td>
                  <td class="text-right">
                    @if (payment.status === 'captured' || payment.status === 'partially_refunded') {
                      <button class="link-btn" (click)="openRefund(payment)">Refund</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9">
                  <div class="empty-state">
                    <span class="empty-icon"><app-icon name="card" [size]="22" /></span>
                    <span class="empty-title">No payments yet</span>
                    <span class="empty-text">Payment transactions will be listed here once bookings are paid for.</span>
                  </div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (refundTarget) {
      <div class="modal-backdrop" (click)="refundTarget = null">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Refund payment</span>
            <button class="btn btn-ghost btn-icon" (click)="refundTarget = null"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info" style="margin-bottom: 16px;">
              <app-icon name="alert" [size]="16" />
              <span>Captured amount is ₹{{ refundTarget.amount }}. Refunds cannot exceed this.</span>
            </div>
            <div class="stack" style="gap: 14px;">
              <div class="field">
                <label class="field-label">Refund Amount</label>
                <input class="input" type="number" min="0" [max]="refundTarget.amount" [(ngModel)]="refundAmount" />
              </div>
              <div class="field">
                <label class="field-label">Reason</label>
                <input class="input" type="text" [(ngModel)]="refundReason" placeholder="Guest cancelled within free window" />
              </div>
              @if (refundError) { <div class="alert alert-danger">{{ refundError }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="refundTarget = null">Cancel</button>
            <button class="btn btn-danger" (click)="submitRefund()">Submit Refund</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PaymentsListComponent implements OnInit {
  payments: Payment[] = [];
  status = '';
  refundTarget: Payment | null = null;
  refundAmount = 0;
  refundReason = '';
  refundError = '';

  constructor(
    private paymentService: PaymentService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.paymentService.list(this.status || undefined).subscribe((payments) => {
      this.payments = payments;
      this.cdr.markForCheck();
    });
  }

  openRefund(payment: Payment): void {
    this.refundTarget = payment;
    this.refundAmount = payment.amount;
    this.refundReason = '';
    this.refundError = '';
  }

  submitRefund(): void {
    if (!this.refundTarget) return;
    this.paymentService.createRefund(this.refundTarget.id, this.refundAmount, this.refundReason).subscribe({
      next: () => {
        this.refundTarget = null;
        this.toast.success('Refund initiated');
        this.refresh();
      },
      error: (err) => {
        this.refundError = err.error?.message || 'Refund failed';
        this.cdr.markForCheck();
      },
    });
  }

  badgeClass = statusBadgeClass;
  label = humanize;
}
