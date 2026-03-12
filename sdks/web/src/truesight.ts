import type { Config } from './config.js';
import { buildConfig } from './config.js';
import type { TrueSightEvent, EventType } from './event-model.js';
import { EventQueue } from './event-queue.js';
import { FlushScheduler } from './flush-scheduler.js';
import { getDeviceContext, clearDeviceContextCache } from './device-context.js';
import {
  getOrCreateAnonymousId,
  resetAnonymousId,
} from './anonymous-id.js';
import { readUserId, writeUserId, clearUserId } from './user-id.js';
import { clearKeyCache } from './encryption.js';
import { logger } from './logger.js';
import { SessionManager } from './session-manager.js';
import { AutoTrackManager } from './auto/auto-track-manager.js';

export class TrueSightSDK {
  private initialized = false;
  private config!: Config;
  private queue!: EventQueue;
  private scheduler!: FlushScheduler;
  private sessionManager!: SessionManager;
  private autoTrackManager: AutoTrackManager | null = null;

  private userId: string | null = null;
  private anonymousId: string = '';
  private mobileNumber: string | null = null;
  private email: string | null = null;
  private traits: Record<string, unknown> = {};

  async init(initConfig: {
    apiKey: string;
    endpoint: string;
    options?: Partial<Config>;
  }): Promise<void> {
    if (this.initialized) {
      logger.warn('TrueSight already initialized');
      return;
    }

    if (!initConfig.apiKey) {
      throw new Error('apiKey is required');
    }
    if (!initConfig.endpoint) {
      throw new Error('endpoint is required');
    }

    this.config = buildConfig(initConfig);
    logger.setDebug(this.config.debug);

    // Initialize anonymous ID
    this.anonymousId = await getOrCreateAnonymousId(this.config.apiKey);

    // Restore persisted user ID
    this.userId = await readUserId(this.config.apiKey);

    // Open IndexedDB queue
    this.queue = new EventQueue(this.config.apiKey, this.config.maxQueueHard);
    await this.queue.open();

    // Start flush scheduler
    this.scheduler = new FlushScheduler(this.config, this.queue);
    this.scheduler.start();

    // Initialize session manager
    this.sessionManager = new SessionManager(
      this.config.sessionTimeout,
      (eventName, properties) => {
        void this.enqueueEvent('track', eventName, properties).catch((error) => {
          logger.warn(`Failed to enqueue session event "${eventName}": ${String(error)}`);
        });
      }
    );

    this.initialized = true;
    logger.info('TrueSight SDK initialized');

    // Initialize auto-tracking (must be after initialized=true since trackers call track())
    this.autoTrackManager = new AutoTrackManager(
      this.config.autoTrack,
      (eventName, properties) => {
        void this.track(eventName, properties).catch((error) => {
          logger.warn(`Failed to auto-track event "${eventName}": ${String(error)}`);
        });
      },
      (screenName, properties) => {
        void this.screen(screenName, properties).catch((error) => {
          logger.warn(`Failed to auto-track screen "${screenName}": ${String(error)}`);
        });
      }
    );
    this.autoTrackManager.start();
  }

  async track(
    eventName: string,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    this.ensureInitialized();

    if (!eventName) {
      logger.warn('track() called with empty event name');
      return;
    }

    await this.enqueueEvent('track', eventName, properties);
  }

  async identify(
    userId: string,
    traits: Record<string, unknown> = {}
  ): Promise<void> {
    this.ensureInitialized();

    if (!userId) {
      logger.warn('identify() called with empty userId');
      return;
    }

    this.userId = userId;
    this.traits = { ...this.traits, ...traits };

    // Persist user ID for cross-reload continuity
    await writeUserId(userId, this.config.apiKey);

    // Auto-promote mobile_number and email from traits
    if (
      typeof traits.mobile_number === 'string' &&
      traits.mobile_number
    ) {
      this.mobileNumber = traits.mobile_number;
    }
    if (typeof traits.email === 'string' && traits.email) {
      this.email = traits.email;
    }

    // Backfill queued events that have no user_id
    await this.queue.backfillUserId(userId);

    await this.enqueueEvent('identify', 'identify', traits);
  }

