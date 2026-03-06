import type { AutoTracker } from './tracker.js';
import { shouldIgnoreElement } from './tracker.js';

export class FormTracker implements AutoTracker {
  name = 'form';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private handler: ((e: Event) => void) | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined') return;

    this.handler = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || !this.trackFn) return;
      if (form.tagName !== 'FORM') return;
      if (shouldIgnoreElement(form)) return;

      this.trackFn('$form_submit', {
        form_id: form.id || null,
        form_name: form.name || null,
        form_action: form.action || null,
        form_method: (form.method || 'get').toUpperCase(),
      });
    };

    document.addEventListener('submit', this.handler, true);
  }

  stop(): void {
    if (this.handler) {
      document.removeEventListener('submit', this.handler, true);
      this.handler = null;
    }
    this.trackFn = null;
  }
}
