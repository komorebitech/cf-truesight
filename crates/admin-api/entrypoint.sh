#!/usr/bin/env bash
set -euo pipefail

echo "Running ClickHouse migrations..."
export CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-truesight}"
export CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"

# ClickHouse Cloud requires HTTPS + user/password auth
CH_MIGRATE_URL="${CLICKHOUSE_URL}/?user=${CLICKHOUSE_USER:-default}&password=${CLICKHOUSE_PASSWORD:-}"
CLICKHOUSE_URL="$CH_MIGRATE_URL" ./scripts/migrate_clickhouse.sh

echo "Starting admin-api..."
exec ./admin-api
