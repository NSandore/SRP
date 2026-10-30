#!/usr/bin/env bash
set -euo pipefail

environment=${1:-}
case "$environment" in
  development)
    document_root=${SRP_DEV_DOCUMENT_ROOT:-/home/nick/services/srp-server/srp/backend/public}
    listen_address=${SRP_DEV_API_LISTEN:-127.0.0.1:3004}
    env_file=${SRP_DEV_ENV_FILE:-/home/nick/.config/srp/development.env}
    ;;
  production)
    current_root=${SRP_PRODUCTION_CURRENT:-/home/nick/.local/share/srp-deployment/current}
    document_root="$current_root/backend/public"
    listen_address=${SRP_PRODUCTION_API_LISTEN:-127.0.0.1:3003}
    env_file=${SRP_PRODUCTION_ENV_FILE:-/home/nick/.config/srp/production.env}
    ;;
  *)
    echo "Usage: $0 development|production" >&2
    exit 64
    ;;
esac

if [[ ! -d "$document_root" ]]; then
  echo "API document root does not exist: $document_root" >&2
  exit 1
fi
if [[ ! -r "$env_file" ]]; then
  echo "Environment file is not readable: $env_file" >&2
  exit 1
fi

export SRP_ENV_FILE="$env_file"
exec /usr/bin/php -S "$listen_address" -t "$document_root"
