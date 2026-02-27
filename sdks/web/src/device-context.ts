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

let cachedContext: DeviceContext | null = null;

export async function getDeviceContext(): Promise<DeviceContext> {
  if (cachedContext) {
    return cachedContext;
  }

  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const nav = typeof navigator !== 'undefined'
    ? (navigator as NavigatorWithConnection)
    : null;

  const deviceId = await generateDeviceId();

  cachedContext = {
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

  return cachedContext;
}

/** Clear cached context (used in testing). */
export function clearDeviceContextCache(): void {
  cachedContext = null;
}
