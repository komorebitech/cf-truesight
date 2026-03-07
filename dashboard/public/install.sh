#!/bin/sh
set -e

# TrueSight CLI installer
# Usage: curl -fsSL https://truesight.cityflo.net/install.sh | sh

REPO="komorebitech/cf-truesight"
BINARY_NAME="truesight"
INSTALL_DIR="${HOME}/.local/bin"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)   OS_NAME="linux";;
    Darwin*)  OS_NAME="darwin";;
    *)        echo "Error: Unsupported OS: ${OS}"; exit 1;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64)   ARCH_NAME="x86_64";;
    arm64|aarch64)   ARCH_NAME="aarch64";;
    *)               echo "Error: Unsupported architecture: ${ARCH}"; exit 1;;
esac

ARTIFACT_NAME="${BINARY_NAME}-${OS_NAME}-${ARCH_NAME}"
echo "Detected: ${OS_NAME}/${ARCH_NAME}"

# Fetch latest release tag
echo "Fetching latest release..."
LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases?per_page=10" | \
    grep -o '"tag_name": *"cli-v[^"]*"' | head -1 | sed 's/"tag_name": *"//;s/"//')

if [ -z "${LATEST_TAG}" ]; then
    echo "Error: Could not find a CLI release. Check https://github.com/${REPO}/releases"
    exit 1
fi

echo "Latest version: ${LATEST_TAG}"

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${ARTIFACT_NAME}"

# Create install directory
mkdir -p "${INSTALL_DIR}"

# Download binary
echo "Downloading ${ARTIFACT_NAME}..."
curl -fsSL -o "${INSTALL_DIR}/${BINARY_NAME}" "${DOWNLOAD_URL}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo ""
echo "TrueSight CLI installed to ${INSTALL_DIR}/${BINARY_NAME}"

# Check if install dir is in PATH
case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
        echo ""
        echo "Add ${INSTALL_DIR} to your PATH:"
        echo ""
        echo "  export PATH=\"${INSTALL_DIR}:\${PATH}\""
        echo ""
        echo "Add that line to your ~/.bashrc, ~/.zshrc, or shell config file."
        ;;
esac

echo ""
echo "Get started:"
echo "  truesight config set api_url https://ts-admin.cityflo.net"
echo "  truesight auth login"
echo "  truesight projects list"
