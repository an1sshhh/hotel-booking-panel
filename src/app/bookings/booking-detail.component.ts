import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Booking, BookingService, CancellationQuote } from './booking.service';
import { IconComponent } from '../shared/icon.component';
import { PaymentService } from '../payments/payment.service';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { statusBadgeClass, humanize, initials } from '../shared/status';

const NEXT_ACTIONS: Record<string, { label: string; status: string; danger?: boolean }[]> = {
  pending: [
    { label: 'Confirm Booking', status: 'confirmed' },
    { label: 'Cancel Booking', status: 'cancelled', danger: true },
  ],
  confirmed: [
    { label: 'Check In', status: 'checked_in' },
    { label: 'Cancel & Refund', status: 'cancelled', danger: true },
  ],
  checked_in: [{ label: 'Check Out', status: 'checked_out' }],
  checked_out: [],
  cancelled: [],
  refunded: [],
};

@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <a class="back-link" routerLink="/bookings"><app-icon name="arrowLeft" [size]="14" /> Back to bookings</a>

      @if (booking) {
        <div class="page-header">
          <div>
            <div class="row wrap">
              <h1 class="page-title">Booking {{ booking.booking_ref || '#' + booking.id }}</h1>
              <span class="badge" [class]="badgeClass(booking.booking_status)">{{ label(booking.booking_status) }}</span>
              <span class="badge" [class]="badgeClass(booking.payment_status)">Payment: {{ label(booking.payment_status) }}</span>
            </div>
            <p class="page-subtitle">
              #{{ booking.id }} · Created {{ booking.created_at | date: 'medium' }}
              @if (booking.booking_status === 'pending' && booking.hold_expires_at) {
                · Awaiting online payment (hold until {{ booking.hold_expires_at | date: 'shortTime' }})
              }
            </p>
          </div>

          <div class="page-actions">
            @for (action of nextActions; track action.status) {
              <button class="btn" [class.btn-danger-soft]="action.danger" [class.btn-primary]="!action.danger"
                      (click)="transition(action)">
                {{ action.label }}
              </button>
            }
            @if (canRefundOnly) {
              <button class="btn btn-danger-soft" (click)="openCancel(true)">Issue Refund</button>
            }
            @if (!nextActions.length && !canRefundOnly) {
              <span class="badge badge-neutral no-dot">No further actions available</span>
            }
          </div>
        </div>

        @if (booking.booking_status === 'cancelled' && booking.cancellation_reason) {
          <div class="alert alert-danger" style="margin-bottom: 16px;">
            Cancelled{{ booking.cancelled_at ? ' on ' + (booking.cancelled_at | date: 'medium') : '' }} — {{ booking.cancellation_reason }}
          </div>
        }
        @if (canRefundOnly) {
          <div class="alert alert-warning" style="margin-bottom: 16px;">
            This booking is cancelled but still holds ₹{{ refundableTotal }} of captured payment. Issue a refund to return it to the guest.
          </div>
        }

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Customer</span></div>
            <div class="card-body">
              <div class="row" style="gap: 12px;">
                <span class="avatar lg">{{ initials }}</span>
                <div class="stack">
                  <span class="strong" style="font-size: 15px;">{{ booking.customer_name }}</span>
                  <span class="muted">{{ booking.customer_email }}</span>
                  <span class="muted">{{ booking.customer_phone || 'No phone on file' }}</span>
                </div>
              </div>
              @if (booking.guest_name) {
                <dl class="definition-list mt-16">
                  <dt>Lead guest</dt><dd>{{ booking.guest_name }}</dd>
                  <dt>Guest email</dt><dd>{{ booking.guest_email || '—' }}</dd>
                  <dt>Guest mobile</dt><dd>{{ booking.guest_phone || '—' }}</dd>
                  @if (booking.special_requests) {
                    <dt>Special requests</dt><dd style="white-space: pre-line;">{{ booking.special_requests }}</dd>
                  }
                </dl>
              }
              <a class="link-btn mt-16" style="display: inline-block;" [routerLink]="['/customers', booking.customer_id]">
                View customer profile →
              </a>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Stay Details</span></div>
            <div class="card-body">
              <dl class="definition-list">
                <dt>Hotel</dt>
                <dd><a [routerLink]="['/hotels', booking.hotel_id]">{{ booking.hotel_name }}</a></dd>
                <dt>Address</dt><dd>{{ booking.hotel_address || '—' }}</dd>
                <dt>Room type</dt><dd>{{ booking.room_type_name }}</dd>
                <dt>Rate plan</dt><dd>{{ booking.rate_plan_name || '—' }}</dd>
                <dt>Check-in</dt><dd>{{ booking.check_in }}</dd>
                <dt>Check-out</dt><dd>{{ booking.check_out }}</dd>
                <dt>Nights</dt><dd>{{ booking.nights }}</dd>
                <dt>Guests</dt><dd>{{ booking.guests }} guest(s), {{ booking.num_rooms }} room(s)</dd>
              </dl>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Price Breakdown</span></div>
            <div class="card-body">
              <div class="price-line"><span>Room price</span><span class="num">₹{{ booking.room_price }}</span></div>
              <div class="price-line"><span>Taxes</span><span class="num">₹{{ booking.tax_amount }}</span></div>
              <div class="price-line"><span>Fees</span><span class="num">₹{{ booking.fee_amount }}</span></div>
              @if (+booking.discount_amount > 0) {
                <div class="price-line" style="color: var(--success-600);">
                  <span>Discount</span><span class="num">−₹{{ booking.discount_amount }}</span>
                </div>
              }
              <div class="price-line total"><span>Total</span><span class="num">₹{{ booking.total_amount }}</span></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Payments</span></div>
            <div class="card-body">
              @if (booking.payments?.length) {
                @for (payment of booking.payments; track payment.id) {
                  <div class="row-between" style="padding: 9px 0; border-bottom: 1px solid var(--border);">
                    <div class="stack">
                      <span class="strong">₹{{ payment.amount }} · {{ payment.gateway === 'razorpay' ? 'Razorpay' : 'Offline' }} · {{ payment.method || 'method pending' }}</span>
                      <span class="cell-muted cell-mono">{{ payment.razorpay_payment_id || payment.transaction_ref || payment.razorpay_order_id || 'no reference' }}</span>
                      @if (payment.failure_reason && payment.status !== 'captured') {
                        <span class="cell-muted" style="color: var(--danger-600);">{{ payment.failure_reason }}</span>
                      }
                    </div>
                    <span class="badge" [class]="badgeClass(payment.status)">{{ label(payment.status) }}</span>
                  </div>
                }
              } @else {
                <div class="empty-state" style="padding: 28px 12px;">
                  <span class="empty-icon"><app-icon name="card" [size]="20" /></span>
                  <span class="empty-title">No payment recorded</span>
                  <span class="empty-text">Payment records for this booking will appear here.</span>
                </div>
              }
            </div>
          </div>
        </div>

        @if (booking.refunds?.length) {
          <div class="section">
            <div class="section-header"><h2 class="section-title">Refunds</h2></div>
            <div class="card">
              <div class="card-body">
                @for (refund of booking.refunds; track refund.id) {
                  <div class="row-between" style="padding: 9px 0; border-bottom: 1px solid var(--border);">
                    <div class="stack">
                      <span class="strong">₹{{ refund.amount }} · {{ refund.reason || 'No reason' }}</span>
                      <span class="cell-muted cell-mono">{{ refund.gateway_refund_id || 'recorded offline' }} · {{ refund.created_at | date: 'medium' }}</span>
                    </div>
                    <span class="badge" [class]="badgeClass(refund.status)">{{ label(refund.status) }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <div class="section">
          <div class="section-header"><h2 class="section-title">Booking Timeline</h2></div>
          <div class="card">
            <div class="card-body">
              <div class="timeline">
                @for (step of timeline; track step.status) {
                  <div class="timeline-step" [class.done]="step.done" [class.current]="step.current">
                    <span class="timeline-dot">
                      @if (step.done) { <app-icon name="check" [size]="11" [strokeWidth]="3" /> }
                    </span>
                    <span class="stack">
                      <span [class.strong]="step.done || step.current">{{ step.label }}</span>
                      <span class="cell-muted">{{ step.hint }}</span>
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      @if (cancelOpen && booking) {
        <div class="modal-backdrop" (click)="closeCancel()">
          <div class="modal" style="max-width: 520px;" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <span class="modal-title">{{ refundOnly ? 'Refund payment' : 'Cancel booking ' + (booking.booking_ref || '#' + booking.id) }}</span>
            </div>
            <div class="modal-body">
              @if (!quote) {
                <div class="skeleton skeleton-text" style="height: 60px;"></div>
              } @else {
                <div class="alert alert-info" style="margin-bottom: 16px;">
                  <div class="strong">{{ quote.rule }}</div>
                  @if (quote.slabs.length) {
                    <div class="cell-muted" style="margin-top: 4px;">
                      Policy:
                      @for (slab of quote.slabs; track slab.days_before_checkin; let last = $last) {
                        ≥ {{ slab.days_before_checkin }}d → {{ slab.refund_percent }}%{{ last ? '' : ', ' }}
                      }
                    </div>
                  }
                </div>
                <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
                  <div class="field">
                    <span class="field-label">Paid online / captured</span>
                    <span class="strong num">₹{{ quote.paidAmount }}</span>
                  </div>
                  <div class="field">
                    <span class="field-label">Policy suggests</span>
                    <span class="strong num">₹{{ quote.suggestedRefund }} ({{ quote.refundPercent }}%)</span>
                  </div>
                  <label class="field span-2">
                    <span class="field-label">Refund amount (₹)</span>
                    <input class="input" type="number" min="0" [max]="quote.paidAmount" step="0.01" [(ngModel)]="refundAmount"
                           [disabled]="quote.paidAmount === 0" />
                    <span class="field-hint">
                      @if (quote.paidAmount === 0) { Nothing was paid online, so there is nothing to refund. }
                      @else { Refunds on Razorpay payments go back to the guest's original payment method (5–7 working days). }
                    </span>
                  </label>
                  <label class="field span-2">
                    <span class="field-label">Reason <span class="req">*</span></span>
                    <textarea class="textarea" [(ngModel)]="cancelReason" placeholder="e.g. Guest requested cancellation over phone"></textarea>
                  </label>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeCancel()" [disabled]="submitting">Keep booking</button>
              <button class="btn btn-danger" (click)="submitCancel()" [disabled]="submitting || !quote || !cancelReason.trim()">
                {{ submitting ? 'Processing…' : refundOnly ? 'Refund ₹' + (refundAmount || 0) : (refundAmount > 0 ? 'Cancel & refund ₹' + refundAmount : 'Cancel booking') }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .timeline { display: flex; flex-wrap: wrap; gap: 8px; }
      .timeline-step {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex: 1;
        min-width: min(140px, 100%);
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        font-size: 13px;
        color: var(--text-muted);
      }
      .timeline-step.done { border-color: #a7f3d0; background: var(--success-50); color: var(--success-700); }
      .timeline-step.current { border-color: var(--brand-500); background: var(--brand-50); color: var(--brand-700); }
      .timeline-dot {
        display: grid;
        place-items: center;
        width: 18px; height: 18px;
        border-radius: var(--r-full);
        background: var(--gray-200);
        color: #fff;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .timeline-step.done .timeline-dot { background: var(--success-600); }
      .timeline-step.current .timeline-dot { background: var(--brand-600); }
    `,
  ],
})
export class BookingDetailComponent implements OnInit {
  booking: Booking | null = null;
  cancelOpen = false;
  refundOnly = false;
  quote: CancellationQuote | null = null;
  refundAmount = 0;
  cancelReason = '';
  submitting = false;

  constructor(
    private bookingService: BookingService,
    private paymentService: PaymentService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  get nextActions() {
    if (!this.booking) return [];
    return NEXT_ACTIONS[this.booking.booking_status] || [];
  }

  /** Money still refundable across captured payments (e.g. a payment that landed after the hold lapsed). */
  get refundableTotal(): number {
    const payments = this.booking?.payments ?? [];
    const paid = payments
      .filter((p) => ['captured', 'partially_refunded'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const refunded = (this.booking?.refunds ?? [])
      .filter((r) => r.status !== 'failed')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    return Math.round((paid - refunded) * 100) / 100;
  }

  get canRefundOnly(): boolean {
    return !!this.booking && !['pending', 'confirmed'].includes(this.booking.booking_status) && this.refundableTotal > 0;
  }

  get initials(): string {
    return initials(this.booking?.customer_name);
  }

  get timeline() {
    const order = ['pending', 'confirmed', 'checked_in', 'checked_out'];
    const labels: Record<string, { label: string; hint: string }> = {
      pending: { label: 'Pending', hint: 'Awaiting confirmation' },
      confirmed: { label: 'Confirmed', hint: 'Room reserved' },
      checked_in: { label: 'Checked In', hint: 'Guest has arrived' },
      checked_out: { label: 'Checked Out', hint: 'Stay completed' },
    };
    const current = this.booking?.booking_status ?? 'pending';

    if (current === 'cancelled' || current === 'refunded') {
      return [
        { status: 'pending', ...labels['pending'], done: true, current: false },
        { status: current, label: humanize(current), hint: 'Booking ended', done: false, current: true },
      ];
    }

    const currentIndex = order.indexOf(current);
    return order.map((status, index) => ({
      status,
      ...labels[status],
      done: index < currentIndex,
      current: index === currentIndex,
    }));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.bookingService.get(id).subscribe((booking) => {
      this.booking = booking;
      this.cdr.markForCheck();
    });
  }

  openCancel(refundOnly = false): void {
    if (!this.booking) return;
    this.cancelOpen = true;
    this.refundOnly = refundOnly;
    this.quote = null;
    this.cancelReason = '';
    this.bookingService.cancellationQuote(this.booking.id).subscribe({
      next: (quote) => {
        this.quote = refundOnly
          ? { ...quote, paidAmount: this.refundableTotal, suggestedRefund: this.refundableTotal, refundPercent: 100, rule: 'Refund of payment on a booking that is no longer active' }
          : quote;
        this.refundAmount = this.quote.suggestedRefund;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Could not load cancellation terms');
        this.closeCancel();
      },
    });
  }

  closeCancel(): void {
    if (this.submitting) return;
    this.cancelOpen = false;
    this.cdr.markForCheck();
  }

  submitCancel(): void {
    if (!this.booking || !this.quote) return;
    const amount = Number(this.refundAmount) || 0;
    if (amount < 0 || amount > this.quote.paidAmount) {
      this.toast.error(`Refund must be between ₹0 and ₹${this.quote.paidAmount}`);
      return;
    }
    this.submitting = true;
    const done = {
      next: () => {
        this.submitting = false;
        this.cancelOpen = false;
        this.toast.success(this.refundOnly ? `Refund of ₹${amount} issued` : amount > 0 ? `Booking cancelled, ₹${amount} refund issued` : 'Booking cancelled');
        this.load();
      },
      error: (err: any) => {
        this.submitting = false;
        this.toast.error(err.error?.message || 'Cancellation failed');
        this.cdr.markForCheck();
      },
    };

    if (this.refundOnly) {
      const payment = (this.booking.payments ?? []).find((p) => ['captured', 'partially_refunded'].includes(p.status));
      if (!payment) return;
      this.paymentService.createRefund(payment.id, amount, this.cancelReason.trim()).subscribe(done);
    } else {
      this.bookingService.cancel(this.booking.id, this.cancelReason.trim(), amount).subscribe(done);
    }
  }

  async transition(action: { label: string; status: string; danger?: boolean }): Promise<void> {
    if (!this.booking) return;

    // Cancelling goes through the refund-aware flow whenever money was taken.
    if (action.status === 'cancelled' && this.refundableTotal > 0) {
      this.openCancel();
      return;
    }

    if (action.danger) {
      const ok = await this.confirm.ask({
        title: 'Cancel this booking?',
        message: 'The reserved rooms will be released back into inventory. This cannot be undone.',
        confirmLabel: 'Cancel booking',
        danger: true,
      });
      if (!ok) return;
    }

    this.bookingService.updateStatus(this.booking.id, action.status).subscribe({
      next: () => {
        this.toast.success(`Booking ${humanize(action.status)}`);
        this.load();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Status change failed');
        this.cdr.markForCheck();
      },
    });
  }

  badgeClass = statusBadgeClass;
  label = humanize;
}
