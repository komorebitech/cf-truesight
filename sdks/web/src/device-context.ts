import type { DeviceContext } from './event-model.js';

const SDK_VERSION = '0.1.0';

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
  };
}

function parseBrowserVersion(ua: string): string {
  // Try common browser patterns
  const patterns: [string, RegExp][] = [
    ['Chrome', /Chrome\/(\d+[\d.]*)/],
    ['Firefox', /Firefox\/(\d+[\d.]*)/],
    ['Safari', /Version\/(\d+[\d.]*).*Safari/],
    ['Edge', /Edg\/(\d+[\d.]*)/],
    ['Opera', /OPR\/(\d+[\d.]*)/],
  ];

  for (const [name, regex] of patterns) {
    const match = ua.match(regex);
    if (match) {
      return `${name} ${match[1]}`;
    }
  }

  return 'Unknown';
}

function detectDeviceModel(ua: string): string {
  if (/Tablet|iPad/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

async function generateDeviceId(): Promise<string> {
  const components: string[] = [];

  // Screen dimensions
  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  }

  // Timezone
  try {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    components.push('unknown-tz');
  }

  // Language
  if (typeof navigator !== 'undefined') {
    components.push(navigator.language);
  }

  // Canvas fingerprint
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('TrueSight fingerprint', 2, 15);
        components.push(canvas.toDataURL());
      }
    }
  } catch {
    components.push('no-canvas');
  }

  // Hash everything with SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(components.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Device-level fields are cached (they don't change during a session).
// Page-level fields (URL, path, referrer, viewport) are collected fresh
// every call since they change during SPA navigation.
interface CachedDeviceFields {
  app_version: string;
  os_name: string;
  os_version: string;
  device_model: string;
  device_id: string;
  network_type: string;
  locale: string;
  timezone: string;
  sdk_version: string;
  screen_width: number;
  screen_height: number;
}

let cachedDeviceFields: CachedDeviceFields | null = null;

async function getCachedDeviceFields(): Promise<CachedDeviceFields> {
  if (cachedDeviceFields) {
    return cachedDeviceFields;
  }

  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const nav = typeof navigator !== 'undefined'
    ? (navigator as NavigatorWithConnection)
    : null;

  const deviceId = await generateDeviceId();

  cachedDeviceFields = {
    app_version:
      typeof document !== 'undefined'
        ? document.querySelector('meta[name=version]')?.getAttribute('content') || 'unknown'
        : 'unknown',
    os_name: 'Web',
    os_version: parseBrowserVersion(ua),
    device_model: detectDeviceModel(ua),
    device_id: deviceId,
    network_type: nav?.connection?.effectiveType || 'unknown',
    locale: nav?.language || 'unknown',
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return 'unknown';
      }
    })(),
    sdk_version: SDK_VERSION,
    screen_width: typeof screen !== 'undefined' ? screen.width : 0,
    screen_height: typeof screen !== 'undefined' ? screen.height : 0,
  };

  return cachedDeviceFields;
}

export async function getDeviceContext(): Promise<DeviceContext> {
  const cached = await getCachedDeviceFields();

  // Fresh per-call: these change during SPA navigation
  return {
    ...cached,
    page_url: typeof window !== 'undefined' ? window.location.href : '',
    page_path: typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    viewport_width: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewport_height: typeof window !== 'undefined' ? window.innerHeight : 0,
  };
}

/** Clear cached context (used in testing). */
export function clearDeviceContextCache(): void {
  cachedDeviceFields = null;
}
