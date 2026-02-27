const SALT = new TextEncoder().encode('truesight-web-sdk-v1');
const PBKDF2_ITERATIONS = 100000;

let cachedKey: CryptoKey | null = null;
let cachedKeySource: string | null = null;

function getCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API is not available');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  return globalThis.crypto.getRandomValues(array);
}

export async function deriveKey(apiKey: string): Promise<CryptoKey> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const keySource = apiKey + origin;

  if (cachedKey && cachedKeySource === keySource) {
    return cachedKey;
  }

  const subtle = getCrypto();

  // SHA-256 hash of apiKey + origin as key material
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keySource);
  const hashBuffer = await subtle.digest('SHA-256', keyData);

  // Import as PBKDF2 base key
  const baseKey = await subtle.importKey(
    'raw',
    hashBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key
  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  cachedKey = derivedKey;
  cachedKeySource = keySource;

  return derivedKey;
}

export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const subtle = getCrypto();
  const encoder = new TextEncoder();
  const iv = getRandomValues(new Uint8Array(12));

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(data)
  );

  return {
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

export async function decrypt(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const subtle = getCrypto();
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/** Clear the cached key (used in reset/testing). */
export function clearKeyCache(): void {
  cachedKey = null;
  cachedKeySource = null;
}
