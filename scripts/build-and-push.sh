#!/bin/bash
#
# Build and push container image for TSSC Backstage plugins
#
# Usage:
#   CONTAINER_REGISTRY=quay.io/<username> ./scripts/build-and-push.sh --release=1.9
#   CONTAINER_REGISTRY=quay.io/<username> ./scripts/build-and-push.sh --release=1.9 --push
#   CONTAINER_REGISTRY=quay.io/<username> ./scripts/build-and-push.sh --release=1.9 --push --dry-run
#

set -euo pipefail

# Default values
IMAGE_NAME="${IMAGE_NAME:-tssc-backstage-plugins}"
CONTAINER_ENGINE="${CONTAINER_ENGINE:-}"
PUSH=false
DRY_RUN=false
RELEASE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Build and push container image for TSSC Backstage plugins.

Required:
  --release=<version>    Release version tag (MAJOR.MINOR format, e.g., 1.9)

Options:
  --push                 Push image to registry after build (default: build only)
  -dry-run              Print commands without executing
  --help                 Show this help message

Environment Variables:
  CONTAINER_REGISTRY           (Required) Target container registry URL
  IMAGE_NAME                   Image name (default: tssc-backstage-plugins)
  REDHAT_REGISTRY_USERNAME     (Required for build) Red Hat registry username
  REDHAT_REGISTRY_PASSWORD     (Required for build) Red Hat registry password
  CONTAINER_ENGINE             Container engine to use (default: podman, fallback: docker)

Examples:
  # Build only (no push)
  CONTAINER_REGISTRY=<registry>/<username> ./scripts/build-and-push.sh --release=1.9

  # Build and push
  CONTAINER_REGISTRY=<registry>/<username> ./scripts/build-and-push.sh --release=1.9 --push

  # Dry run (print commands only)
  CONTAINER_REGISTRY=<registry>/<username> ./scripts/build-and-push.sh --release=1.9 --push --dry-run
EOF
}

# Parse command-line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
    --release=*)
      RELEASE="${1#*=}"
      shift
      ;;
    --push)
      PUSH=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help | -h)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
    esac
  done
}

# Validate release version format (MAJOR.MINOR)
validate_release_format() {
  local version="$1"
  if [[ ! "$version" =~ ^[0-9]+\.[0-9]+$ ]]; then
    log_error "Invalid release version format: '$version'"
    log_error "Expected MAJOR.MINOR format (e.g., 1.9)"
    exit 1
  fi
}

# Detect container engine
detect_container_engine() {
  if [[ -n "$CONTAINER_ENGINE" ]]; then
    if command -v "$CONTAINER_ENGINE" &>/dev/null; then
      log_info "Using specified container engine: $CONTAINER_ENGINE"
      return
    else
      log_error "Specified container engine '$CONTAINER_ENGINE' not found"
      exit 1
    fi
  fi

  if command -v podman &>/dev/null; then
    CONTAINER_ENGINE="podman"
    log_info "Detected container engine: podman"
  elif command -v docker &>/dev/null; then
    CONTAINER_ENGINE="docker"
    log_info "Detected container engine: docker"
  else
    log_error "No container engine found. Please install podman or docker."
    exit 1
  fi
}

# Execute or print command based on dry-run mode
run_cmd() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] $*"
  else
    log_info "Running: $*"
    "$@"
  fi
}

# Main build and push logic
main() {
  parse_args "$@"

  # Validate required arguments
  if [[ -z "$RELEASE" ]]; then
    log_error "Missing required argument: --release"
    usage
    exit 1
  fi

  validate_release_format "$RELEASE"

  # Validate required environment variables
  if [[ -z "${CONTAINER_REGISTRY:-}" ]]; then
    log_error "Missing required environment variable: CONTAINER_REGISTRY"
    exit 1
  fi

  if [[ -z "${REDHAT_REGISTRY_USERNAME:-}" ]]; then
    log_error "Missing required environment variable: REDHAT_REGISTRY_USERNAME"
    exit 1
  fi

  if [[ -z "${REDHAT_REGISTRY_PASSWORD:-}" ]]; then
    log_error "Missing required environment variable: REDHAT_REGISTRY_PASSWORD"
    exit 1
  fi

  # Detect container engine
  detect_container_engine

  # Construct image tag
  local image_tag="release-${RELEASE}"
  local full_image="${CONTAINER_REGISTRY}/${IMAGE_NAME}:${image_tag}"

  log_info "Building image: $full_image"

  # Authenticate to Red Hat registry
  log_info "Authenticating to Red Hat registry..."
  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY-RUN] echo \$REDHAT_REGISTRY_PASSWORD | $CONTAINER_ENGINE login registry.redhat.io -u \$REDHAT_REGISTRY_USERNAME --password-stdin"
  else
    echo "$REDHAT_REGISTRY_PASSWORD" | $CONTAINER_ENGINE login registry.redhat.io -u "$REDHAT_REGISTRY_USERNAME" --password-stdin
  fi

  # Build the image
  log_info "Building container image..."
  run_cmd $CONTAINER_ENGINE build -t "$full_image" -f Containerfile .

  log_info "Successfully built image: $full_image"

  # Push if requested
  if [[ "$PUSH" == true ]]; then
    log_info "Pushing image to registry..."
    run_cmd $CONTAINER_ENGINE push "$full_image"
    log_info "Successfully pushed image: $full_image"
  else
    log_info "Skipping push (use --push to push image to registry)"
  fi

  log_info "Done!"
}

main "$@"
