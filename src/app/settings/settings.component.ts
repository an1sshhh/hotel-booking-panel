import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, TaxRule } from './settings.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';

type Tab = 'general' | 'booking' | 'tax';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Platform-wide configuration. Gateway secrets are never exposed to the browser.</p>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.key) {
          <button class="tab" [class.active]="tab === t.key" (click)="tab = t.key">{{ t.label }}</button>
        }
      </div>

      @if (tab === 'general') {
        <div class="card">
          <div class="card-header"><span class="card-title">General</span></div>
          <div class="card-body">
            <div class="form-grid">
              <div class="field"><label class="field-label">Website Name</label><input class="input" [(ngModel)]="general.site_name" /></div>
              <div class="field"><label class="field-label">Currency</label><input class="input" [(ngModel)]="general.currency" /></div>
              <div class="field"><label class="field-label">Contact Email</label><input class="input" type="email" [(ngModel)]="general.contact_email" /></div>
              <div class="field"><label class="field-label">Contact Phone</label><input class="input" [(ngModel)]="general.contact_phone" /></div>
              <div class="field span-2"><label class="field-label">Logo URL</label><input class="input" [(ngModel)]="general.logo_url" placeholder="https://…" /></div>
            </div>
          </div>
          <div class="modal-footer" style="border-radius: 0 0 var(--r-lg) var(--r-lg);">
            <button class="btn btn-primary" (click)="saveGeneral()">Save General Settings</button>
          </div>
        </div>
      }

      @if (tab === 'booking') {
        <div class="card">
          <div class="card-header"><span class="card-title">Booking Defaults</span></div>
          <div class="card-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">Default Check-in Time</label>
                <input class="input" type="time" [(ngModel)]="booking.default_check_in_time" />
              </div>
              <div class="field">
                <label class="field-label">Default Check-out Time</label>
                <input class="input" type="time" [(ngModel)]="booking.default_check_out_time" />
              </div>
            </div>
            <div class="alert alert-info mt-16">
              <app-icon name="alert" [size]="16" />
              <span>These defaults pre-fill new hotels. Each property can override them in its own policy settings.</span>
            </div>
          </div>
          <div class="modal-footer" style="border-radius: 0 0 var(--r-lg) var(--r-lg);">
            <button class="btn btn-primary" (click)="saveBooking()">Save Booking Settings</button>
          </div>
        </div>
      }

      @if (tab === 'tax') {
        <div class="table-wrap">
          <div class="card-header">
            <span class="card-title">Tax & Fee Rules</span>
            <button class="btn btn-secondary btn-sm" (click)="showAddTax = true"><app-icon name="plus" [size]="14" /> Add Rule</button>
          </div>
          <div class="card-body" style="padding-bottom: 0;">
            <div class="alert alert-info" style="margin-bottom: 4px;">
              <app-icon name="alert" [size]="16" />
              <span>Active rules are applied to every booking total by the pricing service — no page computes its own tax.</span>
            </div>
          </div>
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>Name</th><th>Applies To</th><th>Type</th><th class="text-right">Value</th><th>Active</th></tr></thead>
              <tbody>
                @for (rule of taxRules; track rule.id) {
                  <tr>
                    <td class="cell-strong">{{ rule.name }}</td>
                    <td><span class="badge badge-neutral no-dot">{{ rule.applies_to === 'tax' ? 'Tax' : 'Service Charge' }}</span></td>
                    <td>{{ rule.value_type | titlecase }}</td>
                    <td class="text-right">
                      <input class="input num" type="number" min="0" style="width: 100px; text-align: right;"
                             [(ngModel)]="rule.value" (change)="saveTaxRule(rule)" />
                    </td>
                    <td>
                      <label class="checkbox">
                        <input type="checkbox" [(ngModel)]="rule.active" (change)="saveTaxRule(rule)" />
                        {{ rule.active ? 'Active' : 'Inactive' }}
                      </label>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="muted">No tax rules configured.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    @if (showAddTax) {
      <div class="modal-backdrop" (click)="showAddTax = false">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Add Tax Rule</span>
            <button class="btn btn-ghost btn-icon" (click)="showAddTax = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="stack" style="gap: 14px;">
              <div class="field"><label class="field-label">Name</label><input class="input" [(ngModel)]="taxDraft.name" placeholder="GST" /></div>
              <div class="field">
                <label class="field-label">Applies To</label>
                <select class="select" [(ngModel)]="taxDraft.appliesTo">
                  <option value="tax">Tax</option>
                  <option value="service_charge">Service Charge</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Value Type</label>
                <select class="select" [(ngModel)]="taxDraft.valueType">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div class="field"><label class="field-label">Value</label><input class="input" type="number" min="0" [(ngModel)]="taxDraft.value" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showAddTax = false">Cancel</button>
            <button class="btn btn-primary" (click)="createTaxRule()">Save Rule</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SettingsComponent implements OnInit {
  tab: Tab = 'general';
  tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'booking', label: 'Booking' },
    { key: 'tax', label: 'Taxes & Fees' },
  ];

  general: any = { site_name: '', currency: 'INR', contact_email: '', contact_phone: '', logo_url: '' };
  booking: any = { default_check_in_time: '14:00', default_check_out_time: '12:00' };
  taxRules: TaxRule[] = [];
  showAddTax = false;
  taxDraft: any = { name: '', appliesTo: 'tax', valueType: 'percentage', value: 0 };

  constructor(
    private settingsService: SettingsService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.settingsService.getAll().subscribe((settings) => {
      this.general = settings['general'] || this.general;
      this.booking = settings['booking'] || this.booking;
      this.cdr.markForCheck();
    });
    this.loadTaxRules();
  }

  loadTaxRules(): void {
    this.settingsService.listTaxRules().subscribe((rules) => {
      this.taxRules = rules;
      this.cdr.markForCheck();
    });
  }

  saveGeneral(): void {
    this.settingsService.update('general', this.general).subscribe(() => this.toast.success('General settings saved'));
  }

  saveBooking(): void {
    this.settingsService.update('booking', this.booking).subscribe(() => this.toast.success('Booking settings saved'));
  }

  saveTaxRule(rule: TaxRule): void {
    if (Number(rule.value) < 0) {
      this.toast.error('Value cannot be negative');
      return;
    }
    this.settingsService.updateTaxRule(rule.id, { value: rule.value, active: rule.active }).subscribe(() => {
      this.toast.success(`${rule.name} updated`);
    });
  }

  createTaxRule(): void {
    if (!this.taxDraft.name.trim()) {
      this.toast.error('Name is required');
      return;
    }
    this.settingsService.createTaxRule(this.taxDraft).subscribe(() => {
      this.showAddTax = false;
      this.taxDraft = { name: '', appliesTo: 'tax', valueType: 'percentage', value: 0 };
      this.toast.success('Tax rule created');
      this.loadTaxRules();
      this.cdr.markForCheck();
    });
  }
}
