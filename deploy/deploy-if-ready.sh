#!/usr/bin/env bash
set -euo pipefail

github_repository=${SRP_GITHUB_REPOSITORY:-NSandore/SRP}
deploy_branch=${SRP_DEPLOY_BRANCH:-master}
remote_url=${SRP_DEPLOY_REMOTE:-https://github.com/NSandore/SRP.git}
deployment_root=${SRP_DEPLOYMENT_ROOT:-/home/nick/.local/share/srp-deployment}
current_link="$deployment_root/current"

remote_sha=$(git ls-remote "$remote_url" "refs/heads/$deploy_branch" | awk '{print $1}')
if [[ ! "$remote_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve origin/$deploy_branch." >&2
  exit 1
fi

current_sha=''
if [[ -r "$current_link/RELEASE_COMMIT" ]]; then
  current_sha=$(cat "$current_link/RELEASE_COMMIT")
fi
if [[ "$current_sha" == "$remote_sha" ]]; then
  exit 0
fi

run_state=$(
  curl -fsS --max-time 20 \
    -H 'Accept: application/vnd.github+json' \
    -H 'User-Agent: StudentSphere-deployment-watcher' \
    "https://api.github.com/repos/$github_repository/actions/runs?head_sha=$remote_sha&event=push&per_page=10" \
  | php -r '
      $payload = json_decode(stream_get_contents(STDIN), true);
      if (!is_array($payload)) { exit(2); }
      foreach (($payload["workflow_runs"] ?? []) as $run) {
          if (($run["name"] ?? "") !== "CI") { continue; }
          if (($run["head_sha"] ?? "") !== $argv[1]) { continue; }
          $status = $run["status"] ?? "unknown";
          $conclusion = $run["conclusion"] ?? "pending";
          echo $status . ":" . $conclusion;
          exit(0);
      }
      echo "missing:missing";
    ' "$remote_sha"
)

if [[ "$run_state" != 'completed:success' ]]; then
  echo "Commit $remote_sha is not deployable yet (CI $run_state)."
  exit 0
fi

deploy_script="$current_link/deploy/deploy-production.sh"
if [[ ! -x "$deploy_script" ]]; then
  echo "Current release has no executable deployment script: $deploy_script" >&2
  exit 1
fi

echo "Deploying CI-approved origin/$deploy_branch commit $remote_sha"
"$deploy_script" "$remote_sha" --activate
