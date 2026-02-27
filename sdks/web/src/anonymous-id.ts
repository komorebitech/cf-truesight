import { encrypt, decrypt, deriveKey } from './encryption.js';
import type { EncryptedData } from './encryption.js';

const STORAGE_KEY = 'truesight_anonymous_id';

function generateUUIDv4(): string {
  return crypto.randomUUID();
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

async function readEncrypted(apiKey: string): Promise<string | null> {
  try {
    const storage = getStorage();
    if (!storage) return null;

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const encrypted: EncryptedData = JSON.parse(raw);
    const key = await deriveKey(apiKey);
    return await decrypt(encrypted, key);
  } catch {
    // If decryption fails (e.g. different key), return null
    return null;
  }
}

async function writeEncrypted(
  value: string,
  apiKey: string
): Promise<void> {
  const storage = getStorage();
  if (!storage) return;

  const key = await deriveKey(apiKey);
  const encrypted = await encrypt(value, key);
  storage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}

export async function getOrCreateAnonymousId(
  apiKey: string
): Promise<string> {
  const existing = await readEncrypted(apiKey);
  if (existing) {
    return existing;
  }

  const newId = generateUUIDv4();
  await writeEncrypted(newId, apiKey);
  return newId;
}

export async function resetAnonymousId(
  apiKey: string
): Promise<string> {
  const newId = generateUUIDv4();
  await writeEncrypted(newId, apiKey);
  return newId;
}
