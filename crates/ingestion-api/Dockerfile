# ── Stage 1: Build ────────────────────────────────────────────────────
FROM rust:1.93-bookworm AS builder

RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests
COPY Cargo.toml Cargo.lock ./
COPY crates/common/Cargo.toml crates/common/Cargo.toml
COPY crates/ingestion-api/Cargo.toml crates/ingestion-api/Cargo.toml

# Create dummy source files so Cargo can resolve the workspace
RUN mkdir -p crates/common/src && echo "pub fn _dummy() {}" > crates/common/src/lib.rs
RUN mkdir -p crates/ingestion-api/src && echo "fn main() {}" > crates/ingestion-api/src/main.rs

# Pre-build dependencies (cached layer)
RUN cargo build --release --package ingestion-api || true

# Copy real source code
COPY crates/common crates/common
COPY crates/ingestion-api crates/ingestion-api

# Touch source files to invalidate the dummy build cache
RUN touch crates/common/src/lib.rs crates/ingestion-api/src/main.rs

# Build the final binary
RUN cargo build --release --package ingestion-api

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user.
RUN groupadd -g 1001 appuser \
    && useradd -u 1001 -g appuser -s /bin/false -M appuser

WORKDIR /app

COPY --from=builder /app/target/release/ingestion-api ./ingestion-api

USER appuser

EXPOSE 8080

CMD ["./ingestion-api"]
