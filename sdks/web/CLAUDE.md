# Web SDK — Claude Code Instructions

## Overview

TypeScript Web SDK for TrueSight analytics. Published as `@cityflo/truesight-web-sdk` on npm.

## Stack

- TypeScript (ES2020 target, strict mode)
- Rollup bundler → ESM + CJS + UMD outputs
- Vitest for testing (with fake-indexeddb)
- Web Crypto API for AES-256-GCM encryption at rest
- IndexedDB for persistent event queue

## Key Architecture

- `TrueSightSDK` class in `truesight.ts` — singleton exported from `index.ts`
- `EventQueue` — IndexedDB-backed encrypted queue. Uses monotonic sequence (`Date.now() * 1000 + seq++`) for FIFO ordering.
- `FlushScheduler` — Periodic flush (30s), visibilitychange, beforeunload (sendBeacon), online event
- `NetworkClient` — fetch POST with retry (exponential backoff, max 10 retries)
- SDK auto-appends `/v1/events/batch` to `endpoint` config
- No zstd compression (fzstd is decompression-only); sends plain JSON

## Public API

```ts
init({ apiKey, endpoint, options? })  // Initialize SDK
track(eventName, properties?)         // Track custom event
identify(userId, traits?)             // Identify user (auto-promotes email, mobile_number)
screen(screenName, properties?)       // Track screen view
flush()                               // Manual flush
reset()                               // Clear user state, new anonymous_id
setMobileNumber(number)               // 10-digit validation
setEmail(email)                       // Set email
```

## Commands

```bash
npm run build        # Rollup build (ESM + CJS + UMD)
npm test             # Vitest
npm run typecheck    # tsc --noEmit
```

## Publishing

```bash
npm login
npm publish          # Runs prepublishOnly (build) automatically
```

## Gotchas

- `fzstd` dependency is decompression-only. Compression is disabled. SDK sends uncompressed JSON.
- Event properties are `Record<string, unknown>`, serialized to JSON string by the server.
- `anonymous_id` is encrypted and persisted in localStorage.
- IndexedDB event payloads encrypted with AES-256-GCM (key derived via PBKDF2 from apiKey + origin).
