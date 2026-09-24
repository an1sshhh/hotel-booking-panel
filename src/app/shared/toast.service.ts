import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
  leaving?: boolean;
}

const EXIT_MS = 180;
const DURATIONS: Record<Toast['kind'], number> = { success: 3600, info: 3600, error: 5500 };

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string): void {
    this.push(message, 'success');
  }

  error(message: string): void {
    this.push(message, 'error');
  }

  info(message: string): void {
    this.push(message, 'info');
  }

  private push(message: string, kind: Toast['kind']): void {
    const current = this.toasts();
    const last = current[current.length - 1];
    // Skip exact repeats of the toast still on screen (e.g. a retried failing request).
    if (last && !last.leaving && last.kind === kind && last.message === message) return;

    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), DURATIONS[kind]);
  }

  /** Marks the toast as leaving so the component can animate it out, then removes it. */
  dismiss(id: number): void {
    const toast = this.toasts().find((t) => t.id === id);
    if (!toast || toast.leaving) return;

    this.toasts.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== id));
    }, EXIT_MS);
  }
}
