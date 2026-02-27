<p align="center">
  <img src="truesight-banner.png" alt="TrueSight" />
</p>

# TrueSight

Self-hosted analytics event routing system. Ingests events from mobile (Android/iOS) and web apps, queues via AWS SQS, and batch-writes to ClickHouse for BI queries. Multi-tenant by project (UUID).

## Architecture

```
SDKs (Android/iOS/Web) → Ingestion API (Rust/Axum) → SQS → CH Writer → ClickHouse
                                ↓
                         PostgreSQL (projects, API keys)
                                ↑
                          Admin API → Dashboard (React)
```

## Tech Stack

- **Backend**: Rust 1.93.1, Axum, Diesel (PostgreSQL 18), ClickHouse
- **Mobile SDKs**: Kotlin Multiplatform Mobile (KMM) — shared core, native Android + iOS
- **Web SDK**: TypeScript, Web Crypto API, IndexedDB — published as `@cityflo/truesight-web-sdk`
- **Dashboard**: React 19, TanStack Query, Tailwind CSS, Recharts
- **Infrastructure**: Docker Compose (local), AWS SQS, Sentry, Datadog

## Quick Start

```bash
# Prerequisites: Rust 1.93.1, Docker, pnpm, just

# First time setup
cp .env.example .env
just deps              # Start Postgres, ClickHouse, LocalStack
just migrate           # Run Diesel + ClickHouse migrations
just seed              # Create test project + API key

# Run everything
just dev               # Full stack with hot-reload

# Or run individually
just run-ingestion     # Ingestion API (port 8080)
just run-writer        # CH Writer (health on port 9090)
just run-admin         # Admin API (port 8081)
just run-dashboard     # Dashboard (port 3000)
```

## Project Structure

```
cf-truesight/
├── crates/
│   ├── common/            # Shared types, auth, SQS, DB, config, telemetry
│   ├── ingestion-api/     # Event ingestion service (port 8080)
│   ├── ch-writer/         # SQS consumer → ClickHouse batch writer
│   └── admin-api/         # Project & API key management (port 8081)
├── migrations/            # Diesel (PostgreSQL) migrations
├── clickhouse-migrations/ # ClickHouse DDL scripts
├── sdks/
│   ├── kmm/               # Kotlin Multiplatform Mobile SDK (Android + iOS)
│   └── web/               # TypeScript Web SDK (@cityflo/truesight-web-sdk)
├── dashboard/             # React admin dashboard
├── scripts/               # Dev utilities (migration runner, traffic simulator)
├── localstack/            # LocalStack SQS init scripts
└── .github/workflows/     # CI/CD pipelines
```

## API Endpoints

### Ingestion API (port 8080)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/events/batch` | `X-API-Key` | Submit event batch (accepts zstd or plain JSON) |
| GET | `/health` | None | Health check |

### Admin API (port 8081)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/projects` | Bearer token | List projects |
| POST | `/v1/projects` | Bearer token | Create project |
| GET | `/v1/projects/:id` | Bearer token | Get project |
| PATCH | `/v1/projects/:id` | Bearer token | Update project |
| DELETE | `/v1/projects/:id` | Bearer token | Soft-delete project |
| GET | `/v1/projects/:pid/api-keys` | Bearer token | List API keys |
| POST | `/v1/projects/:pid/api-keys` | Bearer token | Generate API key |
| DELETE | `/v1/projects/:pid/api-keys/:kid` | Bearer token | Revoke API key |
| GET | `/v1/stats/projects/:pid/event-count` | Bearer token | Event count |
| GET | `/v1/stats/projects/:pid/throughput` | Bearer token | Throughput time series |
| GET | `/v1/stats/projects/:pid/event-types` | Bearer token | Event type breakdown |
| GET | `/v1/stats/projects/:pid/events` | Bearer token | Event explorer |

## Web SDK Usage

```bash
npm install @cityflo/truesight-web-sdk
```

```ts
import { init, track, identify } from '@cityflo/truesight-web-sdk';

init({ apiKey: 'ts_live_...', endpoint: 'https://ingest.example.com' });

track('Button Clicked', { button_id: 'signup' });
identify('user-123', { email: 'user@example.com' });
```

## Development

```bash
just test              # Run all Rust tests
just simulate          # Send synthetic events to local stack
just lint              # fmt + clippy + dashboard lint + typecheck
just load-test         # Load test with configurable rate
```

## License

MIT
