#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <commit-sha> [--activate]" >&2
  echo "Without --activate, builds and verifies an immutable release only." >&2
}

requested_sha=${1:-}
mode=${2:-}
if [[ ! "$requested_sha" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  usage
  exit 64
fi
if [[ -n "$mode" && "$mode" != '--activate' ]]; then
  usage
  exit 64
fi

deployment_root=${SRP_DEPLOYMENT_ROOT:-/home/nick/.local/share/srp-deployment}
release_root="$deployment_root/releases"
shared_root="$deployment_root/shared"
mirror="$deployment_root/repository.git"
current_link="$deployment_root/current"
remote_url=${SRP_DEPLOY_REMOTE:-https://github.com/NSandore/SRP.git}
deploy_branch=${SRP_DEPLOY_BRANCH:-master}
production_env=${SRP_PRODUCTION_ENV_FILE:-/home/nick/.config/srp/production.env}
backup_root=${SRP_BACKUP_DIR:-/home/nick/services/backups/srp/deployments}
lock_file="$deployment_root/deploy.lock"

install -d -m 0750 "$deployment_root" "$release_root" "$shared_root" "$shared_root/logs"
install -d -m 0700 "$backup_root"
exec 9>"$lock_file"
flock -n 9 || { echo "Another StudentSphere deployment is running." >&2; exit 1; }

if [[ ! -d "$mirror" ]]; then
  git clone --mirror "$remote_url" "$mirror"
fi
git --git-dir="$mirror" fetch --prune origin "+refs/heads/$deploy_branch:refs/remotes/origin/$deploy_branch"

commit=$(git --git-dir="$mirror" rev-parse "${requested_sha}^{commit}")
branch_ref="refs/remotes/origin/$deploy_branch"
if ! git --git-dir="$mirror" merge-base --is-ancestor "$commit" "$branch_ref"; then
  echo "Commit $commit is not contained in origin/$deploy_branch." >&2
  exit 1
fi

short_sha=${commit:0:12}
release_dir="$release_root/$short_sha"
if [[ -e "$release_dir" ]]; then
  if [[ ! -f "$release_dir/RELEASE_COMMIT" ]] || [[ "$(cat "$release_dir/RELEASE_COMMIT")" != "$commit" ]]; then
    echo "Existing release does not match commit $commit: $release_dir" >&2
    exit 1
  fi
  echo "Using previously verified release: $release_dir"
else
  staging_dir="$release_root/.staging-$short_sha-$$"
  cleanup() {
    if [[ -d "$staging_dir" ]]; then
      rm -rf -- "$staging_dir"
    fi
  }
  trap cleanup EXIT
  install -d -m 0750 "$staging_dir"
  git --git-dir="$mirror" archive "$commit" | tar -x -C "$staging_dir"

  printf '%s\n' "$commit" > "$staging_dir/RELEASE_COMMIT"
  printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$staging_dir/RELEASE_BUILT_AT"

# Historical snapshots tracked generated dependencies. Never trust those in a
# release: reconstruct the backend exactly from composer.lock.
  rm -rf -- "$staging_dir/backend/vendor"
  composer install \
    --working-dir="$staging_dir/backend" \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader

  find "$staging_dir/backend" -name '*.php' -not -path '*/vendor/*' -print0 \
    | xargs -0 -n1 -P4 php -l > /dev/null
  php "$staging_dir/backend/tests/permissions_test.php"
  php "$staging_dir/backend/tests/test_accounts_test.php"
  for test_file in "$staging_dir"/backend/tests/institution_*_test.php; do
    php "$test_file"
  done

  (
    cd "$staging_dir/frontend"
    npm ci --legacy-peer-deps
    npm test -- --watchAll=false --runInBand
    CI=false GENERATE_SOURCEMAP=false npm run build
  )

  if [[ ! -f "$staging_dir/frontend/build/index.html" ]]; then
    echo "Frontend build did not produce index.html." >&2
    exit 1
  fi

# The build output is the production artifact; development dependencies are
# deliberately excluded from immutable releases.
  rm -rf -- "$staging_dir/frontend/node_modules"

  mv "$staging_dir" "$release_dir"
  trap - EXIT
  echo "Prepared release: $release_dir"
fi

if [[ "$mode" != '--activate' ]]; then
  echo "Release was verified but not activated."
  exit 0
fi

if [[ ! -r "$production_env" ]]; then
  echo "Production environment is not readable: $production_env" >&2
  exit 1
fi
if [[ ! -d "$shared_root/uploads" ]]; then
  echo "Shared production uploads are missing: $shared_root/uploads" >&2
  exit 1
fi

ln -sfn "$production_env" "$release_dir/.env"
ln -sfn "$shared_root/uploads" "$release_dir/uploads"

previous_target=''
if [[ -L "$current_link" ]]; then
  previous_target=$(readlink -f "$current_link")
fi

SRP_ENV_FILE="$production_env" SRP_BACKUP_DIR="$backup_root" \
  php "$release_dir/backend/scripts/backup_production.php"

if [[ "${SRP_RUN_MIGRATIONS:-false}" == 'true' ]]; then
  SRP_ENV_FILE="$production_env" php "$release_dir/backend/scripts/run_migrations.php"
else
  required_migrations=(
    20261031_account_deletion.sql
    20261102_content_provenance.sql
    20261102_resolution_feedback.sql
    20261105_search_gap_signals.sql
  )
  for required_migration in "${required_migrations[@]}"; do
    if [[ -f "$release_dir/backend/migrations/$required_migration" ]]; then
      SRP_ENV_FILE="$production_env" php "$release_dir/backend/scripts/run_migrations.php" \
        "$required_migration"
    fi
  done
fi

next_link="$deployment_root/.current-$short_sha"
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

if pm2 describe srp-api-production > /dev/null 2>&1; then
  pm2 restart srp-api-production --update-env
else
  pm2 start "$current_link/deploy/run-api.sh" \
    --name srp-api-production \
    --interpreter /usr/bin/bash \
    --cwd "$deployment_root" \
    -- production
fi

health_ok=false
for _ in 1 2 3 4 5; do
  if curl -fsS --max-time 5 http://127.0.0.1:3003/index.php \
      | php -r '$d=json_decode(stream_get_contents(STDIN), true); exit(($d["status"] ?? null) === "ok" ? 0 : 1);'; then
    health_ok=true
    break
  fi
  sleep 1
done

if [[ "$health_ok" != 'true' ]]; then
  echo "New release failed its API health check; rolling back." >&2
  if [[ -n "$previous_target" && -d "$previous_target" ]]; then
    rollback_link="$deployment_root/.rollback-$short_sha"
    ln -s "$previous_target" "$rollback_link"
    mv -Tf "$rollback_link" "$current_link"
    pm2 restart srp-api-production --update-env
  fi
  exit 1
fi

public_health_url=${SRP_PUBLIC_HEALTH_URL:-https://thestudentsphere.com/api/}
public_health_ok=false
for _ in 1 2 3 4 5; do
  if curl -fsS --max-time 8 "$public_health_url" \
      | php -r '$d=json_decode(stream_get_contents(STDIN), true); exit(($d["status"] ?? null) === "ok" ? 0 : 1);'; then
    public_health_ok=true
    break
  fi
  sleep 1
done
if [[ "$public_health_ok" != 'true' ]]; then
  echo "New release failed its public health check; rolling back." >&2
  if [[ -n "$previous_target" && -d "$previous_target" ]]; then
    rollback_link="$deployment_root/.rollback-$short_sha"
    ln -s "$previous_target" "$rollback_link"
    mv -Tf "$rollback_link" "$current_link"
    pm2 restart srp-api-production --update-env
  fi
  exit 1
fi

account_deletion_marker='# StudentSphere account deletion purge'
account_deletion_cron="17 3 * * * SRP_ENV_FILE=$production_env /usr/bin/php $current_link/backend/scripts/purge_deleted_accounts.php >> $shared_root/logs/account-deletion.log 2>&1"
cron_snapshot=$(mktemp)
trap 'rm -f -- "$cron_snapshot"' EXIT
crontab -l > "$cron_snapshot" 2>/dev/null || true
if ! grep -Fq "$account_deletion_marker" "$cron_snapshot"; then
  printf '\n%s\n%s\n' "$account_deletion_marker" "$account_deletion_cron" >> "$cron_snapshot"
  crontab "$cron_snapshot"
fi
rm -f -- "$cron_snapshot"
trap - EXIT

pm2 save
echo "Activated release: $release_dir"
