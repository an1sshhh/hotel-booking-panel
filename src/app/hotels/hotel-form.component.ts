import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concatMap, from, lastValueFrom, toArray } from 'rxjs';
import { Hotel, HotelService } from './hotel.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { LocationOption, LocationService } from '../shared/location.service';

const HOTEL_TYPES = ['hotel', 'resort', 'villa', 'hostel', 'apartment', 'other'];
const HOTEL_STATUSES = ['draft', 'active', 'inactive'];
const IMAGE_CATEGORIES = ['exterior', 'lobby', 'rooms', 'bathroom', 'pool', 'restaurant', 'facilities', 'other'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface PendingImage {
  file: File;
  previewUrl: string;
  category: string;
}

type Step = 'basic' | 'location' | 'images' | 'policies';

/** Rejects values that are only whitespace (the server trims and would reject them too). */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null; // `required` handles emptiness
  return String(value).trim().length ? null : { blank: true };
}

/** Digits, with optional leading +, spaces, hyphens and parentheses — no letters. */
const PHONE_RE = /^\+?[0-9()\-\s]{6,20}$/;

function phoneFormat(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null;
  return PHONE_RE.test(String(value).trim()) ? null : { phone: true };
}

/**
 * Matches the server's EMAIL_RE exactly (server/src/validate.js). Angular's
 * built-in Validators.email is more permissive — it accepts domains with no
 * dot (e.g. "info@hotel") — which passed client-side but was then rejected
 * by the server's stricter check, causing a confusing 400 on submit.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailFormat(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null;
  return EMAIL_RE.test(String(value).trim()) ? null : { email: true };
}

/** India-only, 6 digits — matches the server's PINCODE_RE (server/src/shared/utils/validator.js). */
const PINCODE_RE = /^[0-9]{6}$/;

function pincodeFormat(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null;
  return PINCODE_RE.test(String(value).trim()) ? null : { pincode: true };
}

/**
 * Matches the server's URL_RE (server/src/shared/utils/validator.js). Protocol
 * is optional here — most people type "example.com", not "https://example.com" —
 * the server normalises by prepending https:// before storing.
 */
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

function urlFormat(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null;
  return URL_RE.test(String(value).trim()) ? null : { url: true };
}

/** Prepends https:// so "example.com" and "https://example.com" both save consistently. */
function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function range(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return { notNumber: true };
    return num >= min && num <= max ? null : { range: { min, max } };
  };
}

