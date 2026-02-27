import { TrueSightSDK } from './truesight.js';

// Export types
export type { Config } from './config.js';
export type {
  EventType,
  DeviceContext,
  TrueSightEvent,
  BatchPayload,
} from './event-model.js';

// Export the class for advanced usage
export { TrueSightSDK } from './truesight.js';

// Singleton instance
const instance = new TrueSightSDK();

/**
 * Initialize the TrueSight SDK.
 */
export const init = instance.init.bind(instance);

/**
 * Track a custom event.
 */
export const track = instance.track.bind(instance);

/**
 * Identify a user with traits.
 */
export const identify = instance.identify.bind(instance);

/**
 * Track a screen view.
 */
export const screen = instance.screen.bind(instance);

/**
 * Manually flush the event queue.
 */
export const flush = instance.flush.bind(instance);

/**
 * Reset user state and generate new anonymous ID.
 */
export const reset = instance.reset.bind(instance);

/**
 * Set mobile number for all future events.
 */
export const setMobileNumber = instance.setMobileNumber.bind(instance);

/**
 * Set email for all future events.
 */
export const setEmail = instance.setEmail.bind(instance);

// Default export is the singleton
export default instance;
