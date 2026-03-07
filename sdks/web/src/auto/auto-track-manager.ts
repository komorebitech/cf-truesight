import type { AutoTrackConfig } from '../config.js';
import type { AutoTracker } from './tracker.js';
import { PageviewTracker } from './pageview-tracker.js';
import { ClickTracker } from './click-tracker.js';
import { RageClickTracker } from './rage-click-tracker.js';
import { DeadClickTracker } from './dead-click-tracker.js';
import { FormTracker } from './form-tracker.js';
import { ScrollTracker } from './scroll-tracker.js';
import { TimeOnPageTracker } from './time-on-page-tracker.js';
import { PageLoadTracker } from './page-load-tracker.js';

export class AutoTrackManager {
  private trackers: AutoTracker[] = [];
  private trackFn: (eventName: string, properties: Record<string, unknown>) => void;
  private screenFn: (screenName: string, properties: Record<string, unknown>) => void;
  private started = false;

  constructor(
    config: AutoTrackConfig,
    trackFn: (eventName: string, properties: Record<string, unknown>) => void,
    screenFn: (screenName: string, properties: Record<string, unknown>) => void
  ) {
    this.trackFn = trackFn;
    this.screenFn = screenFn;

    if (config.pageViews) this.trackers.push(new PageviewTracker());
    if (config.clicks) this.trackers.push(new ClickTracker());
    if (config.rageClicks) this.trackers.push(new RageClickTracker());
    if (config.deadClicks) this.trackers.push(new DeadClickTracker());
    if (config.formSubmits) this.trackers.push(new FormTracker());
    if (config.scrollDepth) this.trackers.push(new ScrollTracker());
    if (config.timeOnPage) this.trackers.push(new TimeOnPageTracker());
    if (config.pageLoadTiming) this.trackers.push(new PageLoadTracker());
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const tracker of this.trackers) {
      tracker.start(this.trackFn, this.screenFn);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const tracker of this.trackers) {
      tracker.stop();
    }
  }
}
