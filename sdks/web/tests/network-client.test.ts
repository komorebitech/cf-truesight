import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendBatch } from '../src/network-client.js';
import type { BatchPayload } from '../src/event-model.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function createTestPayload(): BatchPayload {
  return {
    batch: [
      {
        event_id: 'evt-001',
        event_name: 'test_event',
        event_type: 'track',
        user_id: 'user-1',
        anonymous_id: 'anon-1',
        mobile_number: null,
        email: null,
        client_timestamp: new Date().toISOString(),
        properties: { action: 'click' },
        context: {
          app_version: 'unknown',
          os_name: 'Web',
          os_version: 'Chrome 120',
          device_model: 'Desktop',
          device_id: 'dev-123',
          network_type: '4g',
          locale: 'en-US',
          timezone: 'America/New_York',
          sdk_version: '0.1.0',
          screen_width: 1920,
          screen_height: 1080,
        },
      },
    ],
    sent_at: new Date().toISOString(),
  };
}

describe('network-client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('sendBatch', () => {
    it('should send a successful batch', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false // disable compression for test simplicity
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.truesight.dev/v1/events');
      expect(options.method).toBe('POST');
      expect(options.headers['X-API-Key']).toBe('test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should retry on 5xx errors', async () => {
      // First two calls return 500, third succeeds
      fetchMock
        .mockResolvedValueOnce(
          new Response('Internal Server Error', { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response('Internal Server Error', { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should retry on 429 (rate limit)', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response('Too Many Requests', { status: 429 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should NOT retry on 4xx errors (except 429)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 })
      );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(400);
      // Should only be called once (no retry)
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 403', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 })
      );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(403);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        );

      const payload = createTestPayload();
      const response = await sendBatch(
        'https://api.truesight.dev/v1/events',
        'test-key',
        payload,
        false
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15000);
  });
});
