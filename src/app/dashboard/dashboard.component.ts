import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { BookingService, Booking } from '../bookings/booking.service';
import { ReportService } from '../reports/report.service';
import { IconComponent } from '../shared/icon.component';
import { statusBadgeClass } from '../shared/status';

interface Stats {
  hotels: number;
  rooms: number;
  bookings: number;
  customers: number;
  revenue: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  refunded: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
  bookings: number;
}

const RANGES = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'This year', days: 365 },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Overview of hotels, bookings and revenue across the platform.</p>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="stat-grid">
        @for (card of statCards; track card.label) {
          <div class="stat-card">
            <span class="stat-icon" [class]="card.tone"><app-icon [name]="card.icon" [size]="18" /></span>
            <div>
              <div class="stat-label">{{ card.label }}</div>
              @if (loading) {
                <div class="skeleton skeleton-text" style="width: 64px; height: 22px; margin-top: 6px;"></div>
              } @else {
                <div class="stat-value">{{ card.value }}</div>
              }
            </div>
          </div>
        }
      </div>

      <div class="grid-2 mt-24">
        <!-- Revenue chart -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Revenue Overview</div>
              <div class="cell-muted">{{ revenueTotalLabel }}</div>
            </div>
            <select class="select" style="width: auto;" (change)="changeRange($event)">
              @for (range of ranges; track range.days) {
                <option [value]="range.days" [selected]="range.days === rangeDays">{{ range.label }}</option>
              }
            </select>
          </div>
          <div class="card-body">
            @if (revenueSeries.length) {
              <div class="chart-bars">
                @for (point of revenueSeries; track point.date) {
                  <div class="chart-col" [title]="point.date + ' — ₹' + point.revenue">
                    <div class="chart-bar" [style.height.%]="barHeight(point.revenue)"></div>
                    <span class="chart-label">{{ shortDate(point.date) }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state" style="padding: 32px 16px;">
                <span class="empty-icon"><app-icon name="chart" [size]="20" /></span>
                <span class="empty-title">No revenue yet</span>
                <span class="empty-text">Revenue will appear here once bookings start coming in.</span>
              </div>
            }
          </div>
        </div>

        <!-- Booking status distribution -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Booking Overview</div>
            <a class="link-btn" routerLink="/bookings">View all</a>
          </div>
          <div class="card-body">
            @if (stats && stats.bookings > 0) {
              @for (slice of statusSlices; track slice.label) {
                <div class="legend-row">
                  <span class="legend-key">
                    <span class="legend-dot" [style.background]="slice.color"></span>
                    {{ slice.label }}
                  </span>
                  <span class="strong num">{{ slice.value }}</span>
                </div>
                <div class="bar-meter">
                  <span [style.width.%]="percent(slice.value)" [style.background]="slice.color"></span>
                </div>
              }
            } @else {
              <div class="empty-state" style="padding: 32px 16px;">
                <span class="empty-icon"><app-icon name="calendar" [size]="20" /></span>
                <span class="empty-title">No bookings yet</span>
                <span class="empty-text">Booking status distribution will show up here.</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Recent bookings -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Recent Bookings</h2>
          <a class="link-btn" routerLink="/bookings">View all bookings</a>
        </div>

        <div class="table-wrap">
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th>Booking</th><th>Customer</th><th>Hotel</th><th>Room</th>
                  <th>Check-in</th><th>Check-out</th><th class="text-right">Amount</th>
                  <th>Payment</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                @if (loading) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr><td colspan="9"><div class="skeleton skeleton-text" style="height: 16px;"></div></td></tr>
                  }
                } @else {
                  @for (booking of recentBookings; track booking.id) {
                    <tr class="clickable" [routerLink]="['/bookings', booking.id]">
                      <td class="cell-strong cell-mono">#{{ booking.id }}</td>
                      <td class="cell-strong">{{ booking.customer_name }}</td>
                      <td>{{ booking.hotel_name }}</td>
                      <td>{{ booking.room_type_name }}</td>
                      <td class="num">{{ booking.check_in }}</td>
                      <td class="num">{{ booking.check_out }}</td>
                      <td class="text-right cell-strong num">₹{{ booking.total_amount }}</td>
                      <td><span class="badge" [class]="badgeClass(booking.payment_status)">{{ label(booking.payment_status) }}</span></td>
                      <td><span class="badge" [class]="badgeClass(booking.booking_status)">{{ label(booking.booking_status) }}</span></td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="9">
                        <div class="empty-state">
                          <span class="empty-icon"><app-icon name="inbox" [size]="20" /></span>
                          <span class="empty-title">No bookings yet</span>
                          <span class="empty-text">New bookings will appear here as guests reserve rooms.</span>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  stats: Stats | null = null;
  recentBookings: Booking[] = [];
  revenueSeries: RevenuePoint[] = [];
  loading = true;
  ranges = RANGES;
  rangeDays = 30;

  constructor(
    private http: HttpClient,
    private bookingService: BookingService,
    private reportService: ReportService,
    private cdr: ChangeDetectorRef
  ) {}

  get statCards() {
    return [
      { label: 'Total Hotels', value: this.stats?.hotels ?? 0, icon: 'hotel', tone: '' },
      { label: 'Total Rooms', value: this.stats?.rooms ?? 0, icon: 'bed', tone: 'blue' },
      { label: 'Total Bookings', value: this.stats?.bookings ?? 0, icon: 'calendar', tone: 'slate' },
      { label: 'Total Customers', value: this.stats?.customers ?? 0, icon: 'users', tone: 'slate' },
      { label: 'Revenue', value: this.formatCurrency(this.stats?.revenue ?? 0), icon: 'rupee', tone: 'green' },
      { label: 'Cancelled', value: this.stats?.cancelled ?? 0, icon: 'x', tone: 'red' },
    ];
  }

  get statusSlices() {
    const s = this.stats;
    return [
      { label: 'Pending', value: s?.pending ?? 0, color: '#d97706' },
      { label: 'Confirmed', value: s?.confirmed ?? 0, color: '#4f46e5' },
      { label: 'Checked In', value: s?.checkedIn ?? 0, color: '#2563eb' },
      { label: 'Checked Out', value: s?.checkedOut ?? 0, color: '#059669' },
      { label: 'Cancelled', value: s?.cancelled ?? 0, color: '#dc2626' },
      { label: 'Refunded', value: s?.refunded ?? 0, color: '#64748b' },
    ];
  }

  get revenueTotalLabel(): string {
    const total = this.revenueSeries.reduce((sum, p) => sum + Number(p.revenue), 0);
    return `${this.formatCurrency(total)} across ${this.revenueSeries.length} day(s)`;
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRevenue();
    this.bookingService.list({ pageSize: '8' }).subscribe((res) => {
      this.recentBookings = res.data;
      this.cdr.markForCheck();
    });
  }

  private loadStats(): void {
    this.http.get<Stats>(`${environment.apiUrl}/api/admin/stats`).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  changeRange(event: Event): void {
    this.rangeDays = Number((event.target as HTMLSelectElement).value);
    this.loadRevenue();
  }

  private loadRevenue(): void {
    const from = new Date(Date.now() - this.rangeDays * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    this.reportService.revenue(from, to).subscribe((rows) => {
      this.revenueSeries = rows.slice(-14);
      this.cdr.markForCheck();
    });
  }

  barHeight(revenue: number): number {
    const max = Math.max(...this.revenueSeries.map((p) => Number(p.revenue)), 1);
    return Math.max(3, (Number(revenue) / max) * 100);
  }

  percent(value: number): number {
    const total = this.stats?.bookings || 1;
    return Math.round((value / total) * 100);
  }

  shortDate(date: string): string {
    return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  formatCurrency(value: number): string {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }

  badgeClass = statusBadgeClass;

  label(value: string): string {
    return (value || '').replace(/_/g, ' ');
  }
}
