import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { Offer, OfferPayload, OfferService, OfferTheme } from './offer.service';
import { Coupon, CouponService } from '../coupons/coupon.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';

/** Same palettes as the website's offer artwork (web/app/components/art), so the preview matches. */
export const THEMES: { value: OfferTheme; label: string; bg: string }[] = [
  { value: 'beach', label: 'Beach', bg: 'linear-gradient(160deg, #ff8a4c 0%, #ffc26b 55%, #1e88c7 56%, #0f5f96 100%)' },
  { value: 'mountains', label: 'Mountains', bg: 'linear-gradient(160deg, #5b7fd6 0%, #b9c8f0 55%, #3d5a99 56%, #22365f 100%)' },
  { value: 'city', label: 'City lights', bg: 'linear-gradient(160deg, #1d1446 0%, #6b3aa0 60%, #2a1f55 61%, #120c2c 100%)' },
  { value: 'heritage', label: 'Heritage', bg: 'linear-gradient(160deg, #d9662a 0%, #f5bd55 58%, #b8572a 59%, #7a3417 100%)' },
  { value: 'forest', label: 'Forest', bg: 'linear-gradient(160deg, #1f6f55 0%, #86cf9a 58%, #1c5a45 59%, #0e3a2c 100%)' },
  { value: 'festive', label: 'Festive', bg: 'linear-gradient(160deg, #a51f55 0%, #f07a3a 60%, #7d1740 61%, #4c0d27 100%)' },
];

const LINK_PRESETS = [
  { label: 'All hotels', url: '/hotels' },
  { label: 'Goa', url: '/hotels?city=Goa' },
  { label: 'Free cancellation', url: '/hotels?freeCancellation=true' },
  { label: 'Offers page', url: '/offers' },
];

type Draft = {
  title: string;
  subtitle: string;
  badge: string;
  terms: string;
  couponId: number | null;
  theme: OfferTheme;
  ctaLabel: string;
  ctaUrl: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  showAtCheckout: boolean;
  sortOrder: number;
};

const emptyDraft = (): Draft => ({
  title: '', subtitle: '', badge: 'Hotel deal', terms: '', couponId: null, theme: 'beach',
  ctaLabel: 'Book now', ctaUrl: '/hotels', validFrom: '', validUntil: '', isActive: true, showAtCheckout: true, sortOrder: 0,
});

