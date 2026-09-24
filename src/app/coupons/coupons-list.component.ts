import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Coupon, CouponService } from './coupon.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';

@Component({
  selector: 'app-coupons-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Coupons</h1>
          <p class="page-subtitle">Discount codes applied at checkout. Guests only see a code on the website once it is promoted from <a routerLink="/offers">Offers</a>.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="showForm = true"><app-icon name="plus" [size]="15" /> Create Coupon</button>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.value) {
          <button class="tab" [class.active]="filter === t.value" (click)="filter = t.value">{{ t.label }}</button>
        }
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr><th>Code</th><th>Discount</th><th class="text-right">Min Booking</th><th class="text-right">Max Discount</th><th>Validity</th><th>Limits</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              @for (coupon of visibleCoupons; track coupon.id) {
                <tr>
                  <td><span class="badge badge-brand no-dot cell-mono">{{ coupon.code }}</span></td>
                  <td class="cell-strong">
                    {{ coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '₹' + coupon.discount_value }}
                  </td>
                  <td class="text-right num">₹{{ coupon.min_booking_amount }}</td>
                  <td class="text-right num">{{ coupon.max_discount ? '₹' + coupon.max_discount : '—' }}</td>
                  <td class="num">{{ coupon.valid_from }} → {{ coupon.valid_until }}</td>
                  <td class="cell-muted">
                    {{ coupon.usage_limit ? coupon.usage_limit + ' total' : 'Unlimited' }}
                    @if (coupon.per_customer_limit) { · {{ coupon.per_customer_limit }}/customer }
                  </td>
                  <td>
                    <span class="badge" [class]="statusOf(coupon).class">{{ statusOf(coupon).label }}</span>
                  </td>
                  <td class="text-right">
                    <span class="row-actions" style="justify-content: flex-end;">
                      <button class="link-btn" (click)="toggleActive(coupon)">{{ coupon.active ? 'Deactivate' : 'Activate' }}</button>
                      <button class="link-btn danger" (click)="remove(coupon)">Delete</button>
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8">
                  <div class="empty-state">
                    <span class="empty-icon"><app-icon name="tag" [size]="22" /></span>
                    <span class="empty-title">No coupons here</span>
                    <span class="empty-text">Create a coupon to run promotions and discounts on bookings.</span>
                    <button class="btn btn-primary" (click)="showForm = true"><app-icon name="plus" [size]="15" /> Create Coupon</button>
                  </div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (showForm) {
      <div class="modal-backdrop" (click)="showForm = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Create Coupon</span>
            <button class="btn btn-ghost btn-icon" (click)="showForm = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field span-2">
                <label class="field-label">Coupon Code <span class="req">*</span></label>
                <input class="input cell-mono" type="text" [(ngModel)]="draft.code" placeholder="WELCOME10" />
                <span class="field-hint">Stored uppercase. Guests enter this at checkout.</span>
              </div>
              <div class="field">
                <label class="field-label">Discount Type</label>
                <select class="select" [(ngModel)]="draft.discountType">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Discount Value <span class="req">*</span></label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.discountValue" />
              </div>
              <div class="field">
                <label class="field-label">Minimum Booking Amount</label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.minBookingAmount" />
              </div>
              <div class="field">
                <label class="field-label">Maximum Discount</label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.maxDiscount" placeholder="No cap" />
              </div>
              <div class="field">
                <label class="field-label">Valid From <span class="req">*</span></label>
                <input class="input" type="date" [(ngModel)]="draft.validFrom" />
              </div>
              <div class="field">
                <label class="field-label">Valid Until <span class="req">*</span></label>
                <input class="input" type="date" [(ngModel)]="draft.validUntil" />
              </div>
              <div class="field">
                <label class="field-label">Total Usage Limit</label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.usageLimit" placeholder="Unlimited" />
              </div>
              <div class="field">
                <label class="field-label">Per Customer Limit</label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.perCustomerLimit" placeholder="Unlimited" />
              </div>
              @if (error) { <div class="alert alert-danger span-2">{{ error }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showForm = false">Cancel</button>
            <button class="btn btn-primary" (click)="create()">Save Coupon</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CouponsListComponent implements OnInit {
  coupons: Coupon[] = [];
  showForm = false;
  error = '';
  filter = 'all';
  tabs = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Expired', value: 'expired' },
  ];
  draft: any = {
    code: '', discountType: 'percentage', discountValue: 10, minBookingAmount: 0,
    maxDiscount: null, validFrom: '', validUntil: '', usageLimit: null, perCustomerLimit: null,
  };

  constructor(
    private couponService: CouponService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  get visibleCoupons(): Coupon[] {
    if (this.filter === 'all') return this.coupons;
    return this.coupons.filter((c) => this.statusOf(c).key === this.filter);
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.couponService.list().subscribe((coupons) => {
      this.coupons = coupons;
      this.cdr.markForCheck();
    });
  }

  statusOf(coupon: Coupon): { key: string; label: string; class: string } {
    const today = new Date().toISOString().slice(0, 10);
    if (!coupon.active) return { key: 'inactive', label: 'Inactive', class: 'badge-neutral' };
    if (today < coupon.valid_from) return { key: 'upcoming', label: 'Upcoming', class: 'badge-info' };
    if (today > coupon.valid_until) return { key: 'expired', label: 'Expired', class: 'badge-danger' };
    return { key: 'active', label: 'Active', class: 'badge-success' };
  }

  create(): void {
    this.error = '';
    if (!this.draft.code.trim() || !this.draft.validFrom || !this.draft.validUntil) {
      this.error = 'Code, valid from and valid until are required.';
      return;
    }
    if (Number(this.draft.discountValue) < 0) {
      this.error = 'Discount value cannot be negative.';
      return;
    }
    if (new Date(this.draft.validUntil) < new Date(this.draft.validFrom)) {
      this.error = 'Valid until must be after valid from.';
      return;
    }

    this.couponService.create(this.draft).subscribe({
      next: () => {
        this.showForm = false;
        this.toast.success('Coupon created');
        this.refresh();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to create coupon';
        this.cdr.markForCheck();
      },
    });
  }

  toggleActive(coupon: Coupon): void {
    this.couponService.update(coupon.id, { active: !coupon.active }).subscribe(() => {
      this.toast.success(coupon.active ? 'Coupon deactivated' : 'Coupon activated');
      this.refresh();
    });
  }

  async remove(coupon: Coupon): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete coupon ${coupon.code}?`,
      message: 'If the coupon has already been used it will be deactivated instead, to preserve booking history.',
      confirmLabel: 'Delete coupon',
      danger: true,
    });
    if (!ok) return;

    this.couponService.remove(coupon.id).subscribe((res: any) => {
      this.toast.success(res?.message || 'Coupon deleted');
      this.refresh();
    });
  }
}
