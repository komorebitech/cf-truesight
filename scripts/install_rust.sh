#!/usr/bin/env bash
set -euo pipefail

RUST_VERSION="1.93.1"

if command -v rustup &>/dev/null; then
    echo "rustup is already installed: $(rustup --version)"
else
    echo "Installing rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain "$RUST_VERSION"
    source "$HOME/.cargo/env"
    echo "rustup installed successfully."
fi

echo "Setting default toolchain to $RUST_VERSION..."
rustup default "$RUST_VERSION"

echo "Installing rustfmt component..."
rustup component add rustfmt

echo "Installing clippy component..."
rustup component add clippy

echo "---"
echo "Rust $RUST_VERSION is ready with rustfmt and clippy."
rustc --version
cargo --version
