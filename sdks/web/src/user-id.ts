import { encrypt, decrypt, deriveKey } from './encryption.js';
import type { EncryptedData } from './encryption.js';

const STORAGE_KEY = 'truesight_user_id';

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export async function readUserId(apiKey: string): Promise<string | null> {
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

export async function writeUserId(
  userId: string,
  apiKey: string
): Promise<void> {
  const storage = getStorage();
  if (!storage) return;

  const key = await deriveKey(apiKey);
  const encrypted = await encrypt(userId, key);
  storage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}

export function clearUserId(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}
