import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from './confirm.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (confirmService.request(); as req) {
      <div class="modal-backdrop" (click)="confirmService.respond(false)">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-body">
            <div class="row" style="align-items: flex-start; gap: 12px;">
              <span class="stat-icon" [class.red]="req.danger" [class.blue]="!req.danger">
                <app-icon [name]="req.danger ? 'alert' : 'alert'" [size]="18" />
              </span>
              <div class="stack">
                <span class="strong" style="font-size: 15px;">{{ req.title }}</span>
                <span class="muted">{{ req.message }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="confirmService.respond(false)">Cancel</button>
            <button class="btn" [class.btn-danger]="req.danger" [class.btn-primary]="!req.danger"
                    (click)="confirmService.respond(true)">
              {{ req.confirmLabel || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  constructor(public confirmService: ConfirmService) {}
}
