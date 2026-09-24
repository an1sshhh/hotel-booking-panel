import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((ok: boolean) => void) | null = null;

  /** Replaces window.confirm() with an in-app dialog. */
  ask(request: ConfirmRequest): Promise<boolean> {
    this.request.set(request);
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  respond(ok: boolean): void {
    this.request.set(null);
    this.resolver?.(ok);
    this.resolver = null;
  }
}
