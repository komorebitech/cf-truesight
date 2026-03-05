# ── Stage 1: Build ────────────────────────────────────────────────────
FROM rust:1.93-bookworm AS builder

RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests
COPY Cargo.toml Cargo.lock ./
COPY crates/common/Cargo.toml crates/common/Cargo.toml
COPY crates/admin-api/Cargo.toml crates/admin-api/Cargo.toml

# Create dummy source files so Cargo can resolve the workspace
RUN mkdir -p crates/common/src && echo "pub fn _dummy() {}" > crates/common/src/lib.rs
RUN mkdir -p crates/admin-api/src && echo "fn main() {}" > crates/admin-api/src/main.rs

# Pre-build dependencies (cached layer)
RUN cargo build --release --package admin-api || true

# Copy real source code
COPY crates/common crates/common
COPY crates/admin-api crates/admin-api
COPY migrations migrations

# Touch source files to invalidate the dummy build cache
RUN touch crates/common/src/lib.rs crates/admin-api/src/main.rs

# Build the final binary
RUN cargo build --release --package admin-api

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ca-certificates curl perl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/admin-api ./admin-api
COPY scripts/migrate_clickhouse.sh ./scripts/migrate_clickhouse.sh
COPY clickhouse-migrations ./clickhouse-migrations
COPY crates/admin-api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh ./scripts/migrate_clickhouse.sh

EXPOSE 8081

CMD ["./entrypoint.sh"]
