import type { AutoTracker } from './tracker.js';
import { shouldIgnoreElement } from './tracker.js';

const EXCLUDED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export class DeadClickTracker implements AutoTracker {
  name = 'dead-click';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private handler: ((e: Event) => void) | null = null;
  private timeouts = new Set<ReturnType<typeof setTimeout>>();
  private observers = new Set<MutationObserver>();

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined') return;

    this.handler = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !this.trackFn) return;
      if (shouldIgnoreElement(target)) return;
      if (EXCLUDED_TAGS.has(target.tagName)) return;

      let mutationDetected = false;

      const observer = new MutationObserver(() => {
        mutationDetected = true;
        observer.disconnect();
        this.observers.delete(observer);
      });
      this.observers.add(observer);

      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        this.observers.delete(observer);
        this.timeouts.delete(timeoutId);
        if (!mutationDetected) {
          this.trackFn?.('$dead_click', {
            element_tag: target.tagName.toLowerCase(),
            element_id: (target as HTMLElement).id || null,
            element_classes: (target as HTMLElement).className || null,
            element_text: (target.textContent?.trim() || '').slice(0, 255) || null,
          });
        }
      }, 1000);
      this.timeouts.add(timeoutId);
    };

    document.addEventListener('click', this.handler, true);
  }

  stop(): void {
    if (this.handler) {
      document.removeEventListener('click', this.handler, true);
      this.handler = null;
    }
    for (const timeoutId of this.timeouts) clearTimeout(timeoutId);
    this.timeouts.clear();
    for (const observer of this.observers) observer.disconnect();
    this.observers.clear();
    this.trackFn = null;
  }
}
