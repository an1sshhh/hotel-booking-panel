import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnType } from './report.service';
import { formatValue } from './report-format';

type Point = { label: string; value: number };

/**
 * Single-series chart for a report. Time series draw as columns, categories as
 * horizontal bars (long labels stay readable). One colour, no legend — the title
 * names the series; the table below is the accessible/exact view. Marks: ≤24px
 * thick, 4px rounded at the value end and square at the baseline, 2px gaps,
 * recessive grid, hover tooltip on every mark with a hit area larger than the mark.
 */
@Component({
  selector: 'app-report-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rc" #host (mouseleave)="hover = null">
      <div class="rc-head">
        <span class="rc-title">{{ title }}</span>
        @if (peak) { <span class="rc-peak">Peak: <strong>{{ fmt(peak.value) }}</strong> · {{ peak.label }}</span> }
      </div>

      @if (!hasData) {
        <div class="rc-empty">Nothing to chart for these filters.</div>
      } @else if (layout === 'columns') {
        <svg class="rc-svg" [attr.viewBox]="'0 0 ' + W + ' ' + H" [attr.width]="W" [attr.height]="H" role="img" [attr.aria-label]="title">
          @for (t of ticks; track t) {
            <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="y(t)" [attr.y2]="y(t)" class="rc-grid" />
            <text [attr.x]="padL - 6" [attr.y]="y(t) + 3" class="rc-axis" text-anchor="end">{{ compact(t) }}</text>
          }
          @for (p of data; track $index; let i = $index) {
            <!-- invisible full-height hit area per slot -->
            <rect [attr.x]="padL + i * slot" [attr.y]="padT" [attr.width]="slot" [attr.height]="plotH" fill="transparent"
                  (mouseenter)="show(i, $event)" (mousemove)="show(i, $event)" />
            @if (p.value > 0) {
              <path [attr.d]="columnPath(i, p.value)" class="rc-mark" [class.dim]="hover !== null && hover.i !== i" pointer-events="none" />
            }
          }
          <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="padT + plotH" [attr.y2]="padT + plotH" class="rc-base" />
          @for (p of data; track $index; let i = $index) {
            @if (i % labelEvery === 0) {
              <text [attr.x]="padL + i * slot + slot / 2" [attr.y]="H - 6" class="rc-axis" text-anchor="middle">{{ p.label }}</text>
            }
          }
        </svg>
      } @else {
        <div class="rc-bars">
          @for (p of data; track $index; let i = $index) {
            <div class="rc-row" (mouseenter)="show(i, $event)" (mousemove)="show(i, $event)">
              <span class="rc-label" [title]="p.label">{{ p.label }}</span>
              <span class="rc-track">
                <span class="rc-bar" [class.dim]="hover !== null && hover.i !== i" [style.width.%]="max ? (p.value / max) * 100 : 0"></span>
                <span class="rc-val">{{ fmt(p.value) }}</span>
              </span>
            </div>
          }
        </div>
      }

      @if (hover) {
        <div class="rc-tip" [style.left.px]="hover.x" [style.top.px]="hover.y">
          <span class="rc-tip-label">{{ data[hover.i].label }}</span>
          <span class="rc-tip-val">{{ fmt(data[hover.i].value) }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .rc { position: relative; }
      .rc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
      .rc-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
      .rc-peak { font-size: 12px; color: var(--text-muted); }
      .rc-peak strong { color: var(--text-primary); font-weight: 600; }
      .rc-empty { padding: 32px 0; text-align: center; color: var(--text-muted); font-size: 13px; }
      .rc-svg { display: block; overflow: visible; max-width: 100%; }
      .rc-grid { stroke: var(--gray-200); stroke-width: 1; vector-effect: non-scaling-stroke; }
      .rc-base { stroke: var(--gray-300); stroke-width: 1; vector-effect: non-scaling-stroke; }
      .rc-axis { font-size: 10px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
      .rc-mark { fill: #4f46e5; transition: opacity .12s; }
      .rc-mark.dim, .rc-bar.dim { opacity: .45; }
      .rc-bars { display: flex; flex-direction: column; gap: 2px; }
      .rc-row { display: grid; grid-template-columns: minmax(90px, 28%) 1fr; gap: 12px; align-items: center; padding: 4px 0; cursor: default; }
      .rc-row:hover { background: var(--gray-50); border-radius: 6px; }
      .rc-label { font-size: 12.5px; color: var(--text-secondary, #374151); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
      .rc-track { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .rc-bar { height: 16px; min-width: 2px; background: #4f46e5; border-radius: 0 4px 4px 0; transition: opacity .12s; flex-shrink: 0; max-width: calc(100% - 96px); }
      .rc-val { font-size: 12px; color: var(--text-primary); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .rc-tip { position: absolute; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none; background: #111827; color: #fff;
                padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; box-shadow: 0 6px 16px rgba(0,0,0,.18); z-index: 5;
                display: flex; flex-direction: column; gap: 1px; }
      .rc-tip-label { color: #d1d5db; }
      .rc-tip-val { font-weight: 700; font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class ReportChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() type: ColumnType = 'money';
  @Input() layout: 'columns' | 'bars' = 'bars';
  @Input() data: Point[] = [];
  @ViewChild('host') host?: ElementRef<HTMLDivElement>;

  // SVG drawn at the card's real pixel width (tracked by a ResizeObserver) so text is never stretched.
  W = 800;
  readonly H = 220;
  readonly padL = 56;
  readonly padR = 8;
  readonly padT = 10;
  readonly padB = 24;
  get plotW(): number { return this.W - this.padL - this.padR; }
  get plotH(): number { return this.H - this.padT - this.padB; }

  max = 0;
  ticks: number[] = [];
  slot = 0;
  labelEvery = 1;
  hasData = false;
  peak: Point | null = null;
  hover: { i: number; x: number; y: number } | null = null;

  private resize?: ResizeObserver;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    const el = this.host?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resize = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0 && w !== this.W) {
        this.W = w;
        this.slot = this.data.length ? this.plotW / this.data.length : 0;
        this.labelEvery = Math.max(1, Math.ceil(this.data.length / Math.max(2, Math.floor(this.plotW / 70))));
        this.cdr.markForCheck();
      }
    });
    this.resize.observe(el);
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  ngOnChanges(): void {
    const values = this.data.map((d) => Number(d.value) || 0);
    this.hasData = values.some((v) => v > 0);
    const rawMax = Math.max(0, ...values);
    this.peak = this.hasData ? this.data[values.indexOf(rawMax)] : null;
    this.max = this.niceMax(rawMax);
    this.ticks = this.max ? [0, this.max / 2, this.max] : [0];
    this.slot = this.data.length ? this.plotW / this.data.length : 0;
    // One x label per ~70px so they never collide.
    this.labelEvery = Math.max(1, Math.ceil(this.data.length / Math.max(2, Math.floor(this.plotW / 70))));
    this.hover = null;
  }

  private niceMax(v: number): number {
    if (v <= 0) return 0;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / exp;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * exp;
  }

  y(v: number): number {
    return this.padT + this.plotH - (this.max ? (v / this.max) * this.plotH : 0);
  }

  /** Column with a 4px rounded top and a square base; ≤24px wide, 2px gap between neighbours. */
  columnPath(i: number, value: number): string {
    const w = Math.max(1, Math.min(24, this.slot - 2));
    const x = this.padL + i * this.slot + (this.slot - w) / 2;
    const base = this.padT + this.plotH;
    const top = Math.min(this.y(value), base - 1);
    const r = Math.min(4, w / 2, base - top);
    return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
  }

  show(i: number, e: MouseEvent): void {
    const box = this.host?.nativeElement.getBoundingClientRect();
    if (!box) return;
    this.hover = { i, x: e.clientX - box.left, y: e.clientY - box.top };
  }

  fmt(v: number): string {
    return formatValue(v, this.type);
  }

  compact(v: number): string {
    if (this.type === 'percent') return `${Math.round(v)}%`;
    const prefix = this.type === 'money' ? '₹' : '';
    if (v >= 1e7) return `${prefix}${+(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${prefix}${+(v / 1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${prefix}${+(v / 1e3).toFixed(1)}k`;
    return `${prefix}${Math.round(v)}`;
  }
}
