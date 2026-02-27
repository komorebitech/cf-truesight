import { describe, it, expect, beforeEach } from 'vitest';
import { deriveKey, encrypt, decrypt, clearKeyCache } from '../src/encryption.js';

describe('encryption', () => {
  beforeEach(() => {
    clearKeyCache();
  });

  describe('deriveKey', () => {
    it('should derive a CryptoKey from apiKey', async () => {
      const key = await deriveKey('test-api-key');
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    });

    it('should return same key for same apiKey (caching)', async () => {
      const key1 = await deriveKey('test-api-key');
      const key2 = await deriveKey('test-api-key');
      expect(key1).toBe(key2);
    });

    it('should return different key after cache clear', async () => {
      const key1 = await deriveKey('test-api-key');
      clearKeyCache();
      const key2 = await deriveKey('test-api-key');
      // They're different objects (even if same underlying key material)
      expect(key1).not.toBe(key2);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string roundtrip', async () => {
      const key = await deriveKey('test-api-key-123');
      const plaintext = 'Hello, TrueSight!';

      const encrypted = await encrypt(plaintext, key);

      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.ciphertext).toBeTruthy();
      // Ciphertext should not be the same as plaintext
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON data roundtrip', async () => {
      const key = await deriveKey('test-api-key-123');
      const data = JSON.stringify({
        event_id: 'evt-001',
        event_name: 'purchase',
        properties: { amount: 99.99, currency: 'USD' },
      });

      const encrypted = await encrypt(data, key);
      const decrypted = await decrypt(encrypted, key);
      const parsed = JSON.parse(decrypted);

      expect(parsed.event_id).toBe('evt-001');
      expect(parsed.properties.amount).toBe(99.99);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const key = await deriveKey('test-api-key-123');
      const plaintext = 'same data';

      const encrypted1 = await encrypt(plaintext, key);
      const encrypted2 = await encrypt(plaintext, key);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // Ciphertexts should be different too (different IV means different output)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // But both should decrypt to the same plaintext
      const decrypted1 = await decrypt(encrypted1, key);
      const decrypted2 = await decrypt(encrypted2, key);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should fail to decrypt with a different key', async () => {
      const key1 = await deriveKey('api-key-one');
      clearKeyCache();
      const key2 = await deriveKey('api-key-two');

      const plaintext = 'secret data';
      const encrypted = await encrypt(plaintext, key1);

      // Decryption with a different key should throw
      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('should handle empty string', async () => {
      const key = await deriveKey('test-api-key-123');
      const encrypted = await encrypt('', key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', async () => {
      const key = await deriveKey('test-api-key-123');
      const plaintext = 'Hello, World! Symbols, and Japanese: ';
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('different keys should produce different ciphertext', async () => {
      const key1 = await deriveKey('key-alpha');
      clearKeyCache();
      const key2 = await deriveKey('key-beta');

      const plaintext = 'identical message';

      const encrypted1 = await encrypt(plaintext, key1);
      const encrypted2 = await encrypt(plaintext, key2);

      // Different keys should produce different ciphertext
      // (Note: even with same IV this would differ, and IVs are random too)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });
});
