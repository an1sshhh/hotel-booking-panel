import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Customer, CustomerService } from './customer.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { statusBadgeClass, initials } from '../shared/status';

const PHONE_RE = /^\+?[0-9()\-\s]{6,20}$/;

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Customers</h1>
          <p class="page-subtitle">{{ total }} registered customer{{ total === 1 ? '' : 's' }}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="showAdd = true"><app-icon name="plus" [size]="15" /> Add Customer</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-field">
          <app-icon name="search" [size]="15" />
          <input class="input" type="text" placeholder="Search by name, email or phone" [(ngModel)]="search" (ngModelChange)="onSearchChange()" />
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr><th>Customer</th><th>Phone</th><th class="text-right">Bookings</th><th class="text-right">Total Spent</th><th>Last Booking</th><th>Status</th></tr>
            </thead>
            <tbody>
              @if (loading) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr><td colspan="6"><div class="skeleton skeleton-text" style="height: 16px;"></div></td></tr>
                }
              } @else {
                @for (customer of customers; track customer.id) {
                  <tr class="clickable" [routerLink]="['/customers', customer.id]">
                    <td>
                      <div class="row" style="gap: 10px;">
                        <span class="avatar">{{ initials(customer.name) }}</span>
                        <span class="stack">
                          <span class="cell-strong">{{ customer.name }}</span>
                          <span class="cell-muted">{{ customer.email }}</span>
                        </span>
                      </div>
                    </td>
                    <td>{{ customer.phone || '—' }}</td>
                    <td class="text-right num">{{ customer.total_bookings || 0 }}</td>
                    <td class="text-right cell-strong num">₹{{ customer.total_spent || 0 }}</td>
                    <td class="cell-muted">{{ customer.last_booking ? (customer.last_booking | date: 'mediumDate') : '—' }}</td>
                    <td><span class="badge" [class]="badgeClass(customer.status)">{{ customer.status }}</span></td>
                  </tr>
                } @empty {
                  <tr><td colspan="6">
                    <div class="empty-state">
                      <span class="empty-icon"><app-icon name="users" [size]="22" /></span>
                      <span class="empty-title">{{ search ? 'No customers match your search' : 'No customers yet' }}</span>
                      <span class="empty-text">Customers appear here once they register or an admin adds them.</span>
                    </div>
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (showAdd) {
      <div class="modal-backdrop" (click)="showAdd = false">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Add Customer</span>
            <button class="btn btn-ghost btn-icon" (click)="showAdd = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="stack" style="gap: 14px;">
              <div class="field"><label class="field-label">Name <span class="req">*</span></label><input class="input" [(ngModel)]="draft.name" /></div>
              <div class="field"><label class="field-label">Email <span class="req">*</span></label><input class="input" type="email" [(ngModel)]="draft.email" /></div>
              <div class="field">
                <label class="field-label">Phone</label>
                <input class="input" type="tel" [(ngModel)]="draft.phone" placeholder="+91 98765 43210" />
              </div>
              @if (error) { <div class="alert alert-danger">{{ error }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showAdd = false">Cancel</button>
            <button class="btn btn-primary" (click)="create()">Save Customer</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CustomersListComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  loading = true;
  search = '';
  total = 0;
  showAdd = false;
  error = '';
  draft = { name: '', email: '', phone: '' };

  private searchChange = new Subject<string>();

  constructor(
    private customerService: CustomerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchChange.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.refresh());
    this.refresh();
  }

  ngOnDestroy(): void {
    this.searchChange.complete();
  }

  onSearchChange(): void {
    this.searchChange.next(this.search);
  }

  refresh(): void {
    this.loading = true;
    this.customerService.list({ search: this.search }).subscribe({
      next: (res) => {
        this.customers = res.data;
        this.total = res.total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  initials = initials;

  create(): void {
    this.error = '';
    if (!this.draft.name.trim() || !this.draft.email.trim()) {
      this.error = 'Name and email are required.';
      return;
    }
    if (this.draft.phone.trim() && !PHONE_RE.test(this.draft.phone.trim())) {
      this.error = 'Phone must contain only digits, spaces, +, - and ().';
      return;
    }
    this.customerService.create(this.draft).subscribe({
      next: () => {
        this.showAdd = false;
        this.draft = { name: '', email: '', phone: '' };
        this.toast.success('Customer added');
        this.refresh();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to add customer';
        this.cdr.markForCheck();
      },
    });
  }

  badgeClass = statusBadgeClass;
}
