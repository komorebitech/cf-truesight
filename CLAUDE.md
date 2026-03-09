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
- shadcn/ui components in `src/components/ui/` — use Radix-based Select (not native `<select>`)
- Hooks in `src/hooks/` wrap TanStack Query
- API client in `src/lib/api.ts` — reads `VITE_ADMIN_TOKEN` from env, proxied via Vite in dev
- Dashboard reads `.env` from parent directory (`envDir: ..` in vite.config.ts)
- All times displayed in 12-hour AM/PM format (`hh:mm a` via date-fns). Use `formatDate()` from `lib/utils.ts`.
- Chart color palette: `#2d6a4f`, `#9e2a2b`, `#d62828`, `#386641`, `#ffb700`, `#1565c0` — defined in `lib/charts.ts` and CSS vars `--chart-1` through `--chart-6`

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
- `VITE_API_BASE_URL` — API base URL for dashboard (default `/api/v1`)

## Common Pitfalls

- `envy` crate auto-converts snake_case field names to UPPER_CASE env vars. Do NOT use `#[serde(rename)]` on config structs.
- Empty env vars (e.g. `CLICKHOUSE_PASSWORD=`) need `#[serde(default)]` or `Option<String>`.
- Ingestion API accepts both zstd-compressed and plain JSON bodies.
- Dashboard Vite proxy rewrites `/api` → `http://localhost:8081` (admin API).
- API key prefix is displayed as-is (not masked) in the dashboard.
- Backend `list_api_keys` returns a plain `Vec<ApiKeyResponse>`, not `{ data: [...] }`.


### CLI
- Crate: `crates/cli/`, binary: `truesight`
- Uses clap derive API, reqwest HTTP client, no dependency on truesight-common
- Config stored in `~/.truesight/` (credentials.json, config.json)
- Auth: browser-based Google OAuth via dashboard `/cli/auth` page
- Output: JSON by default (`--format table` for human-readable)
- All admin API read/query features have corresponding CLI commands
- Release process:
  1. Bump version in `crates/cli/Cargo.toml`
  2. Commit and push
  3. Tag: `git tag cli-v<version> && git push origin cli-v<version>`
  4. CI builds 5 platform binaries (linux x86_64/aarch64, darwin x86_64/aarch64, windows x86_64) and creates a GitHub Release
  5. Install script at `dashboard/public/install.sh` (served at `https://truesight.cityflo.net/install.sh`) auto-fetches the latest release

## Debugging and Maintenance

- Use aws cli with profile cf and region ap-south-1 to access aws resources
- ECS stores logs in Cloudwatch logs
- All credentials are stored in secrets manager (clickhouse, postgresql, etc.)

## Design Context

### Users
Both technical (engineers) and non-technical (product/growth) users. Engineers monitor event pipelines and debug issues; product people review funnels, retention, and trends. The interface must be powerful enough for technical queries while remaining approachable for non-technical stakeholders.

### Brand Personality
**Warm, modern, capable.** Approachable but powerful — the warm color palette (peach accents, forest green primary) signals friendliness while dense data views and rich query builders signal capability. Not cold or clinical; not playful or casual.

### Aesthetic Direction
- **Visual tone**: Clean, warm, professional. Stripe-like data presentation with PostHog/Mixpanel-level analytics depth and Linear/Vercel polish on interactions.
- **Color system**: Warm neutrals (8°–32° hue range), forest green primary (hsl 152°), peach/coral accents. Never cold grays or pure blue-grays.
- **Typography**: Asap (body/headings) + Chillax (brand/logo). Tight letter-spacing (-0.02em headings, 0.08em brand) for premium feel.
- **Motion**: Smooth entrance animations (fadeInUp, fadeInLeft), subtle stagger delays. Progress bar feedback on data fetches. Respect `prefers-reduced-motion`.
- **Theme**: Light mode default, full dark mode support. Both warm-toned.
- **Anti-references**: Avoid generic SaaS gray/blue aesthetics, overly dense enterprise UIs, or playful/gamified patterns.

### Design Principles
1. **Data first** — Charts, tables, and numbers are the hero. UI chrome stays minimal so data breathes.
2. **Progressive disclosure** — Show the essential query controls up front; advanced filters, breakdowns, and config reveal on demand.
3. **Warm confidence** — Use the warm palette and smooth animations to make complex analytics feel approachable, not intimidating.
4. **Consistent density** — Maintain uniform spacing (`space-y-6` page sections, `gap-2` control rows, `p-6` card padding) across all views.
5. **Accessible by default** — WCAG AA contrast ratios (4.5:1 text, 3:1 UI components), full keyboard navigation, proper ARIA patterns on all interactive elements.
