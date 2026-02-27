import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { EventQueue } from '../src/event-queue.js';
import type { TrueSightEvent } from '../src/event-model.js';

function createTestEvent(overrides: Partial<TrueSightEvent> = {}): TrueSightEvent {
  return {
    event_id: crypto.randomUUID(),
    event_name: 'test_event',
    event_type: 'track',
    user_id: null,
    anonymous_id: 'anon-123',
    mobile_number: null,
    email: null,
    client_timestamp: new Date().toISOString(),
    properties: { key: 'value' },
    context: {
      app_version: 'unknown',
      os_name: 'Web',
      os_version: 'Chrome 120',
      device_model: 'Desktop',
      device_id: 'test-device-id',
      network_type: 'unknown',
      locale: 'en-US',
      timezone: 'America/New_York',
      sdk_version: '0.1.0',
      screen_width: 1920,
      screen_height: 1080,
    },
    ...overrides,
  };
}

describe('EventQueue', () => {
  let queue: EventQueue;
  const TEST_API_KEY = 'test-api-key-for-queue';
  const MAX_QUEUE_HARD = 50;

  beforeEach(async () => {
    // Delete the database before each test to ensure isolation
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('truesight_events');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });

    queue = new EventQueue(TEST_API_KEY, MAX_QUEUE_HARD);
    await queue.open();
  });

  afterEach(() => {
    queue.close();
  });

  describe('enqueue and dequeue', () => {
    it('should enqueue and dequeue events in FIFO order', async () => {
      const event1 = createTestEvent({ event_name: 'first' });
      const event2 = createTestEvent({ event_name: 'second' });
      const event3 = createTestEvent({ event_name: 'third' });

      await queue.enqueue(event1);
      await queue.enqueue(event2);
      await queue.enqueue(event3);

      const dequeued = await queue.dequeue(2);

      expect(dequeued).toHaveLength(2);
      expect(dequeued[0].event_name).toBe('first');
      expect(dequeued[1].event_name).toBe('second');
    });

    it('should preserve event data through encrypt/decrypt cycle', async () => {
      const event = createTestEvent({
        event_name: 'data_check',
        properties: {
          string_val: 'hello',
          number_val: 42,
          nested: { a: 1, b: [1, 2, 3] },
        },
      });

      await queue.enqueue(event);
      const dequeued = await queue.dequeue(1);

      expect(dequeued).toHaveLength(1);
      expect(dequeued[0].event_name).toBe('data_check');
      expect(dequeued[0].properties).toEqual({
        string_val: 'hello',
        number_val: 42,
        nested: { a: 1, b: [1, 2, 3] },
      });
      expect(dequeued[0].event_id).toBe(event.event_id);
    });
  });

  describe('size', () => {
    it('should track queue size', async () => {
      expect(await queue.size()).toBe(0);

      await queue.enqueue(createTestEvent());
      expect(await queue.size()).toBe(1);

      await queue.enqueue(createTestEvent());
      expect(await queue.size()).toBe(2);
    });

    it('should update size after remove', async () => {
      const event = createTestEvent();
      await queue.enqueue(event);

      expect(await queue.size()).toBe(1);

      await queue.remove([event.event_id]);
      expect(await queue.size()).toBe(0);
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest events when hard limit is reached', async () => {
      // Close the existing queue and create one with a very small hard limit
      queue.close();

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('truesight_events');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });

      const smallQueue = new EventQueue(TEST_API_KEY, 5);
      await smallQueue.open();

      // Enqueue events up to hard limit
      for (let i = 0; i < 5; i++) {
        const event = createTestEvent({ event_name: `event_${i}` });
        await smallQueue.enqueue(event);
      }

      expect(await smallQueue.size()).toBe(5);

      // This should trigger eviction (oldest 500, but we only have 5, so all get evicted)
      const newEvent = createTestEvent({ event_name: 'new_event' });
      await smallQueue.enqueue(newEvent);

      const size = await smallQueue.size();
      // After eviction of up to 500 oldest (only 5 exist) + adding new one, size should be 1
      expect(size).toBe(1);

      const dequeued = await smallQueue.dequeue(10);
      expect(dequeued.some((e) => e.event_name === 'new_event')).toBe(true);

      smallQueue.close();

      // Re-open the main queue for afterEach
      queue = new EventQueue(TEST_API_KEY, MAX_QUEUE_HARD);
      await queue.open();
    });
  });

  describe('clear', () => {
    it('should remove all events', async () => {
      await queue.enqueue(createTestEvent());
      await queue.enqueue(createTestEvent());
      await queue.enqueue(createTestEvent());

      expect(await queue.size()).toBe(3);

      await queue.clear();
      expect(await queue.size()).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove specific events by ID', async () => {
      const event1 = createTestEvent({ event_name: 'keep' });
      const event2 = createTestEvent({ event_name: 'remove' });
      const event3 = createTestEvent({ event_name: 'keep_too' });

      await queue.enqueue(event1);
      await queue.enqueue(event2);
      await queue.enqueue(event3);

      await queue.remove([event2.event_id]);

      expect(await queue.size()).toBe(2);

      const remaining = await queue.dequeue(10);
      expect(remaining).toHaveLength(2);
      expect(remaining.map((e) => e.event_name)).toEqual(['keep', 'keep_too']);
    });

    it('should handle removing non-existent IDs gracefully', async () => {
      await queue.enqueue(createTestEvent());
      await queue.remove(['non-existent-id']);
      expect(await queue.size()).toBe(1);
    });

    it('should handle empty remove array', async () => {
      await queue.enqueue(createTestEvent());
      await queue.remove([]);
      expect(await queue.size()).toBe(1);
    });
  });
});
