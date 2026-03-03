# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM rust:1.93.1-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install cargo-chef for efficient Docker layer caching.
RUN cargo install cargo-chef --locked

WORKDIR /app

# --- Chef: prepare the recipe (dependency graph) ---
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- Chef: cook dependencies (cached layer) ---
RUN cargo chef cook --release --recipe-path recipe.json --bin ingestion-api

# --- Build the actual binary ---
RUN cargo build --release --bin ingestion-api

# ---------------------------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------------------------
FROM alpine:latest AS runtime

RUN apk add --no-cache libgcc libstdc++ libpq ca-certificates curl

# Create a non-root user.
RUN addgroup -g 1001 appuser \
    && adduser -u 1001 -G appuser -s /bin/false -D appuser

WORKDIR /app

# Copy the compiled binary from the builder stage.
COPY --from=builder /app/target/release/ingestion-api ./ingestion-api

# Switch to non-root user.
USER appuser

EXPOSE 8080

CMD ["./ingestion-api"]
