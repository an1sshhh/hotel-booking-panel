import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Booking, BookingService } from './booking.service';
import { IconComponent } from '../shared/icon.component';
import { statusBadgeClass, humanize } from '../shared/status';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Bookings</h1>
          <p class="page-subtitle">{{ total }} booking{{ total === 1 ? '' : 's' }} total</p>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.value) {
          <button class="tab" [class.active]="status === t.value" (click)="setTab(t.value)">{{ t.label }}</button>
        }
      </div>

      <div class="toolbar">
        <div class="search-field">
          <app-icon name="search" [size]="15" />
          <input class="input" type="text" placeholder="Search by booking ref, ID, guest or customer" [(ngModel)]="search" (ngModelChange)="onSearchChange()" />
        </div>
        <select class="select" [(ngModel)]="paymentStatus" (ngModelChange)="onFilterChange()">
          <option value="">All payment statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="captured">Captured</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
        </select>
        <input class="input" type="date" style="width: auto;" [(ngModel)]="from" (ngModelChange)="onFilterChange()" title="Check-in from" />
        <input class="input" type="date" style="width: auto;" [(ngModel)]="to" (ngModelChange)="onFilterChange()" title="Check-out to" />
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Booking</th><th>Customer</th><th>Hotel</th><th>Room</th>
                <th>Stay</th><th class="text-right">Amount</th><th>Payment</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                @for (i of [1,2,3,4,5,6]; track i) {
                  <tr><td colspan="8"><div class="skeleton skeleton-text" style="height: 16px;"></div></td></tr>
                }
              } @else {
                @for (booking of bookings; track booking.id) {
                  <tr class="clickable" [routerLink]="['/bookings', booking.id]">
                    <td class="cell-strong cell-mono">{{ booking.booking_ref || '#' + booking.id }}</td>
                    <td>
                      <div class="cell-strong">{{ booking.customer_name }}</div>
                      <div class="cell-muted">{{ booking.customer_email }}</div>
                    </td>
                    <td>{{ booking.hotel_name }}</td>
                    <td>{{ booking.room_type_name }}</td>
                    <td class="num">
                      {{ booking.check_in }} → {{ booking.check_out }}
                      <div class="cell-muted">{{ booking.nights }} night(s), {{ booking.guests }} guest(s)</div>
                    </td>
                    <td class="text-right cell-strong num">₹{{ booking.total_amount }}</td>
                    <td><span class="badge" [class]="badgeClass(booking.payment_status)">{{ label(booking.payment_status) }}</span></td>
                    <td><span class="badge" [class]="badgeClass(booking.booking_status)">{{ label(booking.booking_status) }}</span></td>
                  </tr>
                } @empty {
                  <tr><td colspan="8">
                    <div class="empty-state">
                      <span class="empty-icon"><app-icon name="calendar" [size]="22" /></span>
                      <span class="empty-title">No bookings found</span>
                      <span class="empty-text">
                        {{ hasFilters ? 'Try clearing filters to see more results.' : 'Bookings will appear here as guests reserve rooms.' }}
                      </span>
                      @if (hasFilters) { <button class="btn btn-secondary" (click)="clearFilters()">Clear filters</button> }
                    </div>
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (total > pageSize) {
          <div class="pagination">
            <span>Showing {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}</span>
            <span class="pagination-controls">
              <button class="btn btn-secondary btn-sm" [disabled]="page === 1" (click)="changePage(page - 1)">
                <app-icon name="chevronLeft" [size]="14" /> Prev
              </button>
              <span>Page {{ page }} of {{ totalPages }}</span>
              <button class="btn btn-secondary btn-sm" [disabled]="page >= totalPages" (click)="changePage(page + 1)">
                Next <app-icon name="chevronRight" [size]="14" />
              </button>
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class BookingsListComponent implements OnInit, OnDestroy {
  tabs = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Checked In', value: 'checked_in' },
    { label: 'Checked Out', value: 'checked_out' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
  ];

  bookings: Booking[] = [];
  loading = true;
  status = '';
  paymentStatus = '';
  search = '';
  from = '';
  to = '';
  page = 1;
  pageSize = 20;
  total = 0;
  Math = Math;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get hasFilters(): boolean {
    return !!(this.status || this.paymentStatus || this.search || this.from || this.to);
  }

  private searchChange = new Subject<string>();

  constructor(
    private bookingService: BookingService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchChange.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.onFilterChange());
    this.route.queryParamMap.subscribe((params) => {
      this.status = params.get('status') || '';
      this.refresh();
    });
  }

  ngOnDestroy(): void {
    this.searchChange.complete();
  }

  setTab(status: string): void {
    this.status = status;
    this.page = 1;
    this.refresh();
  }

  onSearchChange(): void {
    this.searchChange.next(this.search);
  }

  onFilterChange(): void {
    this.page = 1;
    this.refresh();
  }

  clearFilters(): void {
    this.status = this.paymentStatus = this.search = this.from = this.to = '';
    this.onFilterChange();
  }

  changePage(page: number): void {
    this.page = page;
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    const params: Record<string, string> = { page: String(this.page), pageSize: String(this.pageSize) };
    if (this.status) params['status'] = this.status;
    if (this.paymentStatus) params['paymentStatus'] = this.paymentStatus;
    if (this.search) params['search'] = this.search;
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;

    this.bookingService.list(params).subscribe({
      next: (res) => {
        this.bookings = res.data;
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

  badgeClass = statusBadgeClass;
  label = humanize;
}