  async screen(
    screenName: string,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    this.ensureInitialized();

    if (!screenName) {
      logger.warn('screen() called with empty screen name');
      return;
    }

    await this.enqueueEvent('screen', '$screen', {
      screen_name: screenName,
      ...properties,
    });
  }

  async flush(): Promise<void> {
    this.ensureInitialized();
    await this.scheduler.flush();
  }

  async trackExperiment(
    flagName: string,
    variant: string,
    properties: Record<string, unknown> = {}
  ): Promise<void> {
    await this.track('$experiment_exposure', {
      flag_name: flagName,
      variant,
      ...properties,
    });
  }

  async reset(): Promise<void> {
    this.ensureInitialized();

    this.userId = null;
    this.mobileNumber = null;
    this.email = null;
    this.traits = {};

    // Clear persisted user ID
    clearUserId();

    // Reset session
    if (this.sessionManager) {
      this.sessionManager.reset();
    }

    // Generate new anonymous ID
    this.anonymousId = await resetAnonymousId(this.config.apiKey);

    logger.debug('SDK state reset');
  }

  setMobileNumber(number: string): void {
    this.ensureInitialized();

    // Validate 10 digits
    const digits = number.replace(/\D/g, '');
    if (digits.length !== 10) {
      logger.warn(
        `Invalid mobile number: expected 10 digits, got ${digits.length}`
      );
      return;
    }

    this.mobileNumber = digits;
    logger.debug('Mobile number set');
  }

  setEmail(email: string): void {
    this.ensureInitialized();
    this.email = email;
    logger.debug('Email set');
  }

  /** Check if SDK is initialized (useful for testing). */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Get current user ID (useful for testing). */
  getUserId(): string | null {
    return this.userId;
  }

  /** Get current anonymous ID (useful for testing). */
  getAnonymousId(): string {
    return this.anonymousId;
  }

  /** Get current mobile number (useful for testing). */
  getMobileNumber(): string | null {
    return this.mobileNumber;
  }

  /** Get current email (useful for testing). */
  getEmail(): string | null {
    return this.email;
  }

  /** Destroy SDK instance (stop scheduler, close DB). */
  destroy(): void {
    if (this.autoTrackManager) {
      this.autoTrackManager.stop();
      this.autoTrackManager = null;
    }
    if (this.sessionManager) {
      this.sessionManager.destroy();
    }
    if (this.scheduler) {
      this.scheduler.stop();
    }
    if (this.queue) {
      this.queue.close();
    }
    this.initialized = false;
    this.userId = null;
    this.anonymousId = '';
    this.mobileNumber = null;
    this.email = null;
    this.traits = {};
    clearKeyCache();
    clearDeviceContextCache();
    logger.debug('SDK destroyed');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'TrueSight SDK not initialized. Call init() first.'
      );
    }
  }

  private async enqueueEvent(
    eventType: EventType,
    eventName: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    const context = await getDeviceContext();

    // Touch session activity + get session ID
    const sessionId = this.sessionManager
      ? (this.sessionManager.touchActivity(), this.sessionManager.getSessionId())
      : null;

    const event: TrueSightEvent = {
      event_id: crypto.randomUUID(),
      event_name: eventName,
      event_type: eventType,
      user_id: this.userId,
      anonymous_id: this.anonymousId,
      mobile_number: this.mobileNumber,
      email: this.email,
      session_id: sessionId,
      client_timestamp: new Date().toISOString(),
      properties,
      context,
    };

    // Check event size
    const serialized = JSON.stringify(event);
    if (serialized.length > this.config.maxEventSize) {
      logger.warn(
        `Event exceeds maxEventSize (${serialized.length} > ${this.config.maxEventSize}), dropping`
      );
      return;
    }

    // Check queue soft limit
    const queueSize = await this.queue.size();
    if (queueSize >= this.config.maxQueueSize) {
      logger.warn(
        `Queue at soft limit (${queueSize}/${this.config.maxQueueSize}), triggering flush`
      );
      this.scheduler.scheduleFlush();
    }

    await this.queue.enqueue(event);
    logger.debug(`Event queued: ${eventType} - ${eventName}`);
  }
}
