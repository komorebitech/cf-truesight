import type { AutoTracker } from './tracker.js';
import { shouldIgnoreElement } from './tracker.js';

export class ClickTracker implements AutoTracker {
  name = 'click';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private handler: ((e: Event) => void) | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined') return;

    this.handler = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !this.trackFn) return;
      if (shouldIgnoreElement(target)) return;

      const props: Record<string, unknown> = {
        element_tag: target.tagName.toLowerCase(),
        element_id: (target as HTMLElement).id || null,
        element_classes: (target as HTMLElement).className || null,
        element_text: (target.textContent?.trim() || '').slice(0, 255) || null,
      };

      const analyticsId = target.getAttribute('data-analytics-id');
      if (analyticsId) props.data_analytics_id = analyticsId;

      const anchor = target.closest('a');
      if (anchor) {
        props.href = (anchor as HTMLAnchorElement).href;
      }

      this.trackFn('$click', props);
    };

    document.addEventListener('click', this.handler, true);
  }

  stop(): void {
    if (this.handler) {
      document.removeEventListener('click', this.handler, true);
      this.handler = null;
    }
    this.trackFn = null;
  }
}
