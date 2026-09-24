import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { assetUrl } from '../shared/asset-url';
import { InventoryRow, RatePlan, RoomImage, RoomService, RoomType } from './room.service';
import { Amenity } from './hotel.service';
import { AmenityService } from './amenity.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { statusBadgeClass } from '../shared/status';

const MEAL_OPTIONS = [
  { value: 'no_meals', label: 'No Meals' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'breakfast_lunch', label: 'Breakfast + Lunch' },
  { value: 'breakfast_dinner', label: 'Breakfast + Dinner' },
  { value: 'all_meals', label: 'All Meals' },
];

type Tab = 'details' | 'images' | 'amenities' | 'inventory' | 'rates';

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <a class="back-link" [routerLink]="['/hotels', hotelId]"><app-icon name="arrowLeft" [size]="14" /> Back to hotel</a>

      @if (room) {
        <div class="page-header">
          <div>
            <div class="row wrap">
              <h1 class="page-title">{{ room.name }}</h1>
              <span class="badge" [class]="badgeClass(room.status)">{{ room.status }}</span>
            </div>
            <p class="page-subtitle">
              {{ room.size_label || 'Size not set' }} · {{ room.bed_type || '—' }} ·
              max {{ room.max_occupancy }} guests · {{ room.total_rooms }} rooms
            </p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" (click)="showEdit = true"><app-icon name="edit" [size]="15" /> Edit Room</button>
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

        <!-- DETAILS -->
        @if (tab === 'details') {
          <div class="grid-2">
            <div class="card">
              <div class="card-header"><span class="card-title">Room Details</span></div>
              <div class="card-body">
                <dl class="definition-list">
                  <dt>Bed type</dt><dd>{{ room.bed_type || '—' }}</dd>
                  <dt>Room view</dt><dd>{{ room.room_view || '—' }}</dd>
                  <dt>Size</dt><dd>{{ room.size_label || '—' }}</dd>
                  <dt>Max adults</dt><dd>{{ room.max_adults }}</dd>
                  <dt>Max children</dt><dd>{{ room.max_children }}</dd>
                  <dt>Max occupancy</dt><dd>{{ room.max_occupancy }}</dd>
                  <dt>Total inventory</dt><dd>{{ room.total_rooms }} rooms</dd>
                </dl>
                @if (room.description) { <p class="muted mt-16" style="font-size: 13.5px;">{{ room.description }}</p> }
              </div>
            </div>

            <div class="card">
              <div class="card-header"><span class="card-title">Pricing Summary</span></div>
              <div class="card-body">
                @if (ratePlans.length) {
                  <div class="stat-label">Starting from</div>
                  <div class="stat-value">₹{{ lowestPrice }}</div>
                  <p class="muted mt-8" style="font-size: 13px;">
                    Across {{ ratePlans.length }} rate plan{{ ratePlans.length === 1 ? '' : 's' }}.
                    Taxes and fees are applied at booking time.
                  </p>
                } @else {
                  <p class="muted" style="font-size: 13px;">No rate plans yet — this room is not bookable until one exists.</p>
                  <button class="btn btn-primary btn-sm mt-16" (click)="tab = 'rates'; showAddRate = true">
                    <app-icon name="plus" [size]="14" /> Add Rate Plan
                  </button>
                }
              </div>
            </div>
          </div>
        }

        <!-- IMAGES -->
        @if (tab === 'images') {
          <div class="card">
            <div class="card-header">
              <span class="card-title">Room Images</span>
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
                        @if (!img.is_primary) { <button class="link-btn" (click)="setPrimary(img)">Set cover</button> }
                        <button class="link-btn danger" (click)="deleteImage(img)"><app-icon name="trash" [size]="13" /></button>
                      </span>
                    </div>
                  </div>
                }
                <label class="upload-drop">
                  <app-icon name="upload" [size]="20" />
                  <span class="strong" style="font-size: 13px;">Upload image</span>
                  <span>Added as "{{ uploadCategory }}"</span>
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
              <span class="card-title">Room Amenities</span>
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
            </div>
          </div>
        }

        <!-- INVENTORY -->
        @if (tab === 'inventory') {
          <div class="card" style="margin-bottom: 16px;">
            <div class="card-header"><span class="card-title">Set Availability</span></div>
            <div class="card-body">
              <div class="row wrap" style="gap: 12px; align-items: flex-end;">
                <div class="field"><label class="field-label">From</label><input class="input" type="date" [(ngModel)]="invFrom" /></div>
                <div class="field"><label class="field-label">To</label><input class="input" type="date" [(ngModel)]="invTo" /></div>
                <div class="field"><label class="field-label">Rooms available per night</label>
                  <input class="input" type="number" min="0" [(ngModel)]="invTotal" style="width: 180px;" /></div>
                <button class="btn btn-primary" (click)="applyInventory()">Apply to range</button>
                <button class="btn btn-secondary" (click)="loadInventory()"><app-icon name="refresh" [size]="14" /> Refresh</button>
              </div>
            </div>
          </div>

          <div class="table-wrap">
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th>Date</th><th class="text-right">Total</th><th class="text-right">Booked</th><th class="text-right">Blocked</th><th class="text-right">Available</th><th>Occupancy</th></tr></thead>
                <tbody>
                  @for (row of inventory; track row.date) {
                    <tr>
                      <td class="cell-strong num">{{ row.date }}</td>
                      <td class="text-right num">{{ row.total }}</td>
                      <td class="text-right num">{{ row.booked }}</td>
                      <td class="text-right num">{{ row.blocked }}</td>
                      <td class="text-right num">
                        <span class="badge no-dot" [class]="row.available === 0 ? 'badge-danger' : row.available <= 2 ? 'badge-warning' : 'badge-success'">
                          {{ row.available }}
                        </span>
                      </td>
                      <td style="width: 160px;">
                        <div class="bar-meter"><span [style.width.%]="occupancy(row)"></span></div>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="calendar" [size]="22" /></span>
                        <span class="empty-title">No inventory configured</span>
                        <span class="empty-text">Set availability for a date range above — rooms can't be booked on dates without inventory.</span>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- RATE PLANS -->
        @if (tab === 'rates') {
          <div class="table-wrap">
            <div class="card-header">
              <span class="card-title">Rate Plans</span>
              <button class="btn btn-primary btn-sm" (click)="showAddRate = true"><app-icon name="plus" [size]="14" /> Add Rate Plan</button>
            </div>
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th>Rate Plan</th><th class="text-right">Price / Night</th><th>Meal Inclusion</th><th>Cancellation</th><th>Status</th></tr></thead>
                <tbody>
                  @for (plan of ratePlans; track plan.id) {
                    <tr>
                      <td class="cell-strong">
                        {{ plan.name }}
                        @if (plan.inclusions?.length) {
                          <div class="cell-muted">{{ inclusionLabels(plan) }}</div>
                        }
                      </td>
                      <td class="text-right cell-strong num">₹{{ plan.price }}</td>
                      <td>{{ mealLabel(plan.meal_inclusion) }}</td>
                      <td>
                        <span class="badge no-dot" [class]="plan.refundable ? 'badge-success' : 'badge-neutral'">
                          {{ plan.refundable ? 'Refundable' : 'Non-refundable' }}
                        </span>
                      </td>
                      <td><span class="badge" [class]="badgeClass(plan.status)">{{ plan.status }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5">
                      <div class="empty-state">
                        <span class="empty-icon"><app-icon name="tag" [size]="22" /></span>
                        <span class="empty-title">No rate plans yet</span>
                        <span class="empty-text">Rate plans define pricing and meal inclusions — a room needs at least one to be bookable.</span>
                        <button class="btn btn-primary" (click)="showAddRate = true"><app-icon name="plus" [size]="15" /> Add Rate Plan</button>
                      </div>
                    </td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>

    <!-- Add rate plan modal -->
    @if (showAddRate) {
      <div class="modal-backdrop" (click)="showAddRate = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Add Rate Plan</span>
            <button class="btn btn-ghost btn-icon" (click)="showAddRate = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field span-2">
                <label class="field-label">Rate Plan Name <span class="req">*</span></label>
                <input class="input" type="text" [(ngModel)]="newRate.name" placeholder="e.g. Room with Breakfast" />
              </div>
              <div class="field">
                <label class="field-label">Price per Night <span class="req">*</span></label>
                <input class="input" type="number" min="0" [(ngModel)]="newRate.price" />
              </div>
              <div class="field">
                <label class="field-label">Meal Inclusion</label>
                <select class="select" [(ngModel)]="newRate.meal_inclusion">
                  @for (meal of mealOptions; track meal.value) { <option [value]="meal.value">{{ meal.label }}</option> }
                </select>
              </div>
              <div class="field span-2">
                <label class="field-label">Inclusions</label>
                <input class="input" type="text" [(ngModel)]="newRateInclusions" placeholder="Breakfast, Early check-in, Laundry discount" />
                <span class="field-hint">Comma separated — each becomes a separate inclusion.</span>
              </div>
              <div class="span-2">
                <label class="switch-row">
                  <span>Refundable</span>
                  <input type="checkbox" [(ngModel)]="newRate.refundable" />
                </label>
              </div>
              @if (newRate.refundable) {
                <div class="field span-2">
                  <label class="field-label">Cancellation slabs</label>
                  <input class="input" type="text" [(ngModel)]="newRateSlabs" placeholder="7:100, 3:50, 0:0" />
                  <span class="field-hint">Format <code>daysBeforeCheckIn:refundPercent</code> — e.g. "7:100, 3:50, 0:0".</span>
                </div>
              }
              @if (rateError) { <div class="alert alert-danger span-2">{{ rateError }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showAddRate = false">Cancel</button>
            <button class="btn btn-primary" (click)="createRatePlan()">Save Rate Plan</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit room modal -->
    @if (showEdit && room) {
      <div class="modal-backdrop" (click)="showEdit = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Edit Room Type</span>
            <button class="btn btn-ghost btn-icon" (click)="showEdit = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field span-2"><label class="field-label">Room Name</label><input class="input" [(ngModel)]="room.name" /></div>
              <div class="field span-2"><label class="field-label">Description</label><textarea class="textarea" [(ngModel)]="room.description" rows="2"></textarea></div>
              <div class="field"><label class="field-label">Size</label><input class="input" [(ngModel)]="room.size_label" /></div>
              <div class="field"><label class="field-label">Total Rooms</label><input class="input" type="number" min="0" [(ngModel)]="room.total_rooms" /></div>
              <div class="field"><label class="field-label">Max Adults</label><input class="input" type="number" min="1" [(ngModel)]="room.max_adults" /></div>
              <div class="field"><label class="field-label">Max Children</label><input class="input" type="number" min="0" [(ngModel)]="room.max_children" /></div>
              <div class="field"><label class="field-label">Max Occupancy</label><input class="input" type="number" min="1" [(ngModel)]="room.max_occupancy" /></div>
              <div class="field">
                <label class="field-label">Status</label>
                <select class="select" [(ngModel)]="room.status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showEdit = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveRoom()">Save changes</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`.amenity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }`],
})
export class RoomDetailComponent implements OnInit {
  room: RoomType | null = null;
  images: RoomImage[] = [];
  ratePlans: RatePlan[] = [];
  inventory: InventoryRow[] = [];

  tab: Tab = 'details';
  allAmenities: Amenity[] = [];
  selectedAmenityIds = new Set<number>();

  uploadCategory = 'bedroom';
  imageCategories = ['bedroom', 'bathroom', 'view', 'balcony', 'other'];

  invFrom = '';
  invTo = '';
  invTotal = 5;

  showAddRate = false;
  showEdit = false;
  rateError = '';
  mealOptions = MEAL_OPTIONS;
  newRate: any = { name: '', price: 0, meal_inclusion: 'no_meals', refundable: true };
  newRateInclusions = '';
  newRateSlabs = '';

  constructor(
    private roomService: RoomService,
    private amenityService: AmenityService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  get hotelId(): number {
    return Number(this.route.snapshot.paramMap.get('hotelId'));
  }

  get roomId(): number {
    return Number(this.route.snapshot.paramMap.get('roomId'));
  }

  get tabs() {
    return [
      { key: 'details' as Tab, label: 'Details', count: undefined },
      { key: 'images' as Tab, label: 'Images', count: this.images.length },
      { key: 'amenities' as Tab, label: 'Amenities', count: this.selectedAmenityIds.size },
      { key: 'inventory' as Tab, label: 'Inventory', count: this.inventory.length },
      { key: 'rates' as Tab, label: 'Rate Plans', count: this.ratePlans.length },
    ];
  }

  get lowestPrice(): string {
    const min = Math.min(...this.ratePlans.map((p) => Number(p.price)));
    return Number.isFinite(min) ? min.toLocaleString('en-IN') : '—';
  }

  ngOnInit(): void {
    this.load();
    this.amenityService.list('room').subscribe((a) => {
      this.allAmenities = a;
      this.cdr.markForCheck();
    });

    const today = new Date();
    const nextWeek = new Date(today.getTime() + 13 * 86400000);
    this.invFrom = today.toISOString().slice(0, 10);
    this.invTo = nextWeek.toISOString().slice(0, 10);
    this.loadInventory();
  }

  load(): void {
    this.roomService.get(this.roomId).subscribe((room) => {
      this.room = room;
      this.images = room.images || [];
      this.ratePlans = room.ratePlans || [];
      this.selectedAmenityIds = new Set((room.amenities || []).map((a) => a.id));
      this.cdr.markForCheck();
    });
  }

  loadInventory(): void {
    this.roomService.getInventory(this.roomId, this.invFrom, this.invTo).subscribe((rows) => {
      this.inventory = rows;
      this.cdr.markForCheck();
    });
  }

  occupancy(row: InventoryRow): number {
    if (!row.total) return 0;
    return Math.round(((row.booked + row.blocked) / row.total) * 100);
  }

  fullUrl(path: string): string {
    return assetUrl(path);
  }

  mealLabel(value: string): string {
    return MEAL_OPTIONS.find((m) => m.value === value)?.label ?? value;
  }

  inclusionLabels(plan: RatePlan): string {
    return (plan.inclusions || []).map((i) => i.label).join(' · ');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.roomService.uploadImage(this.roomId, file, this.uploadCategory).subscribe({
      next: (image) => {
        this.images = [...this.images, image];
        input.value = '';
        this.toast.success('Image uploaded');
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Upload failed'),
    });
  }

  setPrimary(image: RoomImage): void {
    this.roomService.setPrimaryImage(this.roomId, image.id).subscribe(() => {
      this.load();
      this.toast.success('Cover image updated');
    });
  }

  async deleteImage(image: RoomImage): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete image?',
      message: 'This image will be removed from the room gallery.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    this.roomService.deleteImage(this.roomId, image.id).subscribe(() => {
      this.images = this.images.filter((i) => i.id !== image.id);
      this.toast.success('Image deleted');
      this.cdr.markForCheck();
    });
  }

  toggleAmenity(id: number): void {
    if (this.selectedAmenityIds.has(id)) this.selectedAmenityIds.delete(id);
    else this.selectedAmenityIds.add(id);
  }

  saveAmenities(): void {
    this.roomService.updateAmenities(this.roomId, Array.from(this.selectedAmenityIds)).subscribe(() => {
      this.toast.success('Amenities saved');
    });
  }

  saveRoom(): void {
    if (!this.room) return;
    this.roomService.update(this.roomId, this.room).subscribe({
      next: () => {
        this.showEdit = false;
        this.toast.success('Room updated');
        this.load();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Failed to update room');
        this.cdr.markForCheck();
      },
    });
  }

  applyInventory(): void {
    if (Number(this.invTotal) < 0) {
      this.toast.error('Inventory must be 0 or more');
      return;
    }
    const dates: { date: string; total: number }[] = [];
    const cursor = new Date(`${this.invFrom}T00:00:00Z`);
    const end = new Date(`${this.invTo}T00:00:00Z`);
    while (cursor <= end) {
      dates.push({ date: cursor.toISOString().slice(0, 10), total: Number(this.invTotal) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    this.roomService.setInventory(this.roomId, dates).subscribe(() => {
      this.loadInventory();
      this.toast.success(`Inventory updated for ${dates.length} night(s)`);
    });
  }

  createRatePlan(): void {
    this.rateError = '';
    if (!this.newRate.name.trim()) {
      this.rateError = 'Rate plan name is required.';
      return;
    }
    if (Number(this.newRate.price) < 0) {
      this.rateError = 'Price must be 0 or more.';
      return;
    }

    const inclusions = this.newRateInclusions.split(',').map((s) => s.trim()).filter(Boolean);
    const cancellationSlabs = this.newRateSlabs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const [days, refund] = pair.split(':').map((n) => Number(n.trim()));
        return { daysBeforeCheckin: days, refundPercent: refund };
      });

    this.roomService.createRatePlan(this.roomId, { ...this.newRate, inclusions, cancellationSlabs }).subscribe({
      next: () => {
        this.showAddRate = false;
        this.toast.success('Rate plan created');
        this.load();
        this.newRate = { name: '', price: 0, meal_inclusion: 'no_meals', refundable: true };
        this.newRateInclusions = '';
        this.newRateSlabs = '';
      },
      error: (err) => {
        this.rateError = err.error?.message || 'Failed to create rate plan';
        this.cdr.markForCheck();
      },
    });
  }

  badgeClass = statusBadgeClass;
}
