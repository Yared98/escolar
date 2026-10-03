# Stage 1: Build Rust binary
# Pin to bookworm so the linked glibc matches the runtime image (rust:latest
# currently builds against newer glibc than debian:bookworm-slim).
FROM rust:bookworm AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy source code and migrations
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

# Build release binary with locked dependencies
RUN cargo build --release --locked

# Stage 2: Runtime image (same Debian major as the builder)
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/escolar-backend /app/escolar-backend
COPY --from=builder /usr/src/app/migrations /app/migrations

ENV PORT=8000
ENV DATABASE_URL=postgres://escolar_app:escolar_password@postgres:5432/escolar_db
ENV JWT_SECRET=super_secret_escolar_jwt_key_2026_change_in_production

EXPOSE 8000

CMD ["/app/escolar-backend"]
