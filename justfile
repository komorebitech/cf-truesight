# TrueSight development commands

set dotenv-load

# Start infrastructure (Postgres 18, ClickHouse, LocalStack)
deps:
    docker compose up -d
    @echo "Waiting for services to be healthy..."
    @docker compose exec postgres pg_isready -U truesight -q && echo "Postgres ready" || (sleep 3 && docker compose exec postgres pg_isready -U truesight)
    @until docker compose exec clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do sleep 1; done && echo "ClickHouse ready"
    @until curl -sf http://localhost:4566/_localstack/health > /dev/null 2>&1; do sleep 1; done && echo "LocalStack ready"
    @echo "All services healthy!"

# Stop infrastructure
deps-down:
    docker compose down

# Destroy data and restart
reset:
    docker compose down -v
    just deps
    just migrate
    just seed

# Run Diesel + ClickHouse migrations
migrate:
    diesel migration run
    @echo "Diesel migrations applied"
    bash scripts/migrate_clickhouse.sh
    @echo "ClickHouse migrations applied"

# Create test project + API key
seed:
    cargo run --bin admin-api -- --seed

# Run ingestion API with hot-reload
run-ingestion:
    cargo watch -x 'run --bin ingestion-api'

# Run CH writer with hot-reload
run-writer:
    cargo watch -x 'run --bin ch-writer'

# Run admin API with hot-reload
run-admin:
    cargo watch -x 'run --bin admin-api'

# Run all Rust services in parallel
run-all:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    cargo watch -x 'run --bin ingestion-api' &
    cargo watch -x 'run --bin ch-writer' &
    cargo watch -x 'run --bin admin-api' &
    wait

# Run React dashboard dev server
run-dashboard:
    cd dashboard && pnpm dev

# Full stack: deps + migrate + services + dashboard
dev: deps migrate _run-stack

# Internal: run all services in parallel (used by dev)
[private]
_run-stack:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    echo "Starting all services..."
    cargo watch -x 'run --bin ingestion-api' &
    cargo watch -x 'run --bin ch-writer' &
    cargo watch -x 'run --bin admin-api' &
    (cd dashboard && pnpm dev) &
    wait

# Run all Rust tests
test:
    cargo test --all

# Run linting: fmt + clippy + dashboard lint
lint:
    cargo fmt --all -- --check
    cargo clippy --all-targets --all-features -- -D warnings
    cd dashboard && pnpm lint && pnpm typecheck

# Send synthetic traffic
simulate:
    bash scripts/simulate_traffic.sh

# Load test with configurable rate
load-test *ARGS:
    cargo run --release --bin load-test -- {{ ARGS }}

# Build a Docker image locally
docker-build SERVICE:
    docker build -t truesight-{{ SERVICE }}:local -f crates/{{ SERVICE }}/Dockerfile .

# Remove build artifacts
clean:
    cargo clean
    rm -rf dashboard/dist sdks/web/dist
