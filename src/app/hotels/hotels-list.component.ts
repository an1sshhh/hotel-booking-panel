import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { assetUrl } from '../shared/asset-url';
import { Hotel, HotelService } from './hotel.service';
import { IconComponent } from '../shared/icon.component';
import { statusBadgeClass } from '../shared/status';

@Component({
  selector: 'app-hotels-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Hotels</h1>
          <p class="page-subtitle">{{ hotels.length }} propert{{ hotels.length === 1 ? 'y' : 'ies' }} on the platform</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/hotels/new">
            <app-icon name="plus" [size]="15" /> Add Hotel
          </a>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-field">
          <app-icon name="search" [size]="15" />
          <input class="input" type="text" placeholder="Search by name or city" [(ngModel)]="search" (ngModelChange)="onSearchChange()" />
        </div>

        <select class="select" [(ngModel)]="status" (ngModelChange)="refresh()">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>

        <select class="select" [(ngModel)]="starFilter">
          <option value="">All star categories</option>
          @for (star of [5,4,3,2,1]; track star) { <option [value]="star">{{ star }} Star</option> }
        </select>

        <select class="select" [(ngModel)]="typeFilter">
          <option value="">All types</option>
          @for (type of types; track type) { <option [value]="type">{{ type | titlecase }}</option> }
        </select>
      </div>

      @if (error) {
        <div class="alert alert-danger"><app-icon name="alert" [size]="16" /> {{ error }}</div>
      }

      @if (loading) {
        <div class="stat-grid">
          @for (i of [1,2,3,4]; track i) {
            <div class="card" style="height: 236px;"><div class="skeleton" style="height: 100%; border-radius: var(--r-lg);"></div></div>
          }
        </div>
      } @else if (visibleHotels.length) {
        <div class="hotel-grid">
          @for (hotel of visibleHotels; track hotel.id) {
            <a class="hotel-card" [routerLink]="['/hotels', hotel.id]">
              <div class="hotel-thumb">
                @if (hotel.image_url) {
                  <img [src]="imageUrl(hotel.image_url)" [alt]="hotel.name" />
                } @else {
                  <span class="thumb-placeholder"><app-icon name="image" [size]="22" /></span>
                }
                <span class="badge" [class]="badgeClass(hotel.status)">{{ hotel.status }}</span>
              </div>
              <div class="hotel-body">
                <div class="hotel-name">{{ hotel.name }}</div>
                <div class="hotel-meta">
                  <app-icon name="pin" [size]="13" />
                  {{ hotel.city }}@if (hotel.state) {, {{ hotel.state }}}
                </div>
                <div class="hotel-foot">
                  <span class="star-rating"><app-icon name="star" [size]="13" /> {{ hotel.rating || 0 }}</span>
                  <span class="cell-muted">{{ hotel.reviews_count || 0 }} reviews</span>
                  @if (hotel.star_category) { <span class="badge badge-neutral no-dot">{{ hotel.star_category }}★</span> }
                </div>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="table-wrap">
          <div class="empty-state">
            <span class="empty-icon"><app-icon name="hotel" [size]="22" /></span>
            <span class="empty-title">{{ search || status ? 'No hotels match your filters' : 'No hotels yet' }}</span>
            <span class="empty-text">
              {{ search || status
                ? 'Try adjusting your search or filters to find what you are looking for.'
                : 'Add your first property to start configuring rooms, rate plans and inventory.' }}
            </span>
            @if (!search && !status) {
              <a class="btn btn-primary" routerLink="/hotels/new"><app-icon name="plus" [size]="15" /> Add Hotel</a>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .hotel-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
        gap: 16px;
      }

      .hotel-card {
        display: flex;
        flex-direction: column;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--r-lg);
        overflow: hidden;
        color: inherit;
        box-shadow: var(--shadow-xs);
        transition: box-shadow .15s ease, transform .15s ease, border-color .15s ease;
      }
      .hotel-card:hover {
        box-shadow: var(--shadow-md);
        border-color: var(--border-strong);
        transform: translateY(-2px);
        color: inherit;
      }

      .hotel-thumb { position: relative; height: 132px; background: var(--gray-100); }
      .hotel-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .thumb-placeholder { display: grid; place-items: center; height: 100%; color: var(--gray-400); }
      .hotel-thumb .badge { position: absolute; top: 9px; right: 9px; box-shadow: var(--shadow-xs); }

      .hotel-body { padding: 13px 14px 15px; display: flex; flex-direction: column; gap: 6px; }
      .hotel-name { font-size: 14.5px; font-weight: 600; color: var(--text-primary); }
      .hotel-meta { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--text-muted); }
      .hotel-foot { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
    `,
  ],
})
export class HotelsListComponent implements OnInit, OnDestroy {
  hotels: Hotel[] = [];
  loading = true;
  error = '';
  search = '';
  status = '';
  starFilter = '';
  typeFilter = '';
  types = ['hotel', 'resort', 'villa', 'hostel', 'apartment', 'other'];

  private searchChange = new Subject<string>();

  constructor(
    private hotelService: HotelService,
    private cdr: ChangeDetectorRef
  ) {}

  get visibleHotels(): Hotel[] {
    return this.hotels.filter(
      (h) =>
        (!this.starFilter || String(h.star_category) === this.starFilter) &&
        (!this.typeFilter || h.hotel_type === this.typeFilter)
    );
  }

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
    this.error = '';

    this.hotelService
      .list({ search: this.search || undefined, status: this.status || undefined } as any)
      .subscribe({
        next: (hotels) => {
          this.hotels = hotels;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Failed to load hotels';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  imageUrl(path: string): string {
    return assetUrl(path);
  }

  badgeClass = statusBadgeClass;
}
