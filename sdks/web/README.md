# @truesight/web-sdk

TrueSight Web Analytics SDK for browser-based applications.

## Installation

```bash
npm install @truesight/web-sdk
# or
pnpm add @truesight/web-sdk
```

## Usage

### ES Module
```typescript
import { init, track, identify, screen, reset } from '@truesight/web-sdk';

// Initialize
init({
  apiKey: 'ts_live_...',
  endpoint: 'https://your-ingestion-api.com',
});

// Track events
track('Button Clicked', { button_id: 'checkout', value: 42.99 });

// Identify user
identify('user-123', {
  email: 'user@example.com',
  mobile_number: '1234567890',
  plan: 'premium',
});

// Screen view
screen('Home Page');

// Reset (logout)
reset();
```

### Script Tag (UMD)
```html
<script src="https://cdn.example.com/truesight.umd.js"></script>
<script>
  TrueSight.init({ apiKey: 'ts_live_...', endpoint: '...' });
  TrueSight.track('Page Viewed');
</script>
```

## Features

- Encrypted IndexedDB event queue (AES-256-GCM via Web Crypto API)
- zstd compression (via fzstd WebAssembly, ~25KB)
- Automatic flush on tab hide (visibilitychange) and page unload (sendBeacon fallback)
- Exponential backoff retry
- Anonymous ID persistence
- Zero required dependencies (fzstd is the only dep)

## Configuration

```typescript
init({
  apiKey: 'ts_live_...',
  endpoint: 'https://your-api.com',
  options: {
    flushInterval: 30000,   // 30 seconds (default)
    maxBatchSize: 20,       // events per batch (default)
    maxQueueSize: 1000,     // soft limit (default)
    debug: false,           // enable debug logging
  },
});
```

## API

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize the SDK |
| `track(event, properties?)` | Track a custom event |
| `identify(userId, traits?)` | Set the user identity |
| `screen(name, properties?)` | Track a screen/page view |
| `flush()` | Manually flush the event queue |
| `reset()` | Clear user state, generate new anonymous ID |
| `setMobileNumber(number)` | Set 10-digit mobile number |
| `setEmail(email)` | Set user email |
