# StudentSphere deployment architecture

Production is built only from an exact commit contained in `origin/master`.
The editable `dev` checkout is used only by the development frontend/API.
For the normal VS Code and terminal promotion steps, see
[`docs/DEPLOYMENT_WORKFLOW.md`](../docs/DEPLOYMENT_WORKFLOW.md).

## Runtime layout

```text
/home/nick/services/srp-server/srp/          editable development checkout
/home/nick/.config/srp/development.env       development secrets (0600)
/home/nick/.config/srp/production.env        production secrets (0600)
/home/nick/.local/share/srp-deployment/
  current -> releases/<commit>
  releases/<commit>/                         immutable Git release
  repository.git/                            deployment-only Git mirror
  shared/uploads/                            production runtime media
```

The development frontend runs on port 3000 and proxies `/api` to the
development PHP server on `127.0.0.1:3004`. Production nginx continues to own
`127.0.0.1:3001`; its API upstream is the production PHP server on port 3003.

## One-time development setup

After the protected production environment has been copied into place, run:

```bash
deploy/bootstrap-development.sh
```

It requests sudo only for MySQL database/user creation, generates independent
development credentials, clones database structure without production user
data, and copies only the non-personal `roles` and `tags` reference rows.

## Refresh development from production

For realistic feature testing, run:

```bash
deploy/refresh-development-from-production.sh
```

This is a destructive reset of the **development** database and a strictly
one-way, point-in-time copy from production. It retains users, communities,
forums, threads, posts, messages, and relationships, while removing active
sessions, rate-limit state, temporary 2FA codes, and Zoom credentials. Provider
API keys are absent from the development environment, so the clone cannot send
production email or call production integrations. Production is never modified
and development changes are never synchronized back.

Super admins can run the same refresh from **Account settings → Admin preview →
Refresh development data** on the development site. The control is omitted from
the production interface, and the API independently refuses to run unless it is using
the designated development environment, port, and database. A typed confirmation
is required, concurrent refreshes are blocked, and all development sessions are
cleared when the refresh finishes.

## Prepare a release without changing production

```bash
deploy/deploy-production.sh <master-commit-sha>
```

## Activate a verified release

Activation is intended for the protected GitHub deployment job after all CI
jobs pass:

```bash
deploy/deploy-production.sh <master-commit-sha> --activate
```

The script serializes deployments, builds from a clean mirror, installs locked
dependencies, runs backend/frontend checks, creates a production backup, swaps
the `current` symlink atomically, restarts only the production API, and rolls
back the symlink if the API health check fails. Database migrations are opt-in
with `SRP_RUN_MIGRATIONS=true` because schema rollback is not generally safe.

## Initial cutover

Do not activate until all of the following are true:

1. A separate development database and `/home/nick/.config/srp/development.env`
   exist.
2. Development API port 3004 passes its health check.
3. `/home/nick/.config/srp/production.env` is populated and mode 0600.
4. Production uploads have been synchronized into
   `/home/nick/.local/share/srp-deployment/shared/uploads`.
5. nginx has been prepared to serve
   `/home/nick/.local/share/srp-deployment/current/frontend/build`.
6. The current `dev` work has been reviewed and merged into `master`.
7. The pre-cutover backup has passed its checksum verification.

The initial nginx/API cutover is a separate controlled operation. Routine
deployments after that use the deployment script above.

## Automatic deployment watcher

`deploy-if-ready.sh` compares the public release to `origin/master`. When a new
commit exists, it queries the repository's GitHub Actions runs and activates the
commit only when the `CI` workflow for that exact SHA reports
`completed:success`. Missing, queued, running, failed, or cancelled CI runs are
fail-closed and leave production unchanged.
