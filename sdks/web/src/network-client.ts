import type { BatchPayload } from './event-model.js';
import { compress, isSupported as compressionSupported } from './compression.js';
import { logger } from './logger.js';

const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

function calculateBackoff(attempt: number): number {
  const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendBatch(
  endpoint: string,
  apiKey: string,
  payload: BatchPayload,
  compressPayload: boolean = true
): Promise<Response> {
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  let body: BodyInit = jsonStr;
  let contentEncoding: string | null = null;

  if (compressPayload && compressionSupported) {
    try {
      const compressed = await compress(encoder.encode(jsonStr));
      body = new Blob([compressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      contentEncoding = 'zstd';
    } catch {
      logger.warn('Compression failed, sending uncompressed');
      body = jsonStr;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };

  if (contentEncoding) {
    headers['Content-Encoding'] = contentEncoding;
  }

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      if (response.ok) {
        logger.debug(
          `Batch sent successfully: ${payload.batch.length} events`
        );
        return response;
      }

      lastResponse = response;

      if (!isRetryableStatus(response.status)) {
        logger.error(
          `Non-retryable HTTP error: ${response.status} ${response.statusText}`
        );
        return response;
      }

      logger.warn(
        `Retryable HTTP error: ${response.status}, attempt ${attempt + 1}/${MAX_RETRIES}`
      );
    } catch (err) {
      lastError = err as Error;
      logger.warn(
        `Network error on attempt ${attempt + 1}/${MAX_RETRIES}:`,
        err
      );
    }

    if (attempt < MAX_RETRIES) {
      const backoff = calculateBackoff(attempt);
      logger.debug(`Backing off for ${backoff}ms`);
      await sleep(backoff);
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('sendBatch failed after all retries');
}

export function sendBeacon(
  endpoint: string,
  apiKey: string,
  payload: BatchPayload
): boolean {
  try {
    const jsonStr = JSON.stringify(payload);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // sendBeacon doesn't support custom headers, so we append apiKey as query param
    const url = new URL(endpoint);
    url.searchParams.set('api_key', apiKey);

    const success = navigator.sendBeacon(url.toString(), blob);
    if (success) {
      logger.debug(
        `Beacon sent: ${payload.batch.length} events`
      );
    } else {
      logger.warn('sendBeacon returned false');
    }
    return success;
  } catch (err) {
    logger.error('sendBeacon failed:', err);
    return false;
  }
}
