import type { Config } from './config.js';
import type { BatchPayload } from './event-model.js';
import { EventQueue } from './event-queue.js';
import { sendBatch, sendBeacon } from './network-client.js';
import { logger } from './logger.js';

const NETWORK_DEBOUNCE_MS = 2000;

export class FlushScheduler {
  private config: Config;
  private queue: EventQueue;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private flushPromise: Promise<void> = Promise.resolve();
  private isFlushing = false;
  private networkDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Store bound handlers so they can be removed
  private boundVisibilityHandler: (() => void) | null = null;
  private boundBeforeUnloadHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;

  constructor(config: Config, queue: EventQueue) {
    this.config = config;
    this.queue = queue;
  }

  start(): void {
    if (this.timerId) {
      logger.warn('Flush scheduler already started');
      return;
    }

    // Periodic flush
    this.timerId = setInterval(() => {
      this.scheduleFlush();
    }, this.config.flushInterval);

    // Flush on tab hide
    if (typeof document !== 'undefined') {
      this.boundVisibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          this.flushWithBeacon();
        }
      };
      document.addEventListener(
        'visibilitychange',
        this.boundVisibilityHandler
      );
    }

    // Flush on page unload
    if (typeof window !== 'undefined') {
      this.boundBeforeUnloadHandler = () => {
        this.flushWithBeacon();
      };
      window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);
    }

    // Flush on network restore with debounce
    if (typeof window !== 'undefined') {
      this.boundOnlineHandler = () => {
        if (this.networkDebounceTimer) {
          clearTimeout(this.networkDebounceTimer);
        }
        this.networkDebounceTimer = setTimeout(() => {
          logger.debug('Network restored, flushing');
          this.scheduleFlush();
          this.networkDebounceTimer = null;
        }, NETWORK_DEBOUNCE_MS);
      };
      window.addEventListener('online', this.boundOnlineHandler);
    }

    logger.debug('Flush scheduler started');
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.networkDebounceTimer) {
      clearTimeout(this.networkDebounceTimer);
      this.networkDebounceTimer = null;
    }

    if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
      document.removeEventListener(
        'visibilitychange',
        this.boundVisibilityHandler
      );
      this.boundVisibilityHandler = null;
    }

    if (typeof window !== 'undefined') {
      if (this.boundBeforeUnloadHandler) {
        window.removeEventListener(
          'beforeunload',
          this.boundBeforeUnloadHandler
        );
        this.boundBeforeUnloadHandler = null;
      }
      if (this.boundOnlineHandler) {
        window.removeEventListener('online', this.boundOnlineHandler);
        this.boundOnlineHandler = null;
      }
    }

    logger.debug('Flush scheduler stopped');
  }

  /** Schedule a flush, preventing concurrent flushes via promise chaining. */
  scheduleFlush(): void {
    this.flushPromise = this.flushPromise.then(() => this.doFlush());
  }

  /** Manually trigger flush and return the promise. */
  async flush(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.flushPromise = this.flushPromise.then(async () => {
        await this.doFlush();
        resolve();
      });
    });
  }

  private async doFlush(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      const queueSize = await this.queue.size();
      if (queueSize === 0) {
        logger.debug('Nothing to flush');
        return;
      }

      const batchSize = Math.min(this.config.maxBatchSize, queueSize);
      const events = await this.queue.dequeue(batchSize);

      if (events.length === 0) {
        return;
      }

      const payload: BatchPayload = {
        batch: events,
        sent_at: new Date().toISOString(),
      };

      const url = `${this.config.endpoint.replace(/\/+$/, '')}/v1/events/batch`;
      const response = await sendBatch(
        url,
        this.config.apiKey,
        payload
      );

      if (response.ok) {
        // Remove sent events from queue
        const ids = events.map((e) => e.event_id);
        await this.queue.remove(ids);
        logger.debug(`Flushed ${events.length} events successfully`);
      } else {
        logger.error(`Flush failed with status: ${response.status}`);
      }
    } catch (err) {
      logger.error('Flush error:', err);
    } finally {
      this.isFlushing = false;
    }
  }

  private async flushWithBeacon(): Promise<void> {
    try {
      const queueSize = await this.queue.size();
      if (queueSize === 0) return;

      const batchSize = Math.min(this.config.maxBatchSize, queueSize);
      const events = await this.queue.dequeue(batchSize);

      if (events.length === 0) return;

      const payload: BatchPayload = {
        batch: events,
        sent_at: new Date().toISOString(),
      };

      const beaconUrl = `${this.config.endpoint.replace(/\/+$/, '')}/v1/events/batch`;
      const success = sendBeacon(
        beaconUrl,
        this.config.apiKey,
        payload
      );

      if (success) {
        const ids = events.map((e) => e.event_id);
        await this.queue.remove(ids);
      }
    } catch (err) {
      logger.error('Beacon flush error:', err);
    }
  }
}
