# StudentSphere branch and deployment workflow

StudentSphere has two permanent branches with different responsibilities:

- `dev` is the integration branch used by the editable development checkout.
- `master` is the production release branch.

Saving a file updates the local development site through hot reload. A save does
not create a commit, push to GitHub, or change production.

## Send committed work to `dev`

In VS Code, confirm the current branch is `dev`, commit the work, and click
**Sync Changes**. Sync pulls remote changes and pushes the local commits.

The equivalent terminal workflow is:

```bash
cd /home/nick/services/srp-server/srp
git switch dev
git status
git push origin dev
```

Pushing `dev` backs up and shares the work through GitHub. It does not deploy
the public website.

## Promote the current `dev` branch to production

Only do this after the intended work is committed and `dev` has been pushed:

```bash
cd /home/nick/services/srp-server/srp
git switch master
git pull --ff-only origin master
git merge dev
git push origin master
git switch dev
```

If `git status` reports uncommitted changes, or `git merge dev` reports a
conflict, stop and resolve the issue before pushing `master`.

Pushing `master` starts GitHub CI. The server deployment watcher checks roughly
every five minutes and deploys only when CI has completed successfully for that
exact `master` commit. It then builds an immutable release, backs up production,
switches the active release atomically, and performs health checks.

## What production promotion does not do

- It does not copy the development database to production.
- It does not copy development uploads to production.
- It does not deploy uncommitted or unpushed files.
- It does not deploy merely because **Sync Changes** was clicked on `dev`.

Development database refreshes flow in the opposite direction—from production
to development—and are handled separately by the protected super-admin control
or `deploy/refresh-development-from-production.sh`.

## Quick reference

| Request | Branch updated | Public production changes? |
|---|---|---|
| Save a file | None | No |
| Commit | Local current branch | No |
| Sync/push `dev` | `origin/dev` | No |
| Merge `dev` into `master` and push | `origin/master` | After CI passes and the watcher deploys |

