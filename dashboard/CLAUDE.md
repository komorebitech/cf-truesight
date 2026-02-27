# Dashboard — Claude Code Instructions

## Overview

React admin dashboard for TrueSight. Manages projects, API keys, and displays event analytics.

## Stack

- React 19 + TypeScript (strict mode)
- Vite dev server (port 3000 via `--port 3000`)
- TanStack Query v5 for data fetching
- Tailwind CSS + shadcn/ui components
- Recharts for charts
- React Router v7

## Project Structure

```
src/
├── main.tsx              # Entry: StrictMode, QueryClientProvider, RouterProvider
├── App.tsx               # Root layout
├── router.tsx            # Routes: /, /projects/:id, /projects/:id/events
├── lib/
│   ├── api.ts            # Typed API client (fetch wrapper, auth header)
│   └── utils.ts          # cn(), formatDate(), formatNumber(), maskApiKey()
├── hooks/                # TanStack Query hooks
│   ├── use-projects.ts
│   ├── use-api-keys.ts
│   ├── use-stats.ts
│   └── use-events.ts
├── pages/
│   ├── ProjectsListPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── EventExplorerPage.tsx
│   └── NotFoundPage.tsx
└── components/
    ├── ui/               # shadcn/ui primitives (Badge, Button, Card, etc.)
    ├── Header.tsx
    ├── Sidebar.tsx
    ├── ProjectForm.tsx
    ├── ApiKeyTable.tsx
    ├── ApiKeyGenerateDialog.tsx
    ├── EventsTable.tsx
    ├── StatsCards.tsx
    └── ThroughputChart.tsx
```

## Key Details

- **Auth**: Static token from `VITE_ADMIN_TOKEN` env var (read from parent `.env`). No login UI.
- **API proxy**: Vite proxies `/api` → `http://localhost:8081` with rewrite stripping `/api` prefix.
- **Path alias**: `@/` resolves to `src/` (configured in tsconfig.json and vite.config.ts).
- **API response shapes**: Backend returns different shapes per endpoint. Check `api.ts` types carefully:
  - `getProjects()` → `{ data: Project[], meta: PaginationMeta }`
  - `getApiKeys()` → `ApiKey[]` (plain array, NOT wrapped in `{ data }`)
  - Stats endpoints return their own shapes (see `api.ts` interfaces)
- **Events pagination**: Uses `has_more: boolean` (not total count). EventsTable uses Previous/Next without page count.
- **Properties field**: `TrackedEvent.properties` is a JSON **string**, not an object. Parse before displaying.

## Commands

```bash
pnpm dev           # Dev server on port 3000
pnpm build         # Production build
pnpm typecheck     # tsc --noEmit
pnpm lint          # ESLint
```
