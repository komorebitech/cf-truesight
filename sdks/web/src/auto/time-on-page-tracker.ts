import type { AutoTracker } from './tracker.js';

export class TimeOnPageTracker implements AutoTracker {
  name = 'time-on-page';
  private trackFn: ((eventName: string, properties: Record<string, unknown>) => void) | null = null;
  private entryTime: number = 0;
  private entryUrl: string = '';
  private visibilityHandler: (() => void) | null = null;
  private unloadHandler: (() => void) | null = null;
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: (() => void) | null = null;

  start(trackFn: (eventName: string, properties: Record<string, unknown>) => void): void {
    this.trackFn = trackFn;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this.resetEntry();

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.fireDuration();
      } else {
        // Reset entry time when page becomes visible again
        this.resetEntry();
      }
    };

    this.unloadHandler = () => {
      this.fireDuration();
    };

    // Fire duration on SPA navigation (pushState/replaceState)
    const self = this;
    if (typeof history !== 'undefined') {
      this.origPushState = history.pushState;
      this.origReplaceState = history.replaceState;

      history.pushState = function (...args: Parameters<typeof history.pushState>) {
        self.origPushState!.apply(this, args);
        self.onNavigation();
      };
      history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
        self.origReplaceState!.apply(this, args);
        self.onNavigation();
      };
    }

    this.popstateHandler = () => this.onNavigation();
    window.addEventListener('popstate', this.popstateHandler);

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
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    if (this.origPushState) {
      history.pushState = this.origPushState;
      this.origPushState = null;
    }
    if (this.origReplaceState) {
      history.replaceState = this.origReplaceState;
      this.origReplaceState = null;
    }
    this.trackFn = null;
  }

  private onNavigation(): void {
    this.fireDuration();
    this.resetEntry();
  }

  private resetEntry(): void {
    this.entryTime = Date.now();
    this.entryUrl = typeof location !== 'undefined' ? location.href : '';
  }

  private fireDuration(): void {
    if (!this.trackFn || !this.entryTime) return;
    const durationSeconds = Math.round((Date.now() - this.entryTime) / 1000);
    if (durationSeconds < 1) return;
    this.trackFn('$time_on_page', {
      page_url: this.entryUrl,
      duration_seconds: durationSeconds,
    });
    this.entryTime = 0;
  }
}
