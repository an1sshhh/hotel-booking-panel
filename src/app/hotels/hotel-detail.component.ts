import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { assetUrl } from '../shared/asset-url';
import { Amenity, Hotel, HotelImage, HotelService } from './hotel.service';
import { AmenityService } from './amenity.service';
import { RoomType, RoomService } from './room.service';
import { BookingService, Booking } from '../bookings/booking.service';
import { ReviewService, Review } from '../reviews/review.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { statusBadgeClass } from '../shared/status';

const IMAGE_CATEGORIES = ['exterior', 'lobby', 'rooms', 'bathroom', 'pool', 'restaurant', 'facilities', 'other'];

type Tab = 'overview' | 'gallery' | 'amenities' | 'rooms' | 'bookings' | 'reviews';

@Component({
  selector: 'app-hotel-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <a class="back-link" routerLink="/hotels"><app-icon name="arrowLeft" [size]="14" /> Back to hotels</a>

      @if (hotel) {
        <div class="hero-card">
          <div class="hero-main">
            <div class="hotel-avatar">
              @if (coverUrl) { <img [src]="coverUrl" [alt]="hotel.name" /> }
              @else { <app-icon name="hotel" [size]="28" /> }
            </div>
            <div class="stack" style="gap: 6px;">
              <div class="row wrap">
                <h1 class="page-title">{{ hotel.name }}</h1>
                <span class="badge" [class]="badgeClass(hotel.status)">{{ hotel.status }}</span>
                @if (hotel.star_category) { <span class="badge badge-brand no-dot">{{ hotel.star_category }}★ category</span> }
              </div>
              <p class="page-subtitle">
                {{ hotel.hotel_type | titlecase }} · {{ hotel.city }}@if (hotel.state) {, {{ hotel.state }}}
                @if (hotel.address) { · {{ hotel.address }} }
              </p>
              <div class="hero-meta">
                <span class="star-rating"><app-icon name="star" [size]="14" /> {{ hotel.rating || 0 }}</span>
                <span class="cell-muted">{{ hotel.reviews_count || 0 }} reviews</span>
                @if (hotel.phone) { <span class="hero-meta-item"><app-icon name="phone" [size]="13" /> {{ hotel.phone }}</span> }
                @if (hotel.email) { <span class="hero-meta-item"><app-icon name="mail" [size]="13" /> {{ hotel.email }}</span> }
                @if (hotel.latitude && hotel.longitude) {
                  <a class="link-btn" [href]="mapUrl" target="_blank" rel="noopener">
                    <span class="hero-meta-item"><app-icon name="pin" [size]="13" /> View on map</span>
                  </a>
                }
              </div>
            </div>
          </div>

          <div class="page-actions">
            <a class="btn btn-secondary" [routerLink]="['/hotels', hotel.id, 'edit']">
              <app-icon name="edit" [size]="15" /> Edit Hotel
            </a>
            <button class="btn" [class.btn-danger-soft]="hotel.status === 'active'" [class.btn-primary]="hotel.status !== 'active'"
                    (click)="toggleStatus()">
              {{ hotel.status === 'active' ? 'Deactivate' : 'Activate' }}
            </button>
          </div>
        </div>

        <div class="tabs">
          @for (tabItem of tabs; track tabItem.key) {
            <button class="tab" [class.active]="tab === tabItem.key" (click)="tab = tabItem.key">
              {{ tabItem.label }}
              @if (tabItem.count !== undefined) { <span class="count">{{ tabItem.count }}</span> }
            </button>
          }
        </div>

        <!-- OVERVIEW -->
        @if (tab === 'overview') {
          <div class="stat-grid" style="margin-bottom: 16px;">
            <div class="stat-card">
              <div class="stat-icon blue"><app-icon name="bed" [size]="18" /></div>
              <div><div class="stat-label">Room types</div><div class="stat-value">{{ rooms.length }}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon amber"><app-icon name="calendar" [size]="18" /></div>
              <div><div class="stat-label">Bookings</div><div class="stat-value">{{ bookings.length }}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green"><app-icon name="rupee" [size]="18" /></div>
              <div><div class="stat-label">Revenue</div><div class="stat-value">₹{{ totalRevenue }}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon slate"><app-icon name="star" [size]="18" /></div>
              <div><div class="stat-label">Reviews</div><div class="stat-value">{{ reviews.length }}</div></div>
            </div>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header"><span class="card-title">Basic Information</span></div>
              <div class="card-body">
                <dl class="definition-list">
                  <dt><app-icon name="tag" [size]="13" /> Type</dt><dd>{{ hotel.hotel_type | titlecase }}</dd>
                  <dt><app-icon name="star" [size]="13" /> Star category</dt><dd>{{ hotel.star_category ? hotel.star_category + ' Star' : '—' }}</dd>
                  <dt><app-icon name="phone" [size]="13" /> Phone</dt><dd>{{ hotel.phone || '—' }}</dd>
                  <dt><app-icon name="mail" [size]="13" /> Email</dt><dd>{{ hotel.email || '—' }}</dd>
                  <dt><app-icon name="globe" [size]="13" /> Website</dt>
                  <dd>
                    @if (hotel.website) { <a class="link-btn" [href]="hotel.website" target="_blank" rel="noopener">{{ hotel.website }}</a> }
                    @else { — }
                  </dd>
                </dl>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Location</span></div>
              <div class="card-body">
                <dl class="definition-list">
                  <dt><app-icon name="pin" [size]="13" /> Address</dt><dd>{{ hotel.address || '—' }}</dd>
                  <dt><app-icon name="pin" [size]="13" /> City</dt><dd>{{ hotel.city }}</dd>
                  <dt><app-icon name="pin" [size]="13" /> State</dt><dd>{{ hotel.state || '—' }}</dd>
                  <dt><app-icon name="globe" [size]="13" /> Country</dt><dd>{{ hotel.country || '—' }}</dd>
                  <dt><app-icon name="inbox" [size]="13" /> Pincode</dt><dd>{{ hotel.pincode || '—' }}</dd>
                  <dt><app-icon name="pin" [size]="13" /> Coordinates</dt>
                  <dd>{{ hotel.latitude && hotel.longitude ? hotel.latitude + ', ' + hotel.longitude : '—' }}</dd>
                </dl>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Policies</span></div>
              <div class="card-body">
                <div class="row-between" style="padding: 6px 0;">
                  <span class="muted"><app-icon name="clock" [size]="14" /> Check-in</span>
                  <span class="strong">{{ hotel.check_in_time }}</span>
                </div>
                <div class="row-between" style="padding: 6px 0;">
                  <span class="muted"><app-icon name="clock" [size]="14" /> Check-out</span>
                  <span class="strong">{{ hotel.check_out_time }}</span>
                </div>
                @for (policy of policyRows; track policy.label) {
                  <div class="row-between" style="padding: 6px 0;">
                    <span class="muted">{{ policy.label }}</span>
                    <span class="badge no-dot" [class]="policy.value ? 'badge-success' : 'badge-neutral'">
                      {{ policy.value ? policy.yes : policy.no }}
                    </span>
                  </div>
                }
                @if (hotel.policy_notes) { <p class="muted mt-16" style="font-size: 13px;">{{ hotel.policy_notes }}</p> }
              </div>
            </div>
          </div>

          @if (hotel.description) {
            <div class="card mt-16">
              <div class="card-header"><span class="card-title">About</span></div>
              <div class="card-body">
                <p class="muted" style="font-size: 13.5px; line-height: 1.7;">{{ hotel.description }}</p>
              </div>
            </div>
          }
        }

        <!-- GALLERY -->
        @if (tab === 'gallery') {
          <div class="card">
            <div class="card-header">
              <span class="card-title">Property Gallery</span>
              <select class="select" style="width: auto;" [(ngModel)]="uploadCategory">
                @for (cat of imageCategories; track cat) { <option [value]="cat">{{ cat | titlecase }}</option> }
              </select>
            </div>
            <div class="card-body">
              <div class="gallery">
                @for (img of images; track img.id) {
                  <div class="gallery-item">
                    <img [src]="fullUrl(img.url)" [alt]="img.category" />
                    @if (img.is_primary) { <span class="cover-flag">Cover</span> }
                    <div class="meta">
                      <span class="cell-muted">{{ img.category | titlecase }}</span>
                      <span class="row" style="gap: 10px;">
                        @if (!img.is_primary) {
                          <button class="link-btn" (click)="setPrimary(img)">Set cover</button>
                        }
                        <button class="link-btn danger" (click)="deleteImage(img)">
                          <app-icon name="trash" [size]="13" />
                        </button>
                      </span>
                    </div>
                  </div>
                }

                <label class="upload-drop">
                  <app-icon name="upload" [size]="20" />
                  <span class="strong" style="font-size: 13px;">Upload image</span>
                  <span>JPG or PNG · max 5 MB · added as "{{ uploadCategory }}"</span>
                  <input type="file" accept="image/*" (change)="onFileSelected($event)" />
                </label>
              </div>
            </div>
          </div>
        }

        <!-- AMENITIES -->
        @if (tab === 'amenities') {
          <div class="card">
            <div class="card-header">
              <span class="card-title">Hotel Amenities</span>
              <button class="btn btn-primary btn-sm" (click)="saveAmenities()">Save Amenities</button>
            </div>
            <div class="card-body">
              <div class="amenity-grid">
                @for (amenity of allAmenities; track amenity.id) {
                  <label class="checkbox-card" [class.checked]="selectedAmenityIds.has(amenity.id)">
                    <input type="checkbox" [checked]="selectedAmenityIds.has(amenity.id)" (change)="toggleAmenity(amenity.id)" />
                    {{ amenity.name }}
                  </label>
                }
              </div>

              <div class="row mt-16" style="gap: 8px; max-width: 420px;">
                <input class="input" type="text" placeholder="Add a custom amenity" [(ngModel)]="customAmenityName"
                       (keyup.enter)="addCustomAmenity()" />
                <button class="btn btn-secondary" (click)="addCustomAmenity()"><app-icon name="plus" [size]="14" /> Add</button>
              </div>
            </div>
          </div>
        }

        <!-- ROOMS -->
        @if (tab === 'rooms') {
          <div class="table-wrap">
            <div class="card-header">
              <span class="card-title">Room Types</span>
              <button class="btn btn-primary btn-sm" (click)="showAddRoom = true">
                <app-icon name="plus" [size]="14" /> Add Room Type
              </button>
            </div>
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr><th>Room Type</th><th>Capacity</th><th>Bed</th><th>View</th><th class="text-right">Inventory</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  @for (room of rooms; track room.id) {
                    <tr>
                      <td class="cell-strong">{{ room.name }}<div class="cell-muted">{{ room.size_label }}</div></td>
                      <td>{{ room.max_adults }} adults, {{ room.max_children }} children</td>
                      <td>{{ bedLabel(room.bed_type) }}</td>
                      <td>{{ viewLabel(room.room_view) }}</td>
                      <td class="text-right num">{{ room.total_rooms }}</td>
                      <td><span class="badge" [class]="badgeClass(room.status)">{{ room.status }}</span></td>
                      <td class="text-right">
                        <a class="link-btn" [routerLink]="['/hotels', hotel.id, 'rooms', room.id]">Manage</a>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="bed" [size]="22" /></span>
                        <span class="empty-title">No room types yet</span>
                        <span class="empty-text">Add a room type to configure occupancy, inventory and rate plans.</span>
                        <button class="btn btn-primary" (click)="showAddRoom = true"><app-icon name="plus" [size]="15" /> Add Room Type</button>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- BOOKINGS -->
        @if (tab === 'bookings') {
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr><th>Booking</th><th>Customer</th><th>Room</th><th>Check-in</th><th>Check-out</th><th class="text-right">Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  @for (booking of bookings; track booking.id) {
                    <tr class="clickable" [routerLink]="['/bookings', booking.id]">
                      <td class="cell-strong cell-mono">#{{ booking.id }}</td>
                      <td>{{ booking.customer_name }}</td>
                      <td>{{ booking.room_type_name }}</td>
                      <td class="num">{{ booking.check_in }}</td>
                      <td class="num">{{ booking.check_out }}</td>
                      <td class="text-right cell-strong num">₹{{ booking.total_amount }}</td>
                      <td><span class="badge" [class]="badgeClass(booking.booking_status)">{{ humanize(booking.booking_status) }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="calendar" [size]="22" /></span>
                        <span class="empty-title">No bookings for this hotel</span>
                        <span class="empty-text">Bookings will appear here once guests reserve rooms.</span>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- REVIEWS -->
        @if (tab === 'reviews') {
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th>Customer</th><th>Rating</th><th>Review</th><th>Status</th></tr></thead>
                <tbody>
                  @for (review of reviews; track review.id) {
                    <tr>
                      <td class="cell-strong">{{ review.customer_name }}</td>
                      <td><span class="star-rating"><app-icon name="star" [size]="13" /> {{ review.rating }}</span></td>
                      <td style="max-width: 420px;">{{ review.review_text }}</td>
                      <td><span class="badge" [class]="badgeClass(review.status)">{{ review.status }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="star" [size]="22" /></span>
                        <span class="empty-title">No reviews yet</span>
                        <span class="empty-text">Guest reviews for this property will be listed here.</span>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      } @else {
        <div class="card"><div class="card-body"><div class="skeleton" style="height: 180px;"></div></div></div>
      }
    </div>

    <!-- Add room type modal -->
    @if (showAddRoom) {
      <div class="modal-backdrop" (click)="showAddRoom = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Add Room Type</span>
            <button class="btn btn-ghost btn-icon" (click)="showAddRoom = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field span-2">
                <label class="field-label">Room Name <span class="req">*</span></label>
                <input class="input" type="text" [(ngModel)]="newRoom.name" placeholder="e.g. Deluxe Queen Room" />
              </div>
              <div class="field">
                <label class="field-label">Bed Type</label>
                <select class="select" [(ngModel)]="newRoom.bed_type">
                  @for (bed of bedTypes; track bed.value) { <option [value]="bed.value">{{ bed.label }}</option> }
                </select>
              </div>
              <div class="field">
                <label class="field-label">Room View</label>
                <select class="select" [(ngModel)]="newRoom.room_view">
                  @for (view of viewTypes; track view.value) { <option [value]="view.value">{{ view.label }}</option> }
                </select>
              </div>
              <div class="field span-2">
                <label class="field-label">Room Size</label>
                <input class="input" type="text" [(ngModel)]="newRoom.size_label" placeholder="210 sq.ft / 20 sq.mt" />
              </div>
              <div class="field">
                <label class="field-label">Max Adults</label>
                <input class="input" type="number" min="1" [(ngModel)]="newRoom.max_adults" />
              </div>
              <div class="field">
                <label class="field-label">Max Children</label>
                <input class="input" type="number" min="0" [(ngModel)]="newRoom.max_children" />
              </div>
              <div class="field">
                <label class="field-label">Max Occupancy</label>
                <input class="input" type="number" min="1" [(ngModel)]="newRoom.max_occupancy" />
              </div>
              <div class="field">
                <label class="field-label">Total Rooms <span class="req">*</span></label>
                <input class="input" type="number" min="0" [(ngModel)]="newRoom.total_rooms" />
              </div>
              @if (roomError) { <div class="alert alert-danger span-2">{{ roomError }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showAddRoom = false">Cancel</button>
            <button class="btn btn-primary" (click)="createRoom()">Save Room Type</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .hero-card {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        padding: 20px;
        margin-bottom: 20px;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-xs);
      }
      .hero-main { display: flex; gap: 16px; align-items: flex-start; min-width: 0; }
      .hotel-avatar {
        display: grid;
        place-items: center;
        width: 84px; height: 84px;
        border-radius: var(--r-lg);
        background: var(--gray-100);
        color: var(--gray-400);
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid var(--border);
      }
      .hotel-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .hero-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
      .hero-meta-item { display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 12.5px; }
      .amenity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
      .definition-list dt { display: inline-flex; align-items: center; gap: 6px; }
    `,
  ],
})
export class HotelDetailComponent implements OnInit {
  hotel: Hotel | null = null;
  images: HotelImage[] = [];
  rooms: RoomType[] = [];
  bookings: Booking[] = [];
  reviews: Review[] = [];

  tab: Tab = 'overview';
  allAmenities: Amenity[] = [];
  selectedAmenityIds = new Set<number>();
  customAmenityName = '';

  uploadCategory = 'exterior';
  imageCategories = IMAGE_CATEGORIES;

  showAddRoom = false;
  roomError = '';
  newRoom: any = { name: '', bed_type: 'queen', room_view: 'city', size_label: '', max_adults: 2, max_children: 0, max_occupancy: 2, total_rooms: 1 };

  bedTypes = [
    { value: 'queen', label: 'Queen Bed' }, { value: 'king', label: 'King Bed' },
    { value: 'twin', label: 'Twin Beds' }, { value: 'double', label: 'Double Bed' },
    { value: 'single', label: 'Single Bed' }, { value: 'sofa_bed', label: 'Sofa Bed' },
  ];
  viewTypes = [
    { value: 'city', label: 'City View' }, { value: 'pool', label: 'Pool View' },
    { value: 'garden', label: 'Garden View' }, { value: 'sea', label: 'Sea View' },
    { value: 'mountain', label: 'Mountain View' }, { value: 'other', label: 'Other' },
  ];

  constructor(
    private hotelService: HotelService,
    private amenityService: AmenityService,
    private roomService: RoomService,
    private bookingService: BookingService,
    private reviewService: ReviewService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  get hotelId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  get tabs() {
    return [
      { key: 'overview' as Tab, label: 'Overview', count: undefined },
      { key: 'gallery' as Tab, label: 'Gallery', count: this.images.length },
      { key: 'amenities' as Tab, label: 'Amenities', count: this.selectedAmenityIds.size },
      { key: 'rooms' as Tab, label: 'Rooms', count: this.rooms.length },
      { key: 'bookings' as Tab, label: 'Bookings', count: this.bookings.length },
      { key: 'reviews' as Tab, label: 'Reviews', count: this.reviews.length },
    ];
  }

  get coverUrl(): string | null {
    const primary = this.images.find((i) => i.is_primary) || this.images[0];
    return primary ? this.fullUrl(primary.url) : null;
  }

  get mapUrl(): string {
    return `https://www.google.com/maps/search/?api=1&query=${this.hotel?.latitude},${this.hotel?.longitude}`;
  }

  get policyRows() {
    const h = this.hotel!;
    return [
      { label: 'Early check-in', value: h.early_checkin_available, yes: 'Available', no: 'Not available' },
      { label: 'Late check-out', value: h.late_checkout_available, yes: 'Available', no: 'Not available' },
      { label: 'Pets', value: h.pets_allowed, yes: 'Allowed', no: 'Not allowed' },
      { label: 'Smoking', value: h.smoking_allowed, yes: 'Allowed', no: 'Not allowed' },
      { label: 'Children', value: h.children_allowed, yes: 'Allowed', no: 'Not allowed' },
    ];
  }

  get totalRevenue(): string {
    const total = this.bookings
      .filter((b) => b.booking_status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.total_amount), 0);
    return total.toLocaleString('en-IN');
  }

  ngOnInit(): void {
    this.load();
    this.amenityService.list('hotel').subscribe((a) => {
      this.allAmenities = a;
      this.cdr.markForCheck();
    });
    this.roomService.listByHotel(this.hotelId).subscribe((rooms) => {
      this.rooms = rooms;
      this.cdr.markForCheck();
    });
    this.bookingService.list({ hotelId: String(this.hotelId) }).subscribe((res) => {
      this.bookings = res.data;
      this.cdr.markForCheck();
    });
    this.reviewService.list({ hotelId: String(this.hotelId) }).subscribe((r) => {
      this.reviews = r;
      this.cdr.markForCheck();
    });
  }

  load(): void {
    this.hotelService.get(this.hotelId).subscribe((hotel) => {
      this.hotel = hotel;
      this.images = hotel.images || [];
      this.selectedAmenityIds = new Set((hotel.amenities || []).map((a) => a.id));
      this.cdr.markForCheck();
    });
  }

  fullUrl(path: string): string {
    return assetUrl(path);
  }

  bedLabel(value: string): string {
    return this.bedTypes.find((b) => b.value === value)?.label ?? value ?? '—';
  }

  viewLabel(value: string): string {
    return this.viewTypes.find((v) => v.value === value)?.label ?? value ?? '—';
  }

  toggleStatus(): void {
    if (!this.hotel) return;
    const nextStatus = this.hotel.status === 'active' ? 'inactive' : 'active';
    this.hotelService.update(this.hotel.id, { status: nextStatus }).subscribe((hotel) => {
      this.hotel = { ...this.hotel!, ...hotel };
      this.toast.success(`Hotel ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      this.cdr.markForCheck();
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.hotelService.uploadImage(this.hotelId, file, this.uploadCategory).subscribe({
      next: (image) => {
        this.images = [...this.images, image];
        input.value = '';
        this.toast.success('Image uploaded');
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Upload failed'),
    });
  }

  setPrimary(image: HotelImage): void {
    this.hotelService.setPrimaryImage(this.hotelId, image.id).subscribe(() => {
      this.load();
      this.toast.success('Cover image updated');
    });
  }

  async deleteImage(image: HotelImage): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete image?',
      message: 'This image will be removed from the hotel gallery. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    this.hotelService.deleteImage(this.hotelId, image.id).subscribe(() => {
      this.images = this.images.filter((i) => i.id !== image.id);
      this.toast.success('Image deleted');
      this.cdr.markForCheck();
    });
  }

  toggleAmenity(id: number): void {
    if (this.selectedAmenityIds.has(id)) this.selectedAmenityIds.delete(id);
    else this.selectedAmenityIds.add(id);
  }

  addCustomAmenity(): void {
    if (!this.customAmenityName.trim()) return;
    this.amenityService.createCustom(this.customAmenityName.trim(), 'hotel').subscribe((amenity) => {
      this.allAmenities = [...this.allAmenities, amenity];
      this.selectedAmenityIds.add(amenity.id);
      this.customAmenityName = '';
      this.cdr.markForCheck();
    });
  }

  saveAmenities(): void {
    this.hotelService.updateAmenities(this.hotelId, Array.from(this.selectedAmenityIds)).subscribe(() => {
      this.toast.success('Amenities saved');
      this.cdr.markForCheck();
    });
  }

  createRoom(): void {
    this.roomError = '';
    if (!this.newRoom.name.trim()) {
      this.roomError = 'Room name is required.';
      return;
    }
    if (Number(this.newRoom.total_rooms) < 0) {
      this.roomError = 'Total rooms must be 0 or more.';
      return;
    }
    this.roomService.create(this.hotelId, this.newRoom).subscribe({
      next: (room) => {
        this.rooms = [...this.rooms, room];
        this.showAddRoom = false;
        this.toast.success('Room type created');
        this.newRoom = { name: '', bed_type: 'queen', room_view: 'city', size_label: '', max_adults: 2, max_children: 0, max_occupancy: 2, total_rooms: 1 };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.roomError = err.error?.message || 'Failed to create room type';
        this.cdr.markForCheck();
      },
    });
  }

  badgeClass = statusBadgeClass;

  humanize(value: string): string {
    return (value || '').replace(/_/g, ' ');
  }
}
