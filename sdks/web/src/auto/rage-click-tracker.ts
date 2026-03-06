import type { AutoTracker } from './tracker.js';
import { shouldIgnoreElement, isAnonymousElement } from './tracker.js';

interface ClickRecord {
  timestamp: number;
  selector: string;
}

function getElementSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
  const classAttr = (el.getAttribute('class') ?? '').trim();
  const classes = classAttr
    ? '.' + classAttr.split(/\s+/).join('.')
    : '';
  return `${tag}${id}${classes}`;
}

export class RageClickTracker implements AutoTracker {
  name = 'rage-click';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private handler: ((e: Event) => void) | null = null;
  private clicks: ClickRecord[] = [];
  private readonly threshold = 3;
  private readonly windowMs = 1000;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined') return;

    this.handler = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !this.trackFn) return;
      if (shouldIgnoreElement(target)) return;
      if (isAnonymousElement(target)) return;

      const now = Date.now();
      const selector = getElementSelector(target);

      // Clean old clicks
      this.clicks = this.clicks.filter((c) => now - c.timestamp < this.windowMs);
      this.clicks.push({ timestamp: now, selector });

      // Count clicks on same selector
      const sameElement = this.clicks.filter((c) => c.selector === selector);
      if (sameElement.length >= this.threshold) {
        this.trackFn('$rage_click', {
          click_count: sameElement.length,
          element_tag: target.tagName.toLowerCase(),
          element_id: (target as HTMLElement).id || null,
          element_classes: target.getAttribute('class') || null,
          element_text: (target.textContent?.trim() || '').slice(0, 255) || null,
        });
        // Reset to avoid duplicate fires
        this.clicks = this.clicks.filter((c) => c.selector !== selector);
      }
    };

    document.addEventListener('click', this.handler, true);
  }

  stop(): void {
    if (this.handler) {
      document.removeEventListener('click', this.handler, true);
      this.handler = null;
    }
    this.clicks = [];
    this.trackFn = null;
  }
}