@Component({
  selector: 'app-hotel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    <div class="page">
      <a class="back-link" [routerLink]="isEdit ? ['/hotels', hotelId] : ['/hotels']">
        <app-icon name="arrowLeft" [size]="14" /> {{ isEdit ? 'Back to hotel' : 'Back to hotels' }}
      </a>

      <div class="page-header">
        <div>
          <h1 class="page-title">{{ isEdit ? 'Edit hotel' : 'Add hotel' }}</h1>
          <p class="page-subtitle">
            {{ isEdit ? 'Update the property details.' : 'Create the property, then add images, amenities and rooms.' }}
          </p>
        </div>
      </div>

      @if (loadFailed) {
        <div class="alert alert-danger">
          <app-icon name="alert" [size]="16" />
          <span>This hotel could not be loaded. It may have been deleted.</span>
        </div>
      } @else {
        <div class="steps">
          @for (step of steps; track step.key; let i = $index) {
            <button type="button" class="step"
                    [class.active]="tab === step.key"
                    [class.done]="tab !== step.key && isStepComplete(step.key)"
                    (click)="goTo(step.key)">
              <span class="step-num">
                @if (tab !== step.key && isStepComplete(step.key)) {
                  <app-icon name="check" [size]="11" [strokeWidth]="3" />
                } @else {
                  {{ i + 1 }}
                }
              </span>
              {{ step.label }}
              @if (submitted && !isStepValid(step.key)) {
                <app-icon name="alert" [size]="13" />
              }
            </button>
          }
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="card">
            <div class="card-body">
              <!-- STEP 1 — BASIC INFORMATION -->
              @if (tab === 'basic') {
                <div class="form-grid">
                  <div class="field span-2">
                    <label class="field-label" for="name">Hotel Name <span class="req">*</span></label>
                    <input id="name" class="input" [class.invalid]="invalid('name')" formControlName="name"
                           type="text" placeholder="e.g. Ginger Goa, Candolim" maxlength="200" />
                    @if (invalid('name')) { <span class="field-error">{{ errorFor('name', 'Hotel name') }}</span> }
                  </div>

                  <div class="field">
                    <label class="field-label" for="hotel_type">Hotel Type</label>
                    <select id="hotel_type" class="select" formControlName="hotel_type">
                      @for (type of hotelTypes; track type) { <option [value]="type">{{ type | titlecase }}</option> }
                    </select>
                  </div>

                  <div class="field">
                    <label class="field-label" for="star_category">Star Category</label>
                    <select id="star_category" class="select" formControlName="star_category">
                      <option [ngValue]="null">Not rated</option>
                      @for (star of [1,2,3,4,5]; track star) { <option [ngValue]="star">{{ star }} Star</option> }
                    </select>
                  </div>

                  <div class="field">
                    <label class="field-label" for="status">Status</label>
                    <select id="status" class="select" formControlName="status">
                      @for (s of hotelStatuses; track s) { <option [value]="s">{{ s | titlecase }}</option> }
                    </select>
                    <span class="field-hint">Draft hotels aren't visible to guests until activated.</span>
                  </div>

                  <div class="field span-2">
                    <label class="field-label" for="description">Description <span class="req">*</span></label>
                    <textarea id="description" class="textarea" [class.invalid]="invalid('description')"
                              formControlName="description" rows="4" maxlength="2000"
                              placeholder="Describe the property, its location and highlights…"></textarea>
                    <span class="field-hint">{{ descriptionLength }}/2000 characters</span>
                    @if (invalid('description')) { <span class="field-error">{{ errorFor('description', 'Description') }}</span> }
                  </div>

                  <div class="field">
                    <label class="field-label" for="phone">Phone</label>
                    <input id="phone" class="input" [class.invalid]="invalid('phone')" formControlName="phone"
                           type="tel" inputmode="tel" placeholder="+91 98765 43210" maxlength="30" />
                    @if (invalid('phone')) { <span class="field-error">Enter digits only (spaces, +, - and () are fine).</span> }
                  </div>

                  <div class="field">
                    <label class="field-label" for="email">Email</label>
                    <input id="email" class="input" [class.invalid]="invalid('email')" formControlName="email"
                           type="email" placeholder="reservations@hotel.com" />
                    @if (invalid('email')) { <span class="field-error">Enter a valid email address.</span> }
                  </div>

                  <div class="field span-2">
                    <label class="field-label" for="website">Website</label>
                    <input id="website" class="input" [class.invalid]="invalid('website')" formControlName="website"
                           type="url" placeholder="https://…" />
                    @if (invalid('website')) { <span class="field-error">Enter a valid website address, e.g. example.com</span> }
                  </div>
                </div>
              }

              <!-- STEP 2 — LOCATION -->
              @if (tab === 'location') {
                <div class="form-grid">
                  <div class="field">
                    <label class="field-label" for="country">Country</label>
                    <select id="country" class="select" (change)="onCountryChange($event)">
                      @for (c of countries; track c.isoCode) {
                        <option [value]="c.isoCode" [selected]="c.isoCode === countryCode">{{ c.name }}</option>
                      }
                    </select>
                  </div>

                  @if (countryCode === 'IN') {
                    <div class="field">
                      <label class="field-label" for="pincode">Pincode</label>
                      <input id="pincode" class="input" [class.invalid]="invalid('pincode')" formControlName="pincode"
                             type="text" inputmode="numeric" maxlength="6" (input)="onPincodeInput()" />
                      @if (pincodeLookingUp) { <span class="field-hint">Looking up city &amp; state…</span> }
                      @if (invalid('pincode')) { <span class="field-error">Enter a 6-digit pincode.</span> }
                    </div>
                  }

                  <div class="field">
                    <label class="field-label" for="state">State</label>
                    <select id="state" class="select" [disabled]="!states.length" (change)="onStateChange($event)">
                      <option value="" [selected]="!stateCode">{{ states.length ? 'Select a state' : 'Select a country first' }}</option>
                      @for (s of states; track s.isoCode) {
                        <option [value]="s.isoCode" [selected]="s.isoCode === stateCode">{{ s.name }}</option>
                      }
                    </select>
                  </div>

                  <div class="field">
                    <label class="field-label" for="city">City <span class="req">*</span></label>
                    <select id="city" class="select" [class.invalid]="invalid('city')" formControlName="city" [disabled]="!cities.length">
                      <option value="">{{ cities.length ? 'Select a city' : 'Select a state first' }}</option>
                      @for (c of cities; track c.name) { <option [value]="c.name">{{ c.name }}</option> }
                    </select>
                    @if (invalid('city')) { <span class="field-error">{{ errorFor('city', 'City') }}</span> }
                  </div>

                  <div class="field span-2">
                    <label class="field-label" for="address">Address <span class="req">*</span></label>
                    <textarea id="address" class="textarea" [class.invalid]="invalid('address')"
                              formControlName="address" rows="2" maxlength="400"></textarea>
                    @if (invalid('address')) { <span class="field-error">{{ errorFor('address', 'Address') }}</span> }
                  </div>

                  <div class="field">
                    <label class="field-label" for="latitude">Latitude</label>
                    <input id="latitude" class="input" [class.invalid]="invalid('latitude')" formControlName="latitude"
                           type="number" step="0.0000001" placeholder="15.5169" />
                    @if (invalid('latitude')) { <span class="field-error">Latitude must be between -90 and 90.</span> }
                  </div>

                  <div class="field">
                    <label class="field-label" for="longitude">Longitude</label>
                    <input id="longitude" class="input" [class.invalid]="invalid('longitude')" formControlName="longitude"
                           type="number" step="0.0000001" placeholder="73.7627" />
                    @if (invalid('longitude')) { <span class="field-error">Longitude must be between -180 and 180.</span> }
                  </div>

                  <div class="span-2 alert alert-info">
                    <app-icon name="pin" [size]="16" />
                    <span>Coordinates power the guest-facing map view. Leave blank if unknown.</span>
                  </div>
                </div>
              }

              <!-- STEP 3 — IMAGES -->
              @if (tab === 'images') {
                <div class="stack" style="gap: 16px;">
                  <div class="gallery">
                    @for (image of pendingImages; track image.previewUrl; let i = $index) {
                      <div class="gallery-item">
                        <img [src]="image.previewUrl" [alt]="image.file.name" />
                        @if (i === coverIndex) { <span class="cover-flag">Cover</span> }
                        <div class="meta" style="flex-direction: column; align-items: stretch; gap: 6px;">
                          <select class="select" style="font-size: 12px; padding: 4px 8px;"
                                  [value]="image.category" (change)="setCategory(i, $event)">
                            @for (cat of imageCategories; track cat) { <option [value]="cat">{{ cat | titlecase }}</option> }
                          </select>
                          <span class="row" style="justify-content: space-between;">
                            @if (i !== coverIndex) {
                              <button type="button" class="link-btn" (click)="coverIndex = i">Set cover</button>
                            } @else {
                              <span class="cell-muted">Cover image</span>
                            }
                            <button type="button" class="link-btn danger" (click)="removeImage(i)">
                              <app-icon name="trash" [size]="13" />
                            </button>
                          </span>
                        </div>
                      </div>
                    }

                    <label class="upload-drop">
                      <app-icon name="upload" [size]="20" />
                      <span class="strong" style="font-size: 13px;">Add images</span>
                      <span>JPG or PNG · max 5 MB each · you can select several</span>
                      <input type="file" accept="image/*" multiple (change)="onFilesSelected($event)" />
                    </label>
                  </div>

                  @if (imageError) { <div class="alert alert-danger">{{ imageError }}</div> }

                  <div class="alert alert-info">
                    <app-icon name="image" [size]="16" />
                    <span>
                      @if (isEdit) {
                        Images upload as soon as you pick them. Manage the full gallery from the hotel's Gallery tab.
                      } @else {
                        Images upload automatically right after the hotel is created. The cover image is shown on hotel cards and search results.
                      }
                    </span>
                  </div>
                </div>
              }

              <!-- STEP 4 — POLICIES -->
              @if (tab === 'policies') {
                <div class="form-grid">
                  <div class="field">
                    <label class="field-label" for="check_in_time">Check-in Time</label>
                    <input id="check_in_time" class="input" formControlName="check_in_time" type="time" />
                  </div>

                  <div class="field">
                    <label class="field-label" for="check_out_time">Check-out Time</label>
                    <input id="check_out_time" class="input" formControlName="check_out_time" type="time" />
                  </div>

                  <div class="span-2">
                    <label class="switch-row">
                      <span>Early check-in available</span>
                      <input type="checkbox" formControlName="early_checkin_available" />
                    </label>
                    <label class="switch-row">
                      <span>Late check-out available</span>
                      <input type="checkbox" formControlName="late_checkout_available" />
                    </label>
                    <label class="switch-row">
                      <span>Pets allowed</span>
                      <input type="checkbox" formControlName="pets_allowed" />
                    </label>
                    <label class="switch-row">
                      <span>Smoking allowed</span>
                      <input type="checkbox" formControlName="smoking_allowed" />
                    </label>
                    <label class="switch-row">
                      <span>Children allowed</span>
                      <input type="checkbox" formControlName="children_allowed" />
                    </label>
                  </div>

                  <div class="field span-2">
                    <label class="field-label" for="policy_notes">Additional policy notes</label>
                    <textarea id="policy_notes" class="textarea" formControlName="policy_notes" rows="3" maxlength="2000"
                              placeholder="Anything guests should know before booking…"></textarea>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer" style="border-radius: 0 0 var(--r-lg) var(--r-lg);">
              @if (error) {
                <div class="alert alert-danger" style="margin-right: auto;">
                  <app-icon name="alert" [size]="16" /> <span>{{ error }}</span>
                </div>
              } @else if (submitted && form.invalid) {
                <span class="field-error" style="margin-right: auto;">
                  Fix the highlighted fields in step {{ firstInvalidStepNumber }}.
                </span>
              }

              <button type="button" class="btn btn-secondary" (click)="cancel()">Cancel</button>

              @if (stepIndex > 0) {
                <button type="button" class="btn btn-secondary" (click)="previous()">
                  <app-icon name="chevronLeft" [size]="14" /> Back
                </button>
              }

              @if (stepIndex < steps.length - 1) {
                <button type="button" class="btn btn-secondary" (click)="next()">
                  Next <app-icon name="chevronRight" [size]="14" />
                </button>
              }

              <button type="submit" class="btn btn-primary" [disabled]="saving">
                {{ saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create hotel') }}
              </button>
            </div>
          </div>
        </form>
      }
    </div>
  `,
})
export class HotelFormComponent implements OnInit {
  form;
  hotelTypes = HOTEL_TYPES;
  hotelStatuses = HOTEL_STATUSES;
  steps: { key: Step; label: string }[] = [
    { key: 'basic', label: 'Basic Information' },
    { key: 'location', label: 'Location' },
    { key: 'images', label: 'Images' },
    { key: 'policies', label: 'Policies' },
  ];
  tab: Step = 'basic';
  isEdit = false;
  hotelId: number | null = null;
  saving = false;
  submitted = false;
  loadFailed = false;
  error = '';

  imageCategories = IMAGE_CATEGORIES;
  pendingImages: PendingImage[] = [];
  coverIndex = 0;
  imageError = '';

  countries: LocationOption[] = [];
  states: LocationOption[] = [];
  cities: { name: string }[] = [];
  countryCode = 'IN';
  stateCode = '';
  pincodeLookingUp = false;

  /** Fields that gate each step, used for both the tick marks and jump-to-first-error. */
  private readonly stepFields: Record<Step, string[]> = {
    basic: ['name', 'description', 'email', 'phone'],
    location: ['city', 'address', 'latitude', 'longitude'],
    images: [],
    policies: [],
  };

  constructor(
    private fb: FormBuilder,
    private hotelService: HotelService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, notBlank, Validators.maxLength(200)]],
      hotel_type: ['hotel'],
      status: ['draft'],
      star_category: [null as number | null],
      description: ['', [Validators.required, notBlank, Validators.maxLength(2000)]],
      phone: ['', [Validators.maxLength(30), phoneFormat]],
      email: ['', emailFormat],
      website: ['', [Validators.maxLength(255), urlFormat]],
      city: ['', [Validators.required, notBlank, Validators.maxLength(120)]],
      state: ['', Validators.maxLength(120)],
      country: ['India', Validators.maxLength(120)],
      pincode: ['', pincodeFormat],
      address: ['', [Validators.required, notBlank, Validators.maxLength(400)]],
      latitude: [null as number | null, range(-90, 90)],
      longitude: [null as number | null, range(-180, 180)],
      check_in_time: ['14:00'],
      check_out_time: ['12:00'],
      early_checkin_available: [false],
      late_checkout_available: [false],
      pets_allowed: [false],
      smoking_allowed: [false],
      children_allowed: [true],
      policy_notes: ['', Validators.maxLength(2000)],
    });
  }

  get descriptionLength(): number {
    return (this.form.get('description')?.value || '').length;
  }

  get stepIndex(): number {
    return this.steps.findIndex((s) => s.key === this.tab);
  }

  get firstInvalidStepNumber(): number {
    const index = this.steps.findIndex((s) => !this.isStepValid(s.key));
    return index === -1 ? 1 : index + 1;
  }

  ngOnInit(): void {
    this.locationService.countries().subscribe((countries) => {
      this.countries = countries;

      const idParam = this.route.snapshot.paramMap.get('id');
      if (!idParam) {
        this.loadStatesFor(this.countryCode); // new hotel — default to India
        this.cdr.markForCheck();
        return;
      }

      this.isEdit = true;
      this.hotelId = Number(idParam);
      this.hotelService.get(this.hotelId).subscribe({
        next: (hotel) => {
          this.form.patchValue(this.toFormValue(hotel));
          this.initLocationFrom(hotel.country, hotel.state);
          this.cdr.markForCheck();
        },
        error: () => {
          // Previously this failed silently and left a permanently blank form.
          this.loadFailed = true;
          this.toast.error('Hotel not found');
          this.router.navigate(['/hotels']);
          this.cdr.markForCheck();
        },
      });
      this.cdr.markForCheck();
    });
  }

  /**
   * Resolves the saved country/state/city names back to dropdown selections. Legacy
   * hotels may have free-text values that don't match any option (e.g. pre-dropdown
   * data) — when that happens we fall back to India and clear the stale value, so
   * what's shown in the dropdown always matches what gets submitted.
   */
  private initLocationFrom(countryName?: string, stateName?: string): void {
    const country = this.countries.find((c) => c.name === countryName);
    this.countryCode = country?.isoCode ?? 'IN';
    this.form.patchValue({ country: country?.name ?? 'India' });

    this.locationService.states(this.countryCode).subscribe((states) => {
      this.states = states;
      const state = states.find((s) => s.name === stateName);
      this.stateCode = state?.isoCode ?? '';
      this.form.patchValue({ state: state?.name ?? '' });
      if (!state && this.form.get('city')?.value) this.form.patchValue({ city: '' });

      if (this.stateCode) {
        this.locationService.cities(this.countryCode, this.stateCode).subscribe((cities) => {
          this.cities = cities;
          const cityValue = this.form.get('city')?.value;
          if (cityValue && !cities.some((c) => c.name === cityValue)) this.form.patchValue({ city: '' });
          this.cdr.markForCheck();
        });
      }
      this.cdr.markForCheck();
    });
  }

  private loadStatesFor(countryCode: string): void {
    this.states = [];
    this.cities = [];
    this.stateCode = '';
    if (!countryCode) return;
    this.locationService.states(countryCode).subscribe((states) => {
      this.states = states;
      this.cdr.markForCheck();
    });
  }

  onCountryChange(event: Event): void {
    const isoCode = (event.target as HTMLSelectElement).value;
    this.countryCode = isoCode;
    const country = this.countries.find((c) => c.isoCode === isoCode);
    this.form.patchValue({ country: country?.name ?? '', state: '', city: '', pincode: '' });
    this.loadStatesFor(isoCode);
  }

  onStateChange(event: Event): void {
    const isoCode = (event.target as HTMLSelectElement).value;
    this.stateCode = isoCode;
    const state = this.states.find((s) => s.isoCode === isoCode);
    this.form.patchValue({ state: state?.name ?? '', city: '' });
    this.cities = [];
    if (isoCode) {
      this.locationService.cities(this.countryCode, isoCode).subscribe((cities) => {
        this.cities = cities;
        this.cdr.markForCheck();
      });
    }
  }

  /** India only — fires once 6 digits are entered and fills in State + City. */
  onPincodeInput(): void {
    const code = String(this.form.get('pincode')?.value ?? '').trim();
    if (this.countryCode !== 'IN' || !/^[0-9]{6}$/.test(code)) return;

    this.pincodeLookingUp = true;
    this.locationService.lookupPincode(code).subscribe({
      next: (result) => {
        this.pincodeLookingUp = false;
        const state = this.states.find((s) => s.name.toLowerCase() === result.state.toLowerCase());
        if (!state) {
          this.toast.error(`Could not match state "${result.state}" — please select City/State manually.`);
          this.cdr.markForCheck();
          return;
        }
        this.stateCode = state.isoCode;
        this.form.patchValue({ state: state.name, city: '' });
        this.locationService.cities(this.countryCode, state.isoCode).subscribe((cities) => {
          this.cities = cities;
          const matchedName = result.cityCandidates
            .map((candidate) => cities.find((c) => c.name.toLowerCase() === candidate.toLowerCase())?.name)
            .find(Boolean);
          if (matchedName) {
            this.form.patchValue({ city: matchedName });
          } else {
            this.toast.info('State filled in — pick the closest city from the list.');
          }
          this.cdr.markForCheck();
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.pincodeLookingUp = false;
        this.toast.error('Could not find a location for this pincode');
        this.cdr.markForCheck();
      },
    });
  }

  /** Postgres returns numerics as strings and nulls for empty text — normalise for the form controls. */
  private toFormValue(hotel: any): any {
    return {
      ...hotel,
      star_category: hotel.star_category != null ? Number(hotel.star_category) : null,
      latitude: hotel.latitude != null ? Number(hotel.latitude) : null,
      longitude: hotel.longitude != null ? Number(hotel.longitude) : null,
      name: hotel.name ?? '',
      description: hotel.description ?? '',
      phone: hotel.phone ?? '',
      email: hotel.email ?? '',
      website: hotel.website ?? '',
      city: hotel.city ?? '',
      state: hotel.state ?? '',
      country: hotel.country ?? '',
      pincode: hotel.pincode ?? '',
      address: hotel.address ?? '',
      policy_notes: hotel.policy_notes ?? '',
      check_in_time: (hotel.check_in_time ?? '14:00').slice(0, 5),
      check_out_time: (hotel.check_out_time ?? '12:00').slice(0, 5),
    };
  }

  /** Trim strings, and send null rather than "" for optional fields. */
  private toPayload(): any {
    const raw = this.form.getRawValue() as Record<string, any>;
    const payload: Record<string, any> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        payload[key] = trimmed === '' ? null : trimmed;
      } else {
        payload[key] = value;
      }
    }

    if (payload['website']) payload['website'] = normalizeUrl(payload['website']);
    payload['star_category'] = raw['star_category'] != null ? Number(raw['star_category']) : null;
    payload['latitude'] = raw['latitude'] != null && raw['latitude'] !== '' ? Number(raw['latitude']) : null;
    payload['longitude'] = raw['longitude'] != null && raw['longitude'] !== '' ? Number(raw['longitude']) : null;
    return payload;
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched || this.submitted);
  }

  errorFor(field: string, label: string): string {
    const errors = this.form.get(field)?.errors ?? {};
    if (errors['required'] || errors['blank']) return `${label} is required.`;
    if (errors['maxlength']) return `${label} is too long (max ${errors['maxlength'].requiredLength} characters).`;
    return `${label} is invalid.`;
  }

  /** Valid = no errors on that step's fields. */
  isStepValid(step: Step): boolean {
    return this.stepFields[step].every((f) => this.form.get(f)?.valid);
  }

  /** Complete = valid AND the required fields actually have content (so ticks mean progress). */
  isStepComplete(step: Step): boolean {
    if (!this.isStepValid(step)) return false;
    if (step === 'images') return this.pendingImages.length > 0;
    const required: Record<Step, string[]> = {
      basic: ['name', 'description'],
      location: ['city', 'address'],
      images: [],
      policies: [],
    };
    return required[step].every((f) => !!String(this.form.get(f)?.value ?? '').trim());
  }

  // ---- Images ----

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.imageError = '';

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        this.imageError = `"${file.name}" is not an image file.`;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        this.imageError = `"${file.name}" is larger than 5 MB.`;
        continue;
      }
      this.pendingImages.push({
        file,
        previewUrl: URL.createObjectURL(file),
        category: this.pendingImages.length === 0 ? 'exterior' : 'other',
      });
    }

    input.value = '';

    // In edit mode the hotel already exists, so push them straight up.
    if (this.isEdit && this.hotelId) this.uploadPending(this.hotelId);
  }

  setCategory(index: number, event: Event): void {
    this.pendingImages[index].category = (event.target as HTMLSelectElement).value;
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.pendingImages[index].previewUrl);
    this.pendingImages.splice(index, 1);
    if (this.coverIndex >= this.pendingImages.length) this.coverIndex = 0;
  }

  /** Uploads queued files one at a time, then flags the chosen cover image. */
  private async uploadPending(hotelId: number): Promise<void> {
    if (!this.pendingImages.length) return;

    const queue = [...this.pendingImages];
    const coverIndex = this.coverIndex;

    try {
      const uploaded = await lastValueFrom(
        from(queue).pipe(
          concatMap((image) => this.hotelService.uploadImage(hotelId, image.file, image.category)),
          toArray()
        )
      );

      const cover = uploaded[coverIndex] ?? uploaded[0];
      if (cover) {
        await lastValueFrom(this.hotelService.setPrimaryImage(hotelId, cover.id));
      }

      queue.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      this.pendingImages = [];
      this.coverIndex = 0;
      this.toast.success(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded`);
    } catch (err: any) {
      this.imageError = err?.error?.message || 'Some images failed to upload.';
      this.toast.error(this.imageError);
    }
    this.cdr.markForCheck();
  }

  goTo(step: Step): void {
    this.tab = step;
  }

  next(): void {
    // Surface errors on the current step before moving on.
    this.stepFields[this.tab].forEach((f) => this.form.get(f)?.markAsTouched());
    const index = this.stepIndex;
    if (index < this.steps.length - 1) this.tab = this.steps[index + 1].key;
  }

  previous(): void {
    const index = this.stepIndex;
    if (index > 0) this.tab = this.steps[index - 1].key;
  }

  submit(): void {
    this.submitted = true;
    this.error = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const firstInvalid = this.steps.find((s) => !this.isStepValid(s.key));
      if (firstInvalid) this.tab = firstInvalid.key;
      return;
    }

    if (this.saving) return;
    this.saving = true;

    const payload = this.toPayload();
    const request$ = this.isEdit
      ? this.hotelService.update(this.hotelId!, payload)
      : this.hotelService.create(payload);

    request$.subscribe({
      next: async (hotel: Hotel) => {
        this.toast.success(this.isEdit ? 'Hotel updated' : 'Hotel created');
        // Queued images can only upload once the hotel has an id.
        await this.uploadPending(hotel.id);
        this.router.navigate(['/hotels', hotel.id]);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save hotel. Please try again.';
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.router.navigate(this.isEdit ? ['/hotels', this.hotelId] : ['/hotels']);
  }
}
