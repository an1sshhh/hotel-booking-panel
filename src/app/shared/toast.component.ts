import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';
import { IconComponent } from './icon.component';

const ICONS: Record<Toast['kind'], string> = { success: 'check', error: 'alert', info: 'info' };

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="toast.kind" [class.leaving]="toast.leaving" [attr.role]="toast.kind === 'error' ? 'alert' : null">
          <span class="toast-icon"><app-icon [name]="iconFor(toast.kind)" [size]="15" /></span>
          <span class="toast-msg">{{ toast.message }}</span>
          <button type="button" class="btn btn-ghost btn-icon toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss">
            <app-icon name="x" [size]="13" />
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  iconFor(kind: Toast['kind']): string {
    return ICONS[kind];
  }
}
