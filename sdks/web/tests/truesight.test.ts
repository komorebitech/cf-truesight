import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TrueSightSDK } from '../src/truesight.js';

// Mock localStorage
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(localStorageStore)) {
      delete localStorageStore[key];
    }
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock fetch globally
const fetchMock = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ ok: true }), { status: 200 })
);
vi.stubGlobal('fetch', fetchMock);

// Mock navigator.sendBeacon
vi.stubGlobal('navigator', {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  language: 'en-US',
  sendBeacon: vi.fn().mockReturnValue(true),
});

// Mock screen
vi.stubGlobal('screen', {
  width: 1920,
  height: 1080,
  colorDepth: 24,
});

// Mock document
vi.stubGlobal('document', {
  visibilityState: 'visible',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  createElement: vi.fn().mockReturnValue({
    getContext: vi.fn().mockReturnValue({
      textBaseline: '',
      font: '',
      fillStyle: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
    }),
    width: 0,
    height: 0,
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
  }),
  querySelector: vi.fn().mockReturnValue(null),
});

// Mock window (for event listeners in flush-scheduler)
vi.stubGlobal('window', {
  location: { origin: 'https://test.example.com' },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

describe('TrueSightSDK', () => {
  let sdk: TrueSightSDK;

  beforeEach(async () => {
    sdk = new TrueSightSDK();
    fetchMock.mockClear();
    localStorageMock.clear();

    // Delete the database before each test
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('truesight_events');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });

  afterEach(() => {
    sdk.destroy();
  });

  describe('init', () => {
    it('should initialize with valid config', async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });

      expect(sdk.isInitialized()).toBe(true);
    });

    it('should throw if apiKey is missing', async () => {
      await expect(
        sdk.init({
          apiKey: '',
          endpoint: 'https://api.truesight.dev/v1/events',
        })
      ).rejects.toThrow('apiKey is required');
    });

    it('should throw if endpoint is missing', async () => {
      await expect(
        sdk.init({
          apiKey: 'test-api-key',
          endpoint: '',
        })
      ).rejects.toThrow('endpoint is required');
    });

    it('should not reinitialize if already initialized', async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });

      // Should not throw, just warn
      await sdk.init({
        apiKey: 'different-key',
        endpoint: 'https://api.truesight.dev/v1/events',
      });

      expect(sdk.isInitialized()).toBe(true);
    });

    it('should generate anonymous ID on init', async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });

      expect(sdk.getAnonymousId()).toBeTruthy();
      expect(sdk.getAnonymousId().length).toBeGreaterThan(0);
    });
  });

  describe('track', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should queue a track event', async () => {
      await sdk.track('button_click', { button_id: 'cta-1' });
      // Event is queued -- verify by flushing and checking fetch was called
      await sdk.flush();

      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.truesight.dev/v1/events');
    });

    it('should not track empty event names', async () => {
      await sdk.track('');
      await sdk.flush();

      // Should not have sent anything (no events queued)
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      const uninitSdk = new TrueSightSDK();
      await expect(
        uninitSdk.track('test_event')
      ).rejects.toThrow('not initialized');
      uninitSdk.destroy();
    });
  });

  describe('identify', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should set userId', async () => {
      await sdk.identify('user-42', { name: 'Test User' });

      expect(sdk.getUserId()).toBe('user-42');
    });

    it('should auto-promote mobile_number from traits', async () => {
      await sdk.identify('user-42', {
        mobile_number: '9876543210',
      });

      expect(sdk.getMobileNumber()).toBe('9876543210');
    });

    it('should auto-promote email from traits', async () => {
      await sdk.identify('user-42', {
        email: 'test@example.com',
      });

      expect(sdk.getEmail()).toBe('test@example.com');
    });

    it('should not identify with empty userId', async () => {
      await sdk.identify('');
      expect(sdk.getUserId()).toBeNull();
    });
  });

  describe('reset', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should clear all user state', async () => {
      await sdk.identify('user-42', {
        email: 'test@example.com',
        mobile_number: '9876543210',
      });

      const oldAnonymousId = sdk.getAnonymousId();

      await sdk.reset();

      expect(sdk.getUserId()).toBeNull();
      expect(sdk.getEmail()).toBeNull();
      expect(sdk.getMobileNumber()).toBeNull();
      expect(sdk.getAnonymousId()).not.toBe(oldAnonymousId);
    });
  });

  describe('setMobileNumber', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should accept valid 10-digit number', () => {
      sdk.setMobileNumber('9876543210');
      expect(sdk.getMobileNumber()).toBe('9876543210');
    });

    it('should strip non-digit characters and validate', () => {
      sdk.setMobileNumber('(987) 654-3210');
      expect(sdk.getMobileNumber()).toBe('9876543210');
    });

    it('should reject invalid numbers (not 10 digits)', () => {
      sdk.setMobileNumber('123');
      expect(sdk.getMobileNumber()).toBeNull();
    });

    it('should reject numbers with more than 10 digits', () => {
      sdk.setMobileNumber('12345678901');
      expect(sdk.getMobileNumber()).toBeNull();
    });
  });

  describe('setEmail', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should store email', () => {
      sdk.setEmail('user@example.com');
      expect(sdk.getEmail()).toBe('user@example.com');
    });
  });

  describe('screen', () => {
    beforeEach(async () => {
      await sdk.init({
        apiKey: 'test-api-key-123',
        endpoint: 'https://api.truesight.dev/v1/events',
      });
    });

    it('should queue a screen event', async () => {
      await sdk.screen('Home Page', { referrer: 'google.com' });
      await sdk.flush();

      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
