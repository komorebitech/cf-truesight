# TrueSight — Claude Code Instructions

## Project Overview

TrueSight is a self-hosted analytics event routing system. It ingests events from mobile/web SDKs, queues them via SQS, and batch-writes to ClickHouse. Multi-tenant by project UUID.

## Monorepo Layout

- `crates/common/` — Shared Rust library (types, auth, SQS, DB, config, telemetry)
- `crates/ingestion-api/` — Axum HTTP server for event ingestion (port 8080)
- `crates/ch-writer/` — SQS consumer that batch-writes to ClickHouse
- `crates/admin-api/` — Axum HTTP server for project/key management (port 8081)
- `migrations/` — Diesel PostgreSQL migrations
- `clickhouse-migrations/` — ClickHouse DDL scripts (applied via `scripts/migrate_clickhouse.sh`)
- `sdks/web/` — TypeScript Web SDK (`@cityflo/truesight-web-sdk`)
- `sdks/kmm/` — Kotlin Multiplatform Mobile SDK (Android + iOS)
- `dashboard/` — React admin dashboard (Vite, TanStack Query, Tailwind, Recharts)

## Tech Stack

- **Rust 1.93.1** — pinned in `rust-toolchain.toml`
- **Diesel.rs** — PostgreSQL ORM with compile-time checked queries. Schema in `crates/common/src/schema.rs`
- **Axum** — HTTP framework for ingestion-api and admin-api
- **PostgreSQL 18** — projects and API keys storage
- **ClickHouse** — event storage (ReplacingMergeTree for dedup)
- **AWS SQS** (LocalStack locally) — event queue between ingestion and writer
- **React 19 + Vite** — dashboard
- **pnpm** — Node package manager (workspace root + dashboard)

## Key Conventions

### Rust
- Run `cargo fmt` before committing
- Run `cargo clippy --all-targets -- -D warnings` — zero warnings policy
- Config structs use `envy` crate — field names map directly to UPPER_CASE env vars (no `serde(rename)`)
- Diesel migrations in `/migrations/`, auto-generated schema in `crates/common/src/schema.rs`
- Use `anyhow::Result` in main, `AppError` enum for HTTP error responses

### Dashboard
- Path alias: `@/` = `src/`
- shadcn/ui components in `src/components/ui/`
- Hooks in `src/hooks/` wrap TanStack Query
- API client in `src/lib/api.ts` — reads `VITE_ADMIN_TOKEN` from env, proxied via Vite in dev
- Dashboard reads `.env` from parent directory (`envDir: ..` in vite.config.ts)

### Web SDK
- Published as `@cityflo/truesight-web-sdk` on npm (public)
- Built with Rollup → ESM + CJS + UMD outputs in `dist/`
- Tests with Vitest + fake-indexeddb
- SDK auto-appends `/v1/events/batch` to the configured `endpoint`
- No zstd compression (fzstd is decompression-only); sends plain JSON
- Events encrypted at rest in IndexedDB via Web Crypto API (AES-256-GCM)

## Running Locally

```bash
cp .env.example .env
just deps          # docker-compose up (Postgres, ClickHouse, LocalStack)
just migrate       # Diesel + ClickHouse migrations
just seed          # Test project + API key
just dev           # All services + dashboard with hot-reload
```

## Environment Variables

Key env vars (see `.env.example` for full list):
- `DATABASE_URL` — Postgres connection string
- `SQS_QUEUE_URL` — SQS queue URL
- `ADMIN_API_TOKEN` — Static bearer token for admin API (MVP auth)
- `VITE_ADMIN_TOKEN` — Same token, passed to dashboard via Vite
- `VITE_API_URL` — API base URL for dashboard (default `/api/v1`)

## Common Pitfalls

- `envy` crate auto-converts snake_case field names to UPPER_CASE env vars. Do NOT use `#[serde(rename)]` on config structs.
- Empty env vars (e.g. `CLICKHOUSE_PASSWORD=`) need `#[serde(default)]` or `Option<String>`.
- Ingestion API accepts both zstd-compressed and plain JSON bodies.
- Dashboard Vite proxy rewrites `/api` → `http://localhost:8081` (admin API).
- API key prefix is displayed as-is (not masked) in the dashboard.
- Backend `list_api_keys` returns a plain `Vec<ApiKeyResponse>`, not `{ data: [...] }`.
