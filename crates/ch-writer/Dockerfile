# ---- Builder stage ----
FROM rust:1.93.1-slim AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests first for layer caching.
COPY Cargo.toml Cargo.lock ./
COPY crates/common/Cargo.toml crates/common/Cargo.toml
COPY crates/ch-writer/Cargo.toml crates/ch-writer/Cargo.toml

# Create stub source files so cargo can resolve the dependency graph and cache
# downloaded crates.
RUN mkdir -p crates/common/src && echo "pub fn _stub() {}" > crates/common/src/lib.rs \
    && mkdir -p crates/ch-writer/src && echo "fn main() {}" > crates/ch-writer/src/main.rs

RUN cargo build --release --bin ch-writer || true

# Copy real source code.
COPY crates/common/ crates/common/
COPY crates/ch-writer/ crates/ch-writer/

# Touch sources to invalidate the stub build.
RUN touch crates/common/src/lib.rs crates/ch-writer/src/main.rs

RUN cargo build --release --bin ch-writer

# ---- Runtime stage ----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Create a non-root user.
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid 1001 --create-home appuser

WORKDIR /home/appuser

COPY --from=builder /app/target/release/ch-writer ./ch-writer

RUN chown appuser:appuser ./ch-writer

USER appuser

EXPOSE 9090

CMD ["./ch-writer"]
