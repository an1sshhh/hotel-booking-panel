import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ReportColumn, ReportDefinition, ReportFilter, ReportResult, ReportService } from './report.service';
import { ReportChartComponent } from './report-chart.component';
import { formatValue, isNumeric } from './report-format';
import { HotelService } from '../hotels/hotel.service';
import { CustomerService } from '../customers/customer.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';

type Filters = Record<string, string | number | null>;

const PRESETS: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'thisYear', label: 'This year' },
  { value: 'last365', label: 'Last 12 months' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'custom', label: 'Custom range' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Same presets the server uses for its defaults (see report/params.js). */
function presetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const day = (offset: number) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'today': return { from: day(0), to: day(0) };
    case 'yesterday': return { from: day(-1), to: day(-1) };
    case 'last7': return { from: day(-6), to: day(0) };
    case 'last90': return { from: day(-89), to: day(0) };
    case 'thisMonth': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'lastMonth': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'thisQuarter': return { from: iso(new Date(y, q * 3, 1)), to: iso(new Date(y, q * 3 + 3, 0)) };
    case 'thisYear': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last365': return { from: day(-364), to: day(0) };
    case 'next7': return { from: day(0), to: day(6) };
    case 'next30': return { from: day(0), to: day(29) };
    default: return { from: day(-29), to: day(0) };
  }
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ReportChartComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Reports</h1>
          <p class="page-subtitle">Pick a report, adjust the filters and download it as CSV or PDF. Statements can be sent straight to guests and hotel partners.</p>
        </div>
      </div>

      <div class="rp">
        <!-- Workspace -->
        <section class="rp-main">
          @if (report) {
            <div class="card">
              <div class="card-body rp-head">
                <div class="stack" style="gap: 4px; min-width: 0; flex: 1;">
                  <!-- Report switcher: every report, grouped, searchable -->
                  <div class="rp-switch">
                    <button type="button" class="rp-switch-btn" (click)="toggleMenu()" [attr.aria-expanded]="menuOpen" aria-haspopup="true">
                      <span class="rp-crumb">{{ report.category }}</span>
                      <span class="rp-title">{{ report.name }}</span>
                      <span class="rp-caret">▾</span>
                    </button>
                    <span class="rp-aud lg" [attr.data-aud]="report.audience">{{ report.audienceLabel }}</span>
                    @if (menuOpen) {
                      <div class="rp-menu-backdrop" (click)="menuOpen = false"></div>
                      <div class="rp-menu" role="menu">
                        <div class="rp-search">
                          <app-icon name="search" [size]="14" />
                          <input #menuSearch class="input" type="search" placeholder="Find a report…" [(ngModel)]="catalogSearch" (keydown.escape)="menuOpen = false" />
                        </div>
                        <div class="rp-menu-grid">
                          @for (group of groups; track group.category) {
                            <div class="rp-group">
                              <div class="rp-group-title">{{ group.category }}</div>
                              @for (r of group.reports; track r.key) {
                                <button type="button" class="rp-item" role="menuitem" [class.active]="report.key === r.key" (click)="select(r.key)">
                                  <span class="stack" style="gap: 1px; min-width: 0;">
                                    <span class="rp-item-name">{{ r.name }}</span>
                                    <span class="rp-item-desc">{{ r.description }}</span>
                                  </span>
                                  <span class="rp-aud" [attr.data-aud]="r.audience">{{ audienceShort(r.audience) }}</span>
                                </button>
                              }
                            </div>
                          } @empty {
                            <div class="rp-none">No report matches “{{ catalogSearch }}”.</div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                  <span class="muted">{{ report.description }}</span>
                </div>
                <div class="rp-actions">
                  <button class="btn btn-secondary btn-sm" (click)="refresh()" [disabled]="loading" title="Re-run with the latest data">
                    <app-icon name="refresh" [size]="14" /> Refresh
                  </button>
                  <button class="btn btn-secondary btn-sm" (click)="download('csv')" [disabled]="!canRun || downloading !== null">
                    <app-icon name="download" [size]="14" /> {{ downloading === 'csv' ? 'Preparing…' : 'CSV' }}
                  </button>
                  <button class="btn btn-primary btn-sm" (click)="download('pdf')" [disabled]="!canRun || downloading !== null">
                    <app-icon name="file" [size]="14" /> {{ downloading === 'pdf' ? 'Preparing…' : 'PDF' }}
                  </button>
                </div>
              </div>

              <!-- Filters: one row, wraps on narrow screens -->
              <div class="card-body rp-filters">
                @for (f of report.filters; track f.key) {
                  @switch (f.type) {
                    @case ('dateRange') {
                      <label class="rp-field">
                        <span class="field-label">Period</span>
                        <select class="select" [ngModel]="filters['preset']" (ngModelChange)="setPreset($event)">
                          @for (p of presets; track p.value) { <option [value]="p.value">{{ p.label }}</option> }
                        </select>
                      </label>
                      <label class="rp-field rp-date">
                        <span class="field-label">From</span>
                        <input class="input" type="date" [ngModel]="filters['from']" (ngModelChange)="setDate('from', $event)" />
                      </label>
                      <label class="rp-field rp-date">
                        <span class="field-label">To</span>
                        <input class="input" type="date" [ngModel]="filters['to']" (ngModelChange)="setDate('to', $event)" />
                      </label>
                    }
                    @case ('hotel') {
                      <label class="rp-field">
                        <span class="field-label">{{ f.label }}@if (f.required) { <span class="req">*</span> }</span>
                        <select class="select" [ngModel]="filters[f.key]" (ngModelChange)="set(f.key, $event)">
                          <option [ngValue]="null">{{ f.required ? 'Choose a hotel…' : 'All hotels' }}</option>
                          @for (h of hotels; track h.id) { <option [ngValue]="h.id">{{ h.name }}</option> }
                        </select>
                      </label>
                    }
                    @case ('customer') {
                      <div class="rp-field rp-customer">
                        <span class="field-label">{{ f.label }} <span class="req">*</span></span>
                        <input class="input" type="search" placeholder="Search name, email or phone…" [(ngModel)]="customerQuery"
                               (ngModelChange)="customerSearch$.next($event)" (focus)="customerOpen = true" (blur)="closeCustomerSoon()" />
                        @if (customerOpen && customerResults.length) {
                          <div class="rp-dropdown">
                            @for (c of customerResults; track c.id) {
                              <button type="button" (mousedown)="pickCustomer(c)">
                                <strong>{{ c.name }}</strong><span class="cell-muted">{{ c.email }}</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                    @case ('select') {
                      <label class="rp-field">
                        <span class="field-label">{{ f.label }}</span>
                        <select class="select" [ngModel]="filters[f.key]" (ngModelChange)="set(f.key, $event)">
                          @for (o of f.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                        </select>
                      </label>
                    }
                    @case ('number') {
                      <label class="rp-field rp-num">
                        <span class="field-label">{{ f.label }}</span>
                        <input class="input" type="number" [min]="f.min ?? 0" [max]="f.max ?? 100" [step]="f.step ?? 1"
                               [ngModel]="filters[f.key]" (ngModelChange)="set(f.key, $event)" />
                      </label>
                    }
                  }
                }
              </div>
            </div>

            @if (missingRequired) {
              <div class="card"><div class="empty-state">
                <span class="empty-icon"><app-icon name="file" [size]="22" /></span>
                <span class="empty-title">Choose a {{ missingRequired.label.toLowerCase() }} to build this statement</span>
                <span class="empty-text">Use the {{ missingRequired.label.toLowerCase() }} filter above.</span>
              </div></div>
            } @else if (error) {
              <div class="rp-error card-like"><strong>Couldn't run this report.</strong> {{ error }} <button class="link-btn" (click)="refresh()">Try again</button></div>
            } @else {
              @if (result?.subject) { <div class="rp-subject"><app-icon name="user" [size]="14" /> {{ result?.subject }}</div> }

              <!-- Summary -->
              <div class="rp-tiles" [class.loading]="loading">
                @for (s of result?.summary ?? []; track s.label) {
                  <div class="card rp-tile">
                    <span class="rp-tile-label">{{ s.label }}</span>
                    <span class="rp-tile-value">{{ fmt(s.value, s.type) }}</span>
                  </div>
                }
                @if (!result) { @for (i of [1, 2, 3, 4]; track i) { <div class="card rp-tile"><div class="skeleton" style="height: 38px;"></div></div> } }
              </div>

              @if (result?.note) { <div class="alert alert-warning">{{ result?.note }}</div> }

              @if (result?.chart; as chart) {
                <div class="card" [class.loading]="loading"><div class="card-body">
                  <app-report-chart [title]="chart.title" [type]="chart.type" [layout]="chart.layout ?? 'bars'" [data]="chart.data" />
                </div></div>
              }

              <!-- Table -->
              <div class="table-wrap" [class.loading]="loading">
                <div class="rp-table-bar">
                  <span class="cell-muted">
                    {{ visibleRows.length | number }} {{ visibleRows.length === 1 ? 'row' : 'rows' }}
                    @if (tableSearch) { (filtered from {{ result?.rows?.length | number }}) }
                    @if (result?.truncated) { · <strong style="color: var(--warning-700);">first 10,000 shown — narrow the filters</strong> }
                  </span>
                  <div class="rp-search sm">
                    <app-icon name="search" [size]="13" />
                    <input class="input" type="search" placeholder="Search in results…" [(ngModel)]="tableSearch" (ngModelChange)="page = 1" />
                  </div>
                </div>
                <div class="table-scroll" #tableBox>
                  <table class="table rp-table" [class.fixed]="!!colWidths">
                    @if (colWidths) {
                      <colgroup>@for (w of colWidths; track $index) { <col [style.width.px]="w" /> }</colgroup>
                    }
                    <thead>
                      <tr>
                        @for (c of report.columns; track c.key) {
                          <th [class.text-right]="numeric(c)" (click)="sortBy(c)" class="rp-sortable" [attr.aria-sort]="sortKey === c.key ? (sortDir === 1 ? 'ascending' : 'descending') : null">
                            {{ c.label }}@if (sortKey === c.key) {<span class="rp-sort">{{ sortDir === 1 ? '▲' : '▼' }}</span>}
                          </th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of pageRows; track $index) {
                        <tr>
                          @for (c of report.columns; track c.key) {
                            <td [class.text-right]="numeric(c)" [class.num]="numeric(c)" [class.cell-strong]="$first"
                                [title]="c.type === 'text' ? (row[c.key] ?? '') : ''">{{ fmt(row[c.key], c.type) }}</td>
                          }
                        </tr>
                      } @empty {
                        <tr><td [attr.colspan]="report.columns.length">
                          <div class="empty-state" style="padding: 28px;">
                            <span class="empty-title">{{ loading ? 'Loading…' : 'No data for these filters' }}</span>
                            @if (!loading) { <span class="empty-text">Try a wider date range or a different hotel.</span> }
                          </div>
                        </td></tr>
                      }
                    </tbody>
                    @if (result?.totals && visibleRows.length && !tableSearch) {
                      <tfoot>
                        <tr>
                          @for (c of report.columns; track c.key) {
                            <td [class.text-right]="numeric(c)" [class.num]="numeric(c)">{{ result?.totals?.[c.key] === undefined ? '' : fmt(result?.totals?.[c.key], c.type) }}</td>
                          }
                        </tr>
                      </tfoot>
                    }
                  </table>
                </div>
                @if (pages > 1) {
                  <div class="row-between rp-pager">
                    <span class="cell-muted">Page {{ page }} of {{ pages }}</span>
                    <span class="row" style="gap: 6px;">
                      <select class="select" style="width: auto;" [(ngModel)]="pageSize" (ngModelChange)="page = 1">
                        <option [ngValue]="25">25 / page</option><option [ngValue]="50">50 / page</option><option [ngValue]="100">100 / page</option>
                      </select>
                      <button class="btn btn-secondary btn-sm" [disabled]="page <= 1" (click)="page = page - 1">‹ Prev</button>
                      <button class="btn btn-secondary btn-sm" [disabled]="page >= pages" (click)="page = page + 1">Next ›</button>
                    </span>
                  </div>
                }
              </div>
            }
          } @else if (catalogError) {
            <div class="rp-error">{{ catalogError }} <button class="link-btn" (click)="loadCatalog()">Retry</button></div>
          } @else {
            <div class="card"><div class="card-body"><div class="skeleton" style="height: 220px;"></div></div></div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .rp { display: block; }
      .rp-search { position: relative; display: flex; align-items: center; margin-bottom: 6px; }
      .rp-search app-icon { position: absolute; left: 10px; color: var(--text-muted); pointer-events: none; }
      .rp-search .input { padding-left: 30px; }
      .rp-search.sm { width: 240px; max-width: 100%; margin: 0; }
      .rp-switch { position: relative; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .rp-switch-btn { display: inline-flex; align-items: baseline; gap: 8px; border: 1px solid var(--border); background: var(--bg-surface, #fff);
                       border-radius: 10px; padding: 6px 12px; cursor: pointer; color: inherit; max-width: 100%; text-align: left; }
      .rp-switch-btn:hover { border-color: var(--brand-500); background: var(--brand-50); }
      .rp-crumb { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); white-space: nowrap; }
      .rp-caret { color: var(--brand-600); font-size: 12px; }
      .rp-menu-backdrop { position: fixed; inset: 0; z-index: 30; }
      .rp-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 31; width: min(920px, calc(100vw - var(--sidebar-w) - 80px));
                 background: var(--bg-surface, #fff); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); padding: 12px;
                 max-height: 70vh; overflow: auto; }
      .rp-menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(270px, 100%), 1fr)); gap: 4px 16px; }
      .rp-item-desc { font-size: 11.5px; color: var(--text-muted); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .rp-group { padding-top: 4px; }
      .rp-group-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); padding: 6px 8px; }
      .rp-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 8px; border: 0; background: none;
                 border-radius: var(--r-md); cursor: pointer; text-align: left; color: inherit; font-size: 13px; }
      .rp-item:hover { background: var(--gray-50); }
      .rp-item.active { background: var(--brand-50); color: var(--brand-700); font-weight: 600; }
      .rp-item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rp-aud { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; background: var(--gray-100); color: var(--text-muted); }
      .rp-aud[data-aud='partner'] { background: #e0f2fe; color: #075985; }
      .rp-aud[data-aud='guest'] { background: #ede9fe; color: #5b21b6; }
      .rp-aud.lg { font-size: 11px; padding: 3px 9px; }
      .rp-none, .rp-error { font-size: 12.5px; color: var(--text-muted); padding: 10px 8px; }
      .rp-error { color: var(--danger-700); background: var(--danger-50); border-radius: var(--r-md); }
      .card-like { padding: 14px 16px; }
      .rp-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .rp-table.fixed { table-layout: fixed; }
      .rp-table.fixed th { white-space: normal; overflow-wrap: normal; vertical-align: bottom; }
      .rp-table.fixed td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
      .rp-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .rp-title { font-size: 18px; font-weight: 700; margin: 0; }
      .rp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .rp-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; border-top: 1px solid var(--border); background: var(--bg-subtle); }
      .rp-field { display: flex; flex-direction: column; gap: 4px; min-width: 150px; flex: 0 1 auto; position: relative; }
      .rp-date { min-width: 140px; }
      .rp-num { min-width: 110px; max-width: 130px; }
      .rp-customer { min-width: 280px; }
      .rp-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--bg-surface, #fff); border: 1px solid var(--border);
                     border-radius: var(--r-md); box-shadow: var(--shadow-lg); z-index: 20; max-height: 260px; overflow: auto; }
      .rp-dropdown button { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; padding: 8px 10px; border: 0; background: none; cursor: pointer; text-align: left; font-size: 13px; }
      .rp-dropdown button:hover { background: var(--brand-50); }
      .rp-subject { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
      .rp-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr)); gap: 12px; }
      .rp-tile { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
      .rp-tile-label { font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
      .rp-tile-value { font-size: 20px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .loading { opacity: .55; transition: opacity .15s; }
      .rp-table-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
      /* Denser than the default admin table: reports are wide. */
      .rp-table { font-size: 12.5px; }
      .rp-table th, .rp-table td { padding: 9px 8px; }
      .rp-table th:first-child, .rp-table td:first-child { padding-left: 14px; }
      .rp-table th { white-space: nowrap; }
      .rp-table th.rp-sortable { cursor: pointer; user-select: none; }
      .rp-table th.rp-sortable:hover { color: var(--text-primary); }
      .rp-sort { margin-left: 3px; font-size: 9px; }
      .rp-table tfoot td { font-weight: 700; color: var(--text-primary); background: var(--brand-50); border-top: 2px solid var(--brand-100); }
      .rp-pager { padding: 10px 14px; border-top: 1px solid var(--border); flex-wrap: wrap; }

      /* Below the sidebar breakpoint the sidebar is off-canvas, so the menu can't be sized against it:
         pin it under the top bar and let it span the screen. */
      @media (max-width: 900px) {
        .rp-menu { position: fixed; top: calc(var(--topbar-h) + 8px); left: 12px; right: 12px; width: auto;
                   max-height: calc(100vh - var(--topbar-h) - 24px); max-height: calc(100dvh - var(--topbar-h) - 24px); }
      }
      @media (max-width: 640px) {
        .rp-title { font-size: 16px; }
        .rp-actions { width: 100%; }
        .rp-actions .btn { flex: 1 1 auto; }
        .rp-field, .rp-date, .rp-num { flex: 1 1 140px; min-width: 0; max-width: none; }
        .rp-customer { flex-basis: 100%; min-width: 0; }
        .rp-search.sm { width: 100%; }
        .rp-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .rp-tile { padding: 12px; }
        .rp-tile-value { font-size: 17px; }
        .rp-item-desc { white-space: normal; }
      }
    `,
  ],
})
export class ReportsComponent implements OnInit, OnDestroy, AfterViewChecked {
  presets = PRESETS;
  menuOpen = false;
  colWidths: number[] | null = null;
  @ViewChild('tableBox') tableBox?: ElementRef<HTMLDivElement>;
  @ViewChild('menuSearch') menuSearch?: ElementRef<HTMLInputElement>;
  private tableResize?: ResizeObserver;
  private observedTable?: HTMLDivElement;
  private tableWidth = 0;
  private measureCtx: CanvasRenderingContext2D | null = null;
  catalog: ReportDefinition[] = [];
  catalogError = '';
  catalogSearch = '';
  report: ReportDefinition | null = null;
  filters: Filters = {};

  hotels: { id: number; name: string }[] = [];
  customerQuery = '';
  customerResults: { id: number; name: string; email: string }[] = [];
  customerOpen = false;
  customerSearch$ = new Subject<string>();

  result: ReportResult | null = null;
  loading = false;
  error = '';
  downloading: 'csv' | 'pdf' | null = null;

  sortKey: string | null = null;
  sortDir: 1 | -1 = 1;
  tableSearch = '';
  page = 1;
  pageSize = 25;

  private run$ = new Subject<void>();
  private subs: Subscription[] = [];

  constructor(
    private reports: ReportService,
    private hotelService: HotelService,
    private customerService: CustomerService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.run$
        .pipe(
          debounceTime(250),
          tap(() => {
            this.loading = true;
            this.error = '';
            this.cdr.markForCheck();
          }),
          switchMap(() =>
            this.reports.run(this.report!.key, this.apiParams()).pipe(
              catchError((err) => {
                this.error = err?.error?.message || (err?.status === 0 ? 'Could not reach the admin server.' : 'Unexpected error.');
                return of(null);
              })
            )
          )
        )
        .subscribe((res) => {
          this.loading = false;
          if (res) {
            this.result = res;
            this.page = 1;
            this.layoutColumns();
          }
          this.cdr.markForCheck();
        }),
      this.customerSearch$
        .pipe(
          debounceTime(250),
          switchMap((q) => (q.trim().length < 2 ? of({ data: [] }) : this.customerService.list({ search: q.trim(), pageSize: '8' }).pipe(catchError(() => of({ data: [] })))))
        )
        .subscribe((res: any) => {
          this.customerResults = res.data ?? [];
          this.customerOpen = true;
          this.cdr.markForCheck();
        })
    );
    this.hotelService.list().subscribe((h) => {
      this.hotels = h.map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name));
      this.cdr.markForCheck();
    });
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.tableResize?.disconnect();
  }

  /** Watch the table box once it exists; re-fit columns whenever its width changes. */
  ngAfterViewChecked(): void {
    const el = this.tableBox?.nativeElement;
    // The table is destroyed/recreated when a statement is waiting for a selection or a run fails.
    if (!el || el === this.observedTable || typeof ResizeObserver === 'undefined') return;
    this.tableResize?.disconnect();
    this.observedTable = el;
    this.tableWidth = 0;
    this.tableResize = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w && w !== this.tableWidth) {
        this.tableWidth = w;
        this.layoutColumns();
        this.cdr.detectChanges();
      }
    });
    this.tableResize.observe(el);
  }

  /**
   * Column widths from the content (same approach as the PDF export): numbers,
   * dates and short codes get their natural width; if the table is still too
   * wide, the long text columns are capped at a shared width and truncate with
   * an ellipsis (full text in the tooltip). Headers may wrap onto two lines.
   */
  private layoutColumns(): void {
    const cols = this.report?.columns;
    const width = this.tableWidth;
    if (!cols || !width || !this.result) {
      this.colWidths = null;
      return;
    }
    this.measureCtx ??= document.createElement('canvas').getContext('2d');
    const ctx = this.measureCtx;
    if (!ctx) return;
    const family = getComputedStyle(document.body).fontFamily;
    const PAD = 16 + 2; // cell padding + a hair for subpixel rounding
    const text = (s: string, font: string) => {
      ctx.font = font;
      return ctx.measureText(s).width;
    };
    const sample = this.visibleRows.slice(0, 300);
    const natural = cols.map((c, i) => {
      // Headers wrap, so they only need their longest word.
      let w = Math.max(...c.label.toUpperCase().split(' ').map((word) => text(word, `600 11.5px ${family}`) + word.length * 0.46));
      const font = `${i === 0 ? 500 : 400} 12.5px ${family}`;
      for (const r of sample) w = Math.max(w, text(this.fmt(r[c.key], c.type), font));
      const t = this.result!.totals?.[c.key];
      if (t !== undefined && t !== null) w = Math.max(w, text(this.fmt(t, c.type), `700 12.5px ${family}`));
      return Math.ceil(w) + PAD + (i === 0 ? 6 : 0); // first column has extra left padding
    });
    const total = natural.reduce((a, b) => a + b, 0);
    if (total <= width) {
      const extra = (width - total) / cols.length;
      this.colWidths = natural.map((w) => w + extra);
      return;
    }
    const shrinkable = cols.map((c, i) => c.type === 'text' && i > 0); // keep the first (identifier) column whole
    const at = (cap: number) => natural.map((w, i) => (shrinkable[i] ? Math.min(w, cap) : w));
    const fits = (cap: number) => at(cap).reduce((a, b) => a + b, 0) <= width;
    const MIN = 72;
    if (!fits(MIN)) {
      this.colWidths = at(MIN); // too many columns even at the minimum: keep them readable and let the box scroll
      return;
    }
    let lo = MIN;
    let hi = Math.max(...natural);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const widths = at(lo);
    const spare = width - widths.reduce((a, b) => a + b, 0);
    this.colWidths = widths.map((w) => w + spare / widths.length);
  }

  // ------------------------------------------------------------ catalogue

  loadCatalog(): void {
    this.catalogError = '';
    this.reports.catalog().subscribe({
      next: (list) => {
        this.catalog = list;
        // Restore the report + filters from the URL, so views can be bookmarked and shared.
        const q = this.route.snapshot.queryParamMap;
        const key = q.get('r');
        const initial = list.find((r) => r.key === key) ?? list[0];
        const fromUrl: Filters = {};
        q.keys.filter((k) => k !== 'r').forEach((k) => (fromUrl[k] = q.get(k)));
        this.applyReport(initial, key === initial.key ? fromUrl : {});
      },
      error: (err) => {
        this.catalogError = err?.status === 0 ? 'Could not reach the admin server.' : err?.error?.message || 'Could not load reports.';
        this.cdr.markForCheck();
      },
    });
  }

  get groups(): { category: string; reports: ReportDefinition[] }[] {
    const q = this.catalogSearch.trim().toLowerCase();
    const out: { category: string; reports: ReportDefinition[] }[] = [];
    for (const r of this.catalog) {
      if (q && !`${r.name} ${r.description} ${r.category}`.toLowerCase().includes(q)) continue;
      let g = out.find((x) => x.category === r.category);
      if (!g) out.push((g = { category: r.category, reports: [] }));
      g.reports.push(r);
    }
    return out;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.catalogSearch = '';
      setTimeout(() => this.menuSearch?.nativeElement.focus());
    }
  }

  audienceShort(a: string): string {
    return a === 'partner' ? 'Hotels' : a === 'guest' ? 'Guests' : 'Internal';
  }

  select(key: string): void {
    this.menuOpen = false;
    const next = this.catalog.find((r) => r.key === key);
    if (!next || next.key === this.report?.key) return;
    // Carry the hotel and period across reports so switching feels continuous.
    const carry: Filters = {};
    if (this.filters['hotelId'] && next.filters.some((f) => f.type === 'hotel')) carry['hotelId'] = this.filters['hotelId'];
    this.applyReport(next, carry);
  }

  private applyReport(def: ReportDefinition, overrides: Filters): void {
    this.report = def;
    this.result = null;
    this.colWidths = null;
    this.error = '';
    this.sortKey = null;
    this.tableSearch = '';
    const f: Filters = {};
    for (const filter of def.filters) {
      if (filter.type === 'dateRange') {
        const preset = String(overrides['preset'] ?? def.defaultRange);
        const range = preset === 'custom' ? { from: String(overrides['from'] ?? def.defaultDates.from), to: String(overrides['to'] ?? def.defaultDates.to) } : presetRange(preset);
        Object.assign(f, { preset, ...range });
      } else if (filter.type === 'hotel' || filter.type === 'customer') {
        const v = overrides[filter.key];
        f[filter.key] = v === null || v === undefined || v === '' ? null : Number(v);
      } else {
        f[filter.key] = overrides[filter.key] ?? filter.default ?? null;
      }
    }
    this.filters = f;
    this.customerQuery = '';
    this.customerResults = [];
    if (f['customerId']) {
      this.customerService.get(Number(f['customerId'])).subscribe({
        next: (c) => {
          this.customerQuery = c.name;
          this.cdr.markForCheck();
        },
        error: () => {},
      });
    }
    this.changed();
  }

  // ------------------------------------------------------------ filters

  setPreset(preset: string): void {
    this.filters = { ...this.filters, preset, ...(preset === 'custom' ? {} : presetRange(preset)) };
    this.changed();
  }

  setDate(which: 'from' | 'to', value: string): void {
    if (!value) return;
    this.filters = { ...this.filters, [which]: value, preset: 'custom' };
    this.changed();
  }

  set(key: string, value: string | number | null): void {
    this.filters = { ...this.filters, [key]: value };
    this.changed();
  }

  pickCustomer(c: { id: number; name: string }): void {
    this.customerQuery = c.name;
    this.customerOpen = false;
    this.set('customerId', c.id);
  }

  closeCustomerSoon(): void {
    setTimeout(() => {
      this.customerOpen = false;
      this.cdr.markForCheck();
    }, 150);
  }

  get missingRequired(): ReportFilter | null {
    return this.report?.filters.find((f) => f.required && !this.filters[f.key]) ?? null;
  }

  get canRun(): boolean {
    return !!this.report && !this.missingRequired;
  }

  private apiParams(): Filters {
    const { preset, ...rest } = this.filters;
    return rest;
  }

  private changed(): void {
    if (!this.report) return;
    const query: Filters = { r: this.report.key };
    for (const [k, v] of Object.entries(this.filters)) {
      if (v === null || v === '' || v === undefined) continue;
      if ((k === 'from' || k === 'to') && this.filters['preset'] !== 'custom') continue; // presets stay relative when bookmarked
      query[k] = v;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
    if (this.canRun) this.run$.next();
    else {
      this.result = null;
      this.cdr.markForCheck();
    }
  }

  refresh(): void {
    if (this.canRun) this.run$.next();
  }

  // ------------------------------------------------------------ table

  fmt(v: unknown, type: ReportColumn['type']): string {
    return formatValue(v, type);
  }

  numeric(c: ReportColumn): boolean {
    return isNumeric(c.type);
  }

  sortBy(c: ReportColumn): void {
    if (this.sortKey === c.key) this.sortDir = this.sortDir === 1 ? -1 : 1;
    else {
      this.sortKey = c.key;
      this.sortDir = isNumeric(c.type) ? -1 : 1; // numbers: biggest first
    }
    this.page = 1;
  }

  get visibleRows(): Record<string, any>[] {
    let rows = this.result?.rows ?? [];
    const q = this.tableSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) => this.report!.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
    if (this.sortKey) {
      const col = this.report!.columns.find((c) => c.key === this.sortKey);
      const key = this.sortKey;
      const num = col ? isNumeric(col.type) : false;
      rows = [...rows].sort((a, b) => {
        const x = a[key];
        const y = b[key];
        const cmp = num ? Number(x ?? 0) - Number(y ?? 0) : String(x ?? '').localeCompare(String(y ?? ''), 'en', { numeric: true });
        return cmp * this.sortDir;
      });
    }
    return rows;
  }

  get pages(): number {
    return Math.max(1, Math.ceil(this.visibleRows.length / this.pageSize));
  }

  get pageRows(): Record<string, any>[] {
    return this.visibleRows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }

  // ------------------------------------------------------------ export

  download(format: 'csv' | 'pdf'): void {
    if (!this.report || !this.canRun) return;
    this.downloading = format;
    this.reports.download(this.report.key, this.apiParams(), format).subscribe({
      next: ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloading = null;
        this.toast.success(`${format.toUpperCase()} downloaded — ${filename}`);
        this.cdr.markForCheck();
      },
      error: async (err) => {
        this.downloading = null;
        // Errors on a blob request arrive as a Blob; read the JSON message out of it.
        let message = 'Download failed';
        try {
          message = JSON.parse(await (err.error as Blob).text()).message || message;
        } catch {}
        this.toast.error(message);
        this.cdr.markForCheck();
      },
    });
  }
}
