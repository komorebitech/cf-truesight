import type { AutoTracker } from './tracker.js';

export class TimeOnPageTracker implements AutoTracker {
  name = 'time-on-page';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private entryTime: number = 0;
  private visibilityHandler: (() => void) | null = null;
  private unloadHandler: (() => void) | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this.entryTime = Date.now();

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.fireDuration();
      } else {
        // Reset entry time when page becomes visible again
        this.entryTime = Date.now();
      }
    };

    this.unloadHandler = () => {
      this.fireDuration();
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('beforeunload', this.unloadHandler);
  }

  stop(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler);
      this.unloadHandler = null;
    }
    this.trackFn = null;
  }

  private fireDuration(): void {
    if (!this.trackFn || !this.entryTime) return;
    const durationSeconds = Math.round((Date.now() - this.entryTime) / 1000);
    if (durationSeconds < 1) return;
    this.trackFn('$time_on_page', {
      page_url: location.href,
      duration_seconds: durationSeconds,
    });
  }
}