@Component({
  selector: 'app-offers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Offers</h1>
          <p class="page-subtitle">
            Banners shown on the website's homepage, Offers page and checkout. Only offers listed here are ever shown to guests.
          </p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" [size]="15" /> Create Offer</button>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.value) {
          <button class="tab" [class.active]="filter === t.value" (click)="filter = t.value">
            {{ t.label }} <span class="tab-count">{{ count(t.value) }}</span>
          </button>
        }
      </div>

      @if (loading) {
        <div class="offer-grid">
          @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height: 250px; border-radius: 14px;"></div> }
        </div>
      } @else if (!visible.length) {
        <div class="card">
          <div class="empty-state">
            <span class="empty-icon"><app-icon name="gift" [size]="22" /></span>
            <span class="empty-title">{{ offers.length ? 'No offers in this view' : 'No offers yet' }}</span>
            <span class="empty-text">
              Create an offer to feature a deal on the website. Link it to a coupon so guests can apply the code at checkout.
            </span>
            <button class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" [size]="15" /> Create Offer</button>
          </div>
        </div>
      } @else {
        <div class="offer-grid">
          @for (offer of visible; track offer.id) {
            <article class="card offer-card" [class.muted]="offer.status.key !== 'live'">
              <div class="banner" [style.background]="bannerBg(offer.theme, offer.image_url)">
                @if (imageUrl(offer.image_url); as src) { <img [src]="src" alt="" /> }
                <div class="banner-shade"></div>
                <div class="banner-text">
                  @if (offer.badge) { <span class="banner-badge">{{ offer.badge }}</span> }
                  <span class="banner-title">{{ offer.title }}</span>
                  @if (offer.subtitle) { <span class="banner-sub">{{ offer.subtitle }}</span> }
                </div>
                <span class="badge status" [class]="statusClass(offer.status.key)">{{ offer.status.label }}</span>
              </div>
              <div class="card-body offer-meta">
                <div class="row-between">
                  @if (offer.coupon_code) {
                    <span class="badge badge-brand no-dot cell-mono">{{ offer.coupon_code }}</span>
                  } @else {
                    <span class="cell-muted">No coupon (info banner)</span>
                  }
                  <span class="cell-muted">#{{ offer.sort_order }}</span>
                </div>
                <div class="cell-muted">
                  {{ offer.valid_from || 'Now' }} → {{ offer.valid_until || 'No end date' }}
                  @if (offer.coupon_code && offer.show_at_checkout) { · shown at checkout }
                </div>
                @if (offer.status.key === 'coupon_unavailable') {
                  <div class="alert alert-warning" style="padding: 6px 10px; font-size: 12px;">
                    Hidden on the website because coupon {{ offer.coupon_code }} is inactive or outside its dates.
                  </div>
                }
                <div class="row-actions">
                  <button class="link-btn" (click)="openEdit(offer)">Edit</button>
                  <button class="link-btn" (click)="toggleActive(offer)">{{ offer.is_active ? 'Hide' : 'Publish' }}</button>
                  <button class="link-btn danger" (click)="remove(offer)">Delete</button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (showForm) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal offer-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">{{ editing ? 'Edit offer' : 'Create offer' }}</span>
            <button class="btn btn-ghost btn-icon" (click)="close()"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body offer-form">
            <div class="form-grid">
              <div class="field span-2">
                <label class="field-label">Title <span class="req">*</span></label>
                <input class="input" maxlength="120" [(ngModel)]="draft.title" placeholder="Flat ₹500 off on beach stays" />
              </div>
              <div class="field span-2">
                <label class="field-label">Subtitle</label>
                <input class="input" maxlength="300" [(ngModel)]="draft.subtitle" placeholder="On bookings above ₹5,000 in Goa" />
              </div>
              <div class="field">
                <label class="field-label">Badge</label>
                <input class="input" maxlength="40" [(ngModel)]="draft.badge" placeholder="Hotel deal" />
              </div>
              <div class="field">
                <label class="field-label">Linked coupon</label>
                <select class="select" [(ngModel)]="draft.couponId">
                  <option [ngValue]="null">No coupon — info banner only</option>
                  @for (c of coupons; track c.id) {
                    <option [ngValue]="c.id">{{ c.code }} · {{ couponLabel(c) }}{{ c.active ? '' : ' (inactive)' }}</option>
                  }
                </select>
                <span class="field-hint">Guests see and can apply this code. <a routerLink="/coupons" (click)="close()">Manage coupons</a></span>
              </div>

              <div class="field span-2">
                <label class="field-label">Artwork</label>
                <div class="theme-row">
                  @for (t of themes; track t.value) {
                    <button type="button" class="theme-swatch" [class.selected]="draft.theme === t.value"
                            [style.background]="t.bg" (click)="draft.theme = t.value" [title]="t.label">
                      <span>{{ t.label }}</span>
                    </button>
                  }
                </div>
                <div class="row" style="gap: 10px; margin-top: 8px; flex-wrap: wrap;">
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
                    <app-icon name="upload" [size]="14" /> {{ previewImage ? 'Replace banner image' : 'Upload banner image' }}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pickImage($event)" />
                  </label>
                  @if (previewImage) {
                    <button type="button" class="link-btn danger" (click)="clearImage()">Remove image</button>
                  }
                  <span class="field-hint">Optional. JPG/PNG/WEBP up to 5 MB, ideally 1200×600. Without one, the illustration above is used.</span>
                </div>
              </div>

              <div class="field">
                <label class="field-label">Button label</label>
                <input class="input" maxlength="40" [(ngModel)]="draft.ctaLabel" placeholder="Book now" />
              </div>
              <div class="field">
                <label class="field-label">Button link</label>
                <input class="input cell-mono" maxlength="255" [(ngModel)]="draft.ctaUrl" placeholder="/hotels?city=Goa" />
                <span class="field-hint">
                  @for (p of linkPresets; track p.url) {
                    <button type="button" class="link-btn" style="margin-right: 8px;" (click)="draft.ctaUrl = p.url">{{ p.label }}</button>
                  }
                </span>
              </div>
              <div class="field">
                <label class="field-label">Show from</label>
                <input class="input" type="date" [(ngModel)]="draft.validFrom" />
              </div>
              <div class="field">
                <label class="field-label">Show until</label>
                <input class="input" type="date" [(ngModel)]="draft.validUntil" />
                <span class="field-hint">Leave empty to follow the coupon's own dates.</span>
              </div>
              <div class="field">
                <label class="field-label">Sort order</label>
                <input class="input" type="number" min="0" [(ngModel)]="draft.sortOrder" />
                <span class="field-hint">Lower numbers appear first.</span>
              </div>
              <div class="field" style="justify-content: flex-end; gap: 8px;">
                <label class="checkbox"><input type="checkbox" [(ngModel)]="draft.isActive" /> Published on website</label>
                <label class="checkbox"><input type="checkbox" [(ngModel)]="draft.showAtCheckout" [disabled]="!draft.couponId" /> Suggest at checkout</label>
              </div>
              <div class="field span-2">
                <label class="field-label">Terms &amp; conditions</label>
                <textarea class="textarea" maxlength="2000" [(ngModel)]="draft.terms" placeholder="Valid on select properties. Cannot be combined with other offers."></textarea>
              </div>
              @if (error) { <div class="alert alert-danger span-2">{{ error }}</div> }
            </div>

            <aside class="preview">
              <span class="field-label">Website preview</span>
              <div class="banner preview-banner" [style.background]="themeBg(draft.theme)">
                @if (previewImage) { <img [src]="previewImage" alt="" /> }
                <div class="banner-shade"></div>
                <div class="banner-text">
                  @if (draft.badge) { <span class="banner-badge">{{ draft.badge }}</span> }
                  <span class="banner-title">{{ draft.title || 'Your offer title' }}</span>
                  @if (draft.subtitle) { <span class="banner-sub">{{ draft.subtitle }}</span> }
                  <span class="preview-foot">
                    @if (selectedCoupon; as c) { <span class="preview-code">{{ c.code }}</span> }
                    @if (draft.ctaLabel) { <span class="preview-cta">{{ draft.ctaLabel }} →</span> }
                  </span>
                </div>
              </div>
              <p class="field-hint" style="margin-top: 8px;">
                @if (!draft.isActive) { Hidden — guests won't see this until you publish it. }
                @else if (selectedCoupon && !selectedCoupon.active) { Linked coupon is inactive, so this offer stays hidden. }
                @else { Visible on the website within the dates you set. }
              </p>
            </aside>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="close()" [disabled]="saving">Cancel</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="saving">{{ saving ? 'Saving…' : editing ? 'Save changes' : 'Create offer' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tab-count { margin-left: 4px; font-size: 11px; color: var(--text-muted); }
      .offer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap: 16px; }
      .offer-card { overflow: hidden; display: flex; flex-direction: column; }
      .offer-card.muted .banner { filter: saturate(.55); }
      .offer-meta { display: flex; flex-direction: column; gap: 8px; }
      .banner { position: relative; height: 150px; overflow: hidden; color: #fff; }
      .banner img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .banner-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.05)); }
      .banner-text { position: absolute; inset: 0; padding: 16px; display: flex; flex-direction: column; gap: 4px; justify-content: flex-end; }
      .banner-badge { align-self: flex-start; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
                      background: rgba(255,255,255,.2); padding: 2px 8px; border-radius: 999px; backdrop-filter: blur(4px); }
      .banner-title { font-size: 17px; font-weight: 800; line-height: 1.2; }
      .banner-sub { font-size: 12px; opacity: .9; }
      .banner .status { position: absolute; top: 10px; right: 10px; }
      .offer-modal { max-width: 980px; }
      .offer-form { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; }
      @media (max-width: 860px) { .offer-form { grid-template-columns: minmax(0, 1fr); } .preview { position: static; } }
      .preview { position: sticky; top: 0; align-self: start; }
      .preview-banner { height: 200px; border-radius: 14px; margin-top: 6px; }
      .preview-foot { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
      .preview-code { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; border: 1px dashed rgba(255,255,255,.8); padding: 2px 8px; border-radius: 6px; }
      .preview-cta { font-size: 12px; font-weight: 700; background: #f2682f; padding: 4px 10px; border-radius: 8px; }
      .theme-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
      @media (max-width: 600px) { .theme-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } .preview-banner { height: 170px; } }
      .theme-swatch { height: 54px; border-radius: 10px; border: 2px solid transparent; cursor: pointer; position: relative; padding: 0;
                      display: flex; align-items: flex-end; justify-content: center; color: #fff; font-size: 11px; font-weight: 700;
                      text-shadow: 0 1px 2px rgba(0,0,0,.5); }
      .theme-swatch span { padding-bottom: 4px; }
      .theme-swatch.selected { border-color: var(--brand-600); box-shadow: 0 0 0 3px var(--brand-50); }
    `,
  ],
})
export class OffersListComponent implements OnInit, OnDestroy {
  offers: Offer[] = [];
  coupons: Coupon[] = [];
  loading = true;
  filter = 'all';
  tabs = [
    { label: 'All', value: 'all' },
    { label: 'Live', value: 'live' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Hidden', value: 'hidden' },
    { label: 'Needs attention', value: 'attention' },
  ];
  themes = THEMES;
  linkPresets = LINK_PRESETS;

  showForm = false;
  editing: Offer | null = null;
  draft: Draft = emptyDraft();
  pendingImage: File | null = null;
  previewImage: string | null = null;
  removeExistingImage = false;
  saving = false;
  error = '';

  constructor(
    private offerService: OfferService,
    private couponService: CouponService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.couponService.list().subscribe((coupons) => {
      this.coupons = coupons;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  refresh(): void {
    this.offerService.list().subscribe({
      next: (offers) => {
        this.offers = offers;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private matches(offer: Offer, filter: string): boolean {
    if (filter === 'all') return true;
    if (filter === 'attention') return offer.status.key === 'expired' || offer.status.key === 'coupon_unavailable';
    return offer.status.key === filter;
  }

  get visible(): Offer[] {
    return this.offers.filter((o) => this.matches(o, this.filter));
  }

  count(filter: string): number {
    return this.offers.filter((o) => this.matches(o, filter)).length;
  }

  get selectedCoupon(): Coupon | undefined {
    return this.coupons.find((c) => c.id === this.draft.couponId);
  }

  couponLabel(c: Coupon): string {
    return c.discount_type === 'percentage' ? `${Number(c.discount_value)}% off` : `₹${Number(c.discount_value)} off`;
  }

  themeBg(theme: OfferTheme): string {
    return THEMES.find((t) => t.value === theme)?.bg ?? THEMES[0].bg;
  }

  bannerBg(theme: OfferTheme, image: string | null): string {
    return image ? '#1f2937' : this.themeBg(theme);
  }

  imageUrl(path: string | null): string | null {
    return this.offerService.imageUrl(path);
  }

  statusClass(key: Offer['status']['key']): string {
    return {
      live: 'badge-success',
      scheduled: 'badge-info',
      hidden: 'badge-neutral',
      expired: 'badge-danger',
      coupon_unavailable: 'badge-warning',
    }[key];
  }

  openCreate(): void {
    this.editing = null;
    this.draft = emptyDraft();
    this.draft.sortOrder = this.offers.length ? Math.max(...this.offers.map((o) => o.sort_order)) + 1 : 0;
    this.resetImageState(null);
    this.error = '';
    this.showForm = true;
  }

  openEdit(offer: Offer): void {
    this.editing = offer;
    this.draft = {
      title: offer.title,
      subtitle: offer.subtitle ?? '',
      badge: offer.badge ?? '',
      terms: offer.terms ?? '',
      couponId: offer.coupon_id,
      theme: offer.theme,
      ctaLabel: offer.cta_label ?? '',
      ctaUrl: offer.cta_url ?? '',
      validFrom: offer.valid_from ?? '',
      validUntil: offer.valid_until ?? '',
      isActive: offer.is_active,
      showAtCheckout: offer.show_at_checkout,
      sortOrder: offer.sort_order,
    };
    this.resetImageState(this.imageUrl(offer.image_url));
    this.error = '';
    this.showForm = true;
  }

  close(): void {
    if (this.saving) return;
    this.showForm = false;
    this.revokePreview();
  }

  pickImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Banner must be a JPG, PNG or WEBP image.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'Banner image must be 5 MB or smaller.';
      return;
    }
    this.revokePreview();
    this.pendingImage = file;
    this.previewImage = URL.createObjectURL(file);
    this.removeExistingImage = false;
    this.error = '';
  }

  clearImage(): void {
    this.revokePreview();
    this.pendingImage = null;
    this.previewImage = null;
    this.removeExistingImage = !!this.editing?.image_url;
  }

  private resetImageState(existing: string | null): void {
    this.revokePreview();
    this.pendingImage = null;
    this.previewImage = existing;
    this.removeExistingImage = false;
  }

  private revokePreview(): void {
    if (this.pendingImage && this.previewImage?.startsWith('blob:')) URL.revokeObjectURL(this.previewImage);
  }

  save(): void {
    this.error = '';
    const d = this.draft;
    if (!d.title.trim()) {
      this.error = 'Title is required.';
      return;
    }
    if (d.ctaUrl && (!d.ctaUrl.startsWith('/') || d.ctaUrl.startsWith('//'))) {
      this.error = 'Button link must be a page on the website, starting with "/" (e.g. /hotels?city=Goa).';
      return;
    }
    if (d.validFrom && d.validUntil && d.validUntil < d.validFrom) {
      this.error = '"Show until" must be on or after "Show from".';
      return;
    }

    const payload: OfferPayload = {
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || null,
      badge: d.badge.trim() || null,
      terms: d.terms.trim() || null,
      couponId: d.couponId,
      theme: d.theme,
      ctaLabel: d.ctaLabel.trim() || null,
      ctaUrl: d.ctaUrl.trim() || null,
      validFrom: d.validFrom || null,
      validUntil: d.validUntil || null,
      isActive: d.isActive,
      showAtCheckout: !!d.couponId && d.showAtCheckout,
      sortOrder: Number(d.sortOrder) || 0,
    };

    this.saving = true;
    const request = this.editing ? this.offerService.update(this.editing.id, payload) : this.offerService.create(payload);
    request
      .pipe(switchMap((offer) => this.syncImage(offer)))
      .subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.revokePreview();
          this.toast.success(this.editing ? 'Offer updated' : 'Offer created');
          this.refresh();
        },
        error: (err) => {
          this.saving = false;
          this.error = err.error?.message || 'Could not save the offer';
          this.cdr.markForCheck();
        },
      });
  }

  /** Uploads/removes the banner after the offer row exists (new offers need an id first). */
  private syncImage(offer: Offer): Observable<unknown> {
    if (this.pendingImage) return this.offerService.uploadImage(offer.id, this.pendingImage);
    if (this.removeExistingImage) return this.offerService.removeImage(offer.id);
    return of(offer);
  }

  toggleActive(offer: Offer): void {
    this.offerService.update(offer.id, { isActive: !offer.is_active }).subscribe({
      next: () => {
        this.toast.success(offer.is_active ? 'Offer hidden from the website' : 'Offer published');
        this.refresh();
      },
      error: (err) => this.toast.error(err.error?.message || 'Update failed'),
    });
  }

  async remove(offer: Offer): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete "${offer.title}"?`,
      message: 'The offer disappears from the website immediately. Any linked coupon keeps working at checkout.',
      confirmLabel: 'Delete offer',
      danger: true,
    });
    if (!ok) return;
    this.offerService.remove(offer.id).subscribe({
      next: () => {
        this.toast.success('Offer deleted');
        this.refresh();
      },
      error: (err) => this.toast.error(err.error?.message || 'Delete failed'),
    });
  }
}
