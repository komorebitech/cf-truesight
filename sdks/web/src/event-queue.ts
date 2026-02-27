import type { TrueSightEvent } from './event-model.js';
import { encrypt, decrypt, deriveKey } from './encryption.js';
import type { EncryptedData } from './encryption.js';
import { logger } from './logger.js';

const DB_NAME = 'truesight_events';
const STORE_NAME = 'events';
const DB_VERSION = 1;
const EVICTION_BATCH_SIZE = 500;

interface StoredEvent {
  event_id: string;
  timestamp: number;
  encrypted: EncryptedData;
}

export class EventQueue {
  private db: IDBDatabase | null = null;
  private apiKey: string;
  private maxQueueHard: number;
  private sequence = 0;

  constructor(apiKey: string, maxQueueHard: number) {
    this.apiKey = apiKey;
    this.maxQueueHard = maxQueueHard;
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'event_id',
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.debug('IndexedDB opened successfully');
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', request.error);
        reject(request.error);
      };
    });
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not opened. Call open() first.');
    }
    const tx = this.db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  async enqueue(event: TrueSightEvent): Promise<void> {
    // Check if we need to evict
    const currentSize = await this.size();
    if (currentSize >= this.maxQueueHard) {
      logger.warn(
        `Queue at hard limit (${currentSize}/${this.maxQueueHard}), evicting oldest ${EVICTION_BATCH_SIZE} events`
      );
      await this.evictOldest(EVICTION_BATCH_SIZE);
    }

    const key = await deriveKey(this.apiKey);
    const encrypted = await encrypt(JSON.stringify(event), key);

    const stored: StoredEvent = {
      event_id: event.event_id,
      timestamp: Date.now() * 1000 + this.sequence++,
      encrypted,
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.put(stored);

      request.onsuccess = () => {
        logger.debug(`Event enqueued: ${event.event_id}`);
        resolve();
      };
      request.onerror = () => {
        logger.error('Failed to enqueue event', request.error);
        reject(request.error);
      };
    });
  }

  async dequeue(count: number): Promise<TrueSightEvent[]> {
    const key = await deriveKey(this.apiKey);
    const storedEvents = await this.getOldest(count);
    const events: TrueSightEvent[] = [];

    for (const stored of storedEvents) {
      try {
        const json = await decrypt(stored.encrypted, key);
        events.push(JSON.parse(json) as TrueSightEvent);
      } catch (err) {
        logger.error('Failed to decrypt event', stored.event_id, err);
        // Remove corrupted event
        await this.remove([stored.event_id]);
      }
    }

    return events;
  }

  private getOldest(count: number): Promise<StoredEvent[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'next');
      const results: StoredEvent[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < count) {
          results.push(cursor.value as StoredEvent);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const id of ids) {
        store.delete(id);
      }

      tx.oncomplete = () => {
        logger.debug(`Removed ${ids.length} events from queue`);
        resolve();
      };

      tx.onerror = () => {
        logger.error('Failed to remove events', tx.error);
        reject(tx.error);
      };
    });
  }

  async size(): Promise<number> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.clear();

      request.onsuccess = () => {
        logger.debug('Event queue cleared');
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async evictOldest(count: number): Promise<void> {
    const events = await this.getOldest(count);
    const ids = events.map((e) => e.event_id);
    await this.remove(ids);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
