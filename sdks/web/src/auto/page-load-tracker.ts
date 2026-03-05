import type { AutoTracker } from './tracker.js';

export class PageLoadTracker implements AutoTracker {
  name = 'page-load';
  private fired = false;
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private loadHandler: (() => void) | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (document.readyState === 'complete') {
      this.fireMetrics();
    } else {
      this.loadHandler = () => this.fireMetrics();
      window.addEventListener('load', this.loadHandler);
    }
  }

  stop(): void {
    if (this.loadHandler) {
      window.removeEventListener('load', this.loadHandler);
      this.loadHandler = null;
    }
    this.trackFn = null;
  }

  private fireMetrics(): void {
    if (this.fired || !this.trackFn) return;
    this.fired = true;

    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!entries.length) return;

    const nav = entries[0];
    this.trackFn('$page_load', {
      dns_time: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      connect_time: Math.round(nav.connectEnd - nav.connectStart),
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      dom_content_loaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      load_complete: Math.round(nav.loadEventEnd - nav.startTime),
      transfer_size: nav.transferSize,
    });
  }
}
