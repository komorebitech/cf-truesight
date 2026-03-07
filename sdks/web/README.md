# @cityflo/truesight-web-sdk

Lightweight, privacy-first analytics SDK for browser-based applications. Events are encrypted at rest in IndexedDB and flushed in batches to your TrueSight ingestion API.

## Installation

```bash
npm install @cityflo/truesight-web-sdk
# or
pnpm add @cityflo/truesight-web-sdk
```

## Quick Start

### ES Module

```typescript
import { init, track, identify, screen, reset } from '@cityflo/truesight-web-sdk';

// Initialize
await init({
  apiKey: 'ts_live_...',
  endpoint: 'https://your-ingestion-api.com',
});

// Track custom events
track('Button Clicked', { button_id: 'checkout', value: 42.99 });

// Identify user
identify('user-123', {
  email: 'user@example.com',
  mobile_number: '9876543210',
  plan: 'premium',
});

// Manual screen view (auto-tracked by default — see below)
screen('/checkout', { referrer: 'cart' });

// Reset on logout
reset();
```

### Script Tag (UMD)

```html
<script src="https://unpkg.com/@cityflo/truesight-web-sdk/dist/truesight.umd.js"></script>
<script>
  TrueSight.init({ apiKey: 'ts_live_...', endpoint: '...' });
  TrueSight.track('Page Viewed');
</script>
```

## Auto-Tracking

All auto-tracking is **enabled by default**. The SDK automatically captures:

| Event | Type | Description |
|-------|------|-------------|
| `$screen` | screen | Page/screen views on navigation (pushState, popstate, hashchange). Includes `screen_name`, `page_url`, `page_title`, `page_referrer`, and `query_params`. |
| `$click` | track | Click interactions (with element selector, text, href) |
| `$rage_click` | track | Rapid repeated clicks on the same element |
| `$dead_click` | track | Clicks that produce no DOM change |
| `$form_submit` | track | Form submissions (with form id/name/action) |
| `$scroll_depth` | track | Maximum scroll depth per page (25%, 50%, 75%, 100%) |
| `$time_on_page` | track | Time spent on each page before navigation |
| `$page_load` | track | Page load performance timing (TTFB, DOM ready, load) |
| `$session_start` | track | New session detected (after 30min inactivity) |
| `$session_end` | track | Session ended |

Disable individual trackers via `autoTrack`:

```typescript
await init({
  apiKey: 'ts_live_...',
  endpoint: 'https://your-ingestion-api.com',
  options: {
    autoTrack: {
      pageViews: false,    // disable auto screen tracking
      clicks: false,
      rageClicks: false,
      deadClicks: false,
      formSubmits: false,
      scrollDepth: false,
      timeOnPage: false,
      pageLoadTiming: false,
    },
  },
});
```

Exclude any element from click/form tracking with `data-ts-ignore`:

```html
<button data-ts-ignore>Not tracked</button>
```

## Configuration

```typescript
await init({
  apiKey: 'ts_live_...',
  endpoint: 'https://your-ingestion-api.com',
  options: {
    flushInterval: 30000,     // flush every 30s (default)
    maxBatchSize: 20,         // events per batch (default)
    maxQueueSize: 1000,       // soft limit — triggers flush (default)
    maxEventSize: 32768,      // max single event size in bytes (default)
    sessionTimeout: 1800000,  // 30min session inactivity timeout (default)
    debug: false,             // enable console debug logging
  },
});
```

## API Reference

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize the SDK. Must be called first. Returns a Promise. |
| `track(event, properties?)` | Track a custom event |
| `identify(userId, traits?)` | Set user identity. Auto-promotes `email` and `mobile_number` from traits. |
| `screen(name, properties?)` | Track a screen/page view. Auto-tracked by default on navigation. |
| `flush()` | Manually flush the event queue |
| `reset()` | Clear user state and generate a new anonymous ID (call on logout) |
| `setMobileNumber(number)` | Set 10-digit mobile number |
| `setEmail(email)` | Set user email |

## Features

- **Encrypted at rest** — Events stored in IndexedDB are encrypted with AES-256-GCM via Web Crypto API
- **Automatic batching** — Events are flushed periodically, on tab hide, and before page unload (via sendBeacon)
- **Retry with backoff** — Failed flushes retry with exponential backoff (up to 10 attempts)
- **Session tracking** — Automatic session detection with configurable inactivity timeout
- **Anonymous ID** — Persistent anonymous ID generated and encrypted in localStorage
- **Tiny footprint** — Zero heavy dependencies, tree-shakeable ESM output

## License

Private — Cityflo Technologies Pvt. Ltd.
