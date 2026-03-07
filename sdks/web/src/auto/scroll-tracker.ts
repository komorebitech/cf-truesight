import type { AutoTracker } from './tracker.js';

const THRESHOLDS = [25, 50, 75, 100];

export class ScrollTracker implements AutoTracker {
  name = 'scroll';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private navigationHandler: (() => void) | null = null;
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;
  private firedThresholds: Set<number> = new Set();
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastUrl: string | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    this.lastUrl = location.href;

    this.scrollHandler = () => {
      if (this.throttleTimer) return;
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.checkScroll();
      }, 200);
    };

    this.navigationHandler = () => {
      this.firedThresholds.clear();
      this.lastUrl = location.href;
    };

    // Reset thresholds on pushState/replaceState (SPA navigations)
    this.origPushState = history.pushState;
    this.origReplaceState = history.replaceState;
    const self = this;

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      self.origPushState!.apply(this, args);
      self.navigationHandler!();
    };
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      self.origReplaceState!.apply(this, args);
      self.navigationHandler!();
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('popstate', this.navigationHandler);
  }

  stop(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.navigationHandler) {
      window.removeEventListener('popstate', this.navigationHandler);
      this.navigationHandler = null;
    }
    if (this.origPushState) {
      history.pushState = this.origPushState;
      this.origPushState = null;
    }
    if (this.origReplaceState) {
      history.replaceState = this.origReplaceState;
      this.origReplaceState = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.firedThresholds.clear();
    this.trackFn = null;
  }

  private checkScroll(): void {
    if (!this.trackFn) return;

    if (this.lastUrl !== location.href) {
      this.firedThresholds.clear();
      this.lastUrl = location.href;
    }

    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    if (scrollHeight <= viewportHeight) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const percentage = Math.round(((scrollTop + viewportHeight) / scrollHeight) * 100);

    for (const threshold of THRESHOLDS) {
      if (percentage >= threshold && !this.firedThresholds.has(threshold)) {
        this.firedThresholds.add(threshold);
        this.trackFn('$scroll_depth', {
          depth_percentage: threshold,
          page_url: location.href,
        });
      }
    }
  }
}
