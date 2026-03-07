import type { AutoTracker } from './tracker.js';

export class PageviewTracker implements AutoTracker {
  name = 'pageview';
  private screenFn: ((screenName: string, properties: Record<string, unknown>) => void) | null = null;
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: (() => void) | null = null;
  private hashchangeHandler: (() => void) | null = null;

  start(_trackFn: (eventName: string, properties: Record<string, unknown>) => void, screenFn?: (screenName: string, properties: Record<string, unknown>) => void): void {
    this.screenFn = screenFn ?? null;
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    if (this.origPushState || this.origReplaceState || this.popstateHandler || this.hashchangeHandler) {
      return;
    }

    // Monkey-patch pushState/replaceState
    this.origPushState = history.pushState;
    this.origReplaceState = history.replaceState;

    const self = this;

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      self.origPushState!.apply(this, args);
      self.firePageview();
    };

    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      self.origReplaceState!.apply(this, args);
      self.firePageview();
    };

    this.popstateHandler = () => this.firePageview();
    this.hashchangeHandler = () => this.firePageview();

    window.addEventListener('popstate', this.popstateHandler);
    window.addEventListener('hashchange', this.hashchangeHandler);

    // Fire for initial page load
    this.firePageview();
  }

  stop(): void {
    if (this.origPushState) {
      history.pushState = this.origPushState;
      this.origPushState = null;
    }
    if (this.origReplaceState) {
      history.replaceState = this.origReplaceState;
      this.origReplaceState = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    if (this.hashchangeHandler) {
      window.removeEventListener('hashchange', this.hashchangeHandler);
      this.hashchangeHandler = null;
    }
    this.screenFn = null;
  }

  private firePageview(): void {
    if (!this.screenFn) return;
    const queryParams: Record<string, string> = {};
    new URLSearchParams(location.search).forEach((v, k) => {
      queryParams[k] = v;
    });
    this.screenFn(location.pathname, {
      page_url: location.href,
      page_title: document.title,
      page_referrer: document.referrer,
      query_params: queryParams,
    });
  }
}
