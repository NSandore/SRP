# StudentSphere Production Readiness Audit

**Audit date:** August 3, 2026  
**Repository:** `/home/nick/services/srp-server/srp`  
**Reviewed revision:** `a8aa2a9` on branch `dev`, plus the complete current working tree  
**Recommendation:** **NO-GO**

## Executive summary

StudentSphere is **not ready for a public production deployment or mobile-store release**. The application builds, the first-party PHP files parse, the existing PHP permission test passes, and the live database passed basic engine, table, foreign-key, and orphan checks. Those positive results are outweighed by release-blocking security, data-integrity, functionality, deployment, and validation failures.

The most serious blockers are:

1. Many API endpoints do not authenticate the caller or authorize access to the supplied user/resource ID. This permits profile takeover, private-message disclosure, connection manipulation, voting, and other cross-user actions.
2. Verification uploads can be served inline under an attacker-controlled MIME type on the application origin, creating a stored-content/XSS risk for reviewers.
3. Development-mode authentication and onboarding bypasses are enabled in the active environment.
4. several active credentials are unchanged from values previously committed to Git history.
5. session revocation, password-reset revocation, and role revocation are not enforced consistently.
6. production assets point at a private, plain-HTTP API address, while the running deployment has no verified public HTTPS configuration.
7. the live service is running from a large, dirty `dev` working tree, and the separately served frontend artifact is stale.
8. administrator event/poll management and the right-rail poll experience are partly browser-local and can lose, duplicate, or falsely acknowledge data.
9. frontend tests and type checks fail; strict frontend builds fail; Expo Doctor fails; dependency audits report critical/high vulnerabilities across the web, mobile, and PHP dependency trees.
10. there is no verified current backup/restore process, migrations have drifted from the migration ledger, and runtime requests can create or alter schema.

This report is the only file intentionally created by the audit. No application source, configuration, database data, or deployment was modified.

## Scope and method

The review covered:

- the current Git branch, recent commits, tracked modifications, deletions, and untracked files;
- frontend, mobile, PHP API, database schema/data integrity, authentication, authorization, uploads, moderation, and notification workflows;
- active environment configuration, Nginx, PM2 processes, PHP-FPM permissions, scheduled jobs, exposed listeners, and the currently served frontend;
- build, lint, test, type-check, dependency, Composer, PHP syntax, Git whitespace, Expo, and database validation commands;
- recent Newsroom/news rail, UI, title-wrapping, upload, content-limit, translation, and forum/thread changes.

The review was read-only except for normal generated build output and this report. Generated `mobile/dist` output was moved out of the repository after validation. No destructive security testing, state-changing endpoint testing, production deployment, credential use, or restore operation was performed.

## Release-state findings

### P0 — Release blockers

#### P0-1: Systemic missing API authentication and object-level authorization

Numerous endpoints trust actor IDs, user IDs, or resource IDs supplied by the request without proving that the authenticated session owns or may act on them.

Representative evidence:

- `backend/public/update_profile.php:22-39,52-99` accepts an arbitrary `user_id` and updates profile fields without a session ownership check.
- `backend/public/upload_avatar.php:15-23,54-96` and `backend/public/upload_banner.php:15-23,56-103` let a caller replace media for a supplied user ID.
- `backend/public/fetch_conversations.php:8-40` exposes conversation previews for a supplied user ID.
- `backend/public/fetch_messages.php:8-56` accepts conversation/user IDs, returns messages without a participant check, and marks them read.
- `backend/public/accept_connection.php:9-82` can accept a connection by ID or user pair without authenticating the intended recipient.
- `backend/public/request_connection.php:14-62`, `follow_user.php:16-45`, `save_post.php:9-28`, `update_interests.php:12-51`, and the forum/thread/post vote endpoints trust request-supplied actor IDs.
- `backend/public/approve_group_question.php:8-51` lacks a reliable server-derived permission check.
- Legacy registration/onboarding endpoints described in P0-6 compound this issue.

**Impact:** unauthenticated or incorrectly authorized users can modify another account, read private information, manipulate relationships/content, or act as another user. This is a release-blocking broken-access-control condition.

**Required fix:**

1. Add a deny-by-default API bootstrap that authenticates every private endpoint.
2. Derive the actor exclusively from the validated server-side session/token, never from request JSON.
3. Add explicit resource ownership, membership, community scope, and capability checks.
4. Inventory every endpoint and classify it as public-read, authenticated-read, owner-only, moderator, ambassador, staff, or super-admin.
5. Add negative integration tests for unauthenticated, wrong-user, wrong-community, demoted, revoked-session, and role-boundary cases.

#### P0-2: Verification upload can become same-origin stored active content

- `backend/public/upload_verification_document.php:43-68` validates only the filename extension and permits JPG/JPEG/PNG/PDF without checking file signatures, decoded image validity, actual MIME type, or size.
- `backend/public/serve_upload.php:71-80` detects the stored file's actual MIME type and serves it inline from the application origin without forcing an attachment, `X-Content-Type-Options: nosniff`, or a sandboxing CSP.
- `serve_upload.php:79` marks even government-ID/selfie responses `public` and cacheable for seven days.

An active-content file renamed with an allowed image extension can therefore be stored and later served inline as its detected active MIME type to the account owner or super-admin reviewer.

**Required fix:** store verification material outside the web root; validate magic bytes and decoded content; re-encode accepted images; cap bytes, dimensions, and PDF complexity; serve downloads as attachments or from an isolated non-cookie origin; add `nosniff` and a restrictive/sandboxed CSP; add malware scanning and retention/deletion controls.

#### P0-3: Development-mode authentication bypasses are active

- `.env:22` enables `SRP_DEV_MODE`.
- `backend/db_connection.php:3-5,42-50` defaults the constant to an enabled state if production configuration is absent.
- `.env:3` enables mailer debugging.
- `backend/public/login_user.php:38,48-69` and `backend/public/init_register.php:42-45` use development-mode verification bypasses.
- `backend/public/complete_registration.php:18-49` permits development-mode verification/onboarding bypasses.

Documentation currently states that development mode is disabled, so the deployed environment and operational documentation disagree.

**Required fix:** make all security-affecting development flags fail closed; remove bypass branches from production builds or require a non-production environment assertion; validate configuration at process startup; fail deployment if debug/dev mode is on.

#### P0-4: Committed credentials remain active and local secret permissions are broad

A history-only comparison, performed without printing secret values, found that the current MailerSend, Zoom, and Pledge credentials match values previously committed in `.env`. `/home/nick/services/srp-server/GAPS.md:13-20` also records credential rotation/history cleanup as unfinished. The local `.env` and `frontend/.env` files are mode `0664`.

**Impact:** anyone who has received a repository copy or retained history may possess active third-party credentials.

**Required fix:** immediately revoke and rotate every credential ever committed; inspect provider access logs; remove secrets from Git history; use a production secret manager; restrict files to the service identity (normally `0600`); add secret scanning to pre-commit and CI. Do not consider deleting the current `.env` from the latest commit sufficient.

#### P0-5: Session transport and revocation are not production-safe

- `backend/session_bootstrap.php:7-14` accepts a session ID from `X-Session-Id` or the `session_id` URL query parameter.
- `mobile/lib/api/client.ts:15-23` places the session ID in both the header and every request URL, exposing it to logs, history, diagnostics, and analytics.
- PHP `session.use_strict_mode` is disabled, `backend/public/init_register.php:160` authenticates an existing session without regenerating its ID, and `backend/public/fetch_sessions.php:27` exposes raw bearer session IDs to browser JavaScript.
- `backend/public/revoke_session.php:25-39` marks a database row revoked, but normal private endpoints do not consult that row.
- `backend/public/check_session.php:41-68` is the only routine that consistently checks revocation/idle timeout; direct API calls remain possible without first calling it.
- when a session record is absent, `check_session.php:54,71-82` accepts it and recreates the database record instead of failing closed.
- `backend/public/logout.php:1-9` destroys only the current PHP session and does not revoke the database session record.
- `backend/public/reset_password.php:118-126` changes the password without revoking existing sessions.
- most privileged endpoints trust the role captured in `$_SESSION`, allowing stale authority after a role change.
- the active HTTP response sets no `Secure` cookie attribute because the service is not behind verified HTTPS.

**Required fix:** use one production session/token transport, never a URL parameter; require HTTPS; rotate identifiers on login/elevation; centralize session, timeout, revocation, and current-role checks in every private request; revoke all sessions after password reset or security changes; make logout revoke server state; test demotion and revocation against direct API calls.

#### P0-6: Legacy registration and verification paths bypass the intended controls

- `backend/public/register_user.php:65-157` exposes a legacy signup flow without the intended email-verification and password-policy protections; its `updateInterests` branch at `:15-62` accepts an arbitrary user ID.
- `backend/public/complete_registration.php:14-101` can modify a supplied user without proving session ownership.
- `backend/public/verify_user.php:21-68` verifies by user ID and a non-expiring six-digit code without rate limiting.
- `backend/public/resend_verification.php:23-66` can rotate another user's code and trigger email without rate limiting.

**Required fix:** remove or disable obsolete public flows, route all registration through one hardened workflow, hash/expire/scope verification challenges, add attempt and resend limits, and bind every state transition to the initiating session and account.

#### P0-7: Upload and sensitive-file permissions are incompatible with production

All repository upload directories, including `uploads/verification`, are mode `0775` and owned by `nick:nick`. Verification files are also mode `0775`. This makes sensitive identity material readable/traversable by local users and, under the intended PHP-FPM deployment, is not writable by the PHP-FPM identity `www-data:www-data` (`/etc/php/8.3/fpm/pool.d/www.conf:28-29`).

Upload requests will therefore fail when moved from the current built-in PHP server to the configured PHP-FPM pool. The HTMLPurifier cache also is not writable by PHP-FPM, causing `backend/includes/sanitize.php:26-35` to disable the serializer cache.

**Required fix:** move uploads to private managed storage; use a dedicated least-privileged service account; grant only required write access; use `0700` directories and `0600` sensitive files where appropriate; encrypt verification data at rest; define retention/deletion/audit policies; verify upload and purifier behavior under the exact production identity.

#### P0-8: No viable, immutable HTTPS production configuration

- `frontend/.env:1` sets `REACT_APP_API_BASE=http://10.0.0.251:3001`; the value was confirmed in the generated production bundle.
- `frontend/src/utils/apiBase.js:2-6`, `frontend/src/utils/uploads.js:3-8`, `frontend/src/components/VerificationReview.js:31-38`, and `frontend/src/components/AccountSettings.js:218-223` use that base.
- `mobile/lib/config.ts:1-12` defaults native clients to `http://10.0.0.251:3001`.
- the application environment also uses plain-HTTP/private base URLs, with an inconsistent frontend port.
- `/home/nick/.config/srp/nginx.conf:31-50` listens on HTTP port 3001 with `server_name _`; it has no TLS termination or complete security-header policy.
- the live root/API responses expose `X-Powered-By` and lack HSTS, CSP, `nosniff`, frame, and referrer protections.

Outside the private network, assets and API calls fail. From an HTTPS page, browsers block the HTTP calls as mixed content.

**Required fix:** establish a verified public domain and HTTPS endpoint; configure exact origins; use relative/same-origin URLs where possible; provision and test certificates; add HSTS after HTTPS verification; add CSP, `nosniff`, frame-ancestor, referrer, and permissions policies; rebuild immutable web/mobile artifacts with production environment validation.

#### P0-9: The active release is a dirty development checkout and the served web artifact is stale

At audit time:

- branch `dev` at `a8aa2a9` matched `origin/dev`;
- the working tree contained 85 tracked changes (83 modifications and two deleted cache files), 28 untracked paths, approximately 13,093 additions and 2,255 deletions;
- a tracked runtime log, `backend/scripts/event_reminders.log`, accounted for approximately 7,718 added lines;
- new Newsroom endpoints, migration, importer, translations, content-limit helper, and tests were untracked;
- saving PHP in this checkout changes the running API;
- `/var/www/srp-frontend` contained a July 5 artifact whose asset hashes and `React App` title differ from the current source build;
- root-level checked-in static output also contains old hashes/title.

A Git-based deployment would omit untracked application/migration files. A filesystem copy could include logs, local configuration, and unfinished work. The running state cannot be reproduced or rolled back reliably.

**Required fix:** stop serving a developer checkout; commit and review an intentional release; remove runtime artifacts from source control; produce versioned immutable backend/frontend/mobile artifacts in CI; deploy by digest/tag; record migrations; add rollback and smoke-test procedures; never deploy with an unclean tree.

#### P0-10: Event/poll management and the rail can lose, duplicate, or fabricate data

- `frontend/src/components/EventManagement.js:57-65,318-325` treats browser `localStorage` as the management index.
- it creates durable events/polls at `:696-753` but only stores its management copy locally at `:815-819`.
- delete calls the backend only for events at `:542-565`; poll and announcement deletion only changes local state.
- editing polls/announcements calls create again at `:730-753,782-804`, causing duplicate/orphan records.
- remote announcements are denied controls at `:1410-1418`.
- poll audience selection is required at `:689-695` but omitted from the poll API request at `:730-742`.
- `frontend/src/widgets/RightRail.tsx:334-350` never fetches polls; `:262-279,609-623` stores poll state locally; `:656-678` thanks the user without recording a server vote.
- hardcoded sample events and polls at `RightRail.tsx:70-133` are shown on empty/error states at `:557-572` without being identified as demo content.

**Required fix:** make server APIs the source of truth for list/create/update/delete; enforce audience policy server-side; use real poll option IDs and `vote_poll.php`; return truthful loading/empty/error states; gate fixtures behind an explicit development-only build flag; add cross-browser and failure-path integration tests.

#### P0-11: Automated quality gates are failing or missing

The frontend's tests and type checks do not run successfully, a strict build fails, Expo Doctor fails, and the CI workflow omits the majority of the validation performed in this audit. See the validation matrix below.

`/.github/workflows/ci.yml:19-60` runs PHP lint, one permissions test, a frontend build with `CI=false`, and mobile lint/type-check. It does not gate on frontend tests, strict lint, frontend type-checking, dependency audits, integration/authorization tests, migrations, Expo Doctor/export/signed builds, deployment smoke tests, or rollback verification.

**Required fix:** repair all failing commands; replace placeholder tests with behavior/permission tests; fail CI on warnings at an agreed threshold; add API/database integration tests and migration tests; add dependency/secret/static analysis; require a clean immutable release artifact.

#### P0-12: No verified backup/restore process and uncontrolled schema drift

- no current StudentSphere database/upload backup job or restore drill was found;
- MySQL binary logging is enabled with finite retention, but a binlog is not a complete, independently verified backup;
- the `schema_migrations` table records only three migrations while later migration files exist and parts of their schema are already present;
- `backend/scripts/run_migrations.php:3-9,27-82` is forward-only, suppresses selected duplicate/already-exists failures, and has no checksum, transaction policy, dry-run, or rollback;
- schema is created/altered during requests in `backend/includes/onboarding.php:7-93`, `backend/includes/newsroom.php:14-49`, `backend/includes/rate_limit.php:12-25`, `backend/tag_helpers.php:87-137`, and `backend/reporting_utils.php:8-43`;
- development, mobile, and the production-like service share the same checkout/API/database.

**Required fix:** create encrypted off-host database and upload backups; capture them consistently; define retention; perform and record a restore drill; run migrations on a production clone; add ordered checksummed migrations; remove runtime DDL and DDL privileges from the application account; isolate development, staging, and production.

### P1 — High-priority security, integrity, and functionality issues

#### P1-1: Moderation reports permit one-user mass censorship

- `backend/public/submit_report.php:51-58` assigns high severity solely from the reporter-selected reason code.
- `submit_report.php:89-101` immediately hides content for that severity.
- there is no report rate limit or duplicate-report constraint.
- `backend/public/resolve_report.php:91-95,192-205` can allow a broadly authorized community moderator/ambassador to structurally delete entire forums and their content.
- `resolve_report.php:155-188` can unhide an item on retain/dismiss without accounting for other pending reports.

**Required fix:** do not auto-hide based on one user's self-selected reason; add deduplication, throttling, trust/risk thresholds, audit trails, aggregate report state, appeal/recovery, and a separate narrow permission for destructive structural deletion.

#### P1-2: Ambassador authorization is over-broad

`backend/public/delete_event.php:47-65` treats `is_ambassador` as a platform-wide boolean. Any ambassador bypasses ownership/community checks and can delete any event.

**Required fix:** authorize against the event's community and the ambassador's active assignment; reserve global actions for explicit staff/super-admin capabilities; add cross-community negative tests. Apply the same scope review to all ambassador/moderator endpoints.

#### P1-3: Vote and activity counters are already inconsistent

Database checks found:

- six post vote-counter mismatches;
- three thread vote-counter mismatches;
- three forum vote-counter mismatches;
- three thread reply-count mismatches.

`post_votes`, `thread_votes`, and `forum_votes` lack unique `(item_id, user_id)` constraints. `backend/public/vote_post.php:19-89` and `vote_thread.php:18-55` perform read-then-write operations while separately maintaining counters. `create_post.php:57-69`, `create_reply.php:66-79`, and `delete_post.php:62-64` do not consistently maintain reply/activity fields.

**Required fix:** add unique constraints, atomic upsert/locking, and transactions; calculate counts from one authoritative source or reconcile them transactionally; repair existing drift with a reviewed migration; add concurrency and invariant tests.

#### P1-4: Message conversation IDs are race-prone and message reads are under-indexed

`backend/public/send_message.php:99-127` uses `MAX(conversation_id)+1`, so concurrent new conversations can receive the same ID. `fetch_messages.php:36-51` queries and updates by `conversation_id`, but the messages table lacks an appropriate index.

**Required fix:** use a dedicated conversations table with an auto-generated primary key and participant uniqueness; add indexes for conversation ordering/unread updates; transact conversation creation; enforce participant authorization.

#### P1-5: Thread/post integrity rules are incomplete

`backend/public/create_post.php:57-69` and `create_reply.php:66-79` do not reject locked/hidden parent threads. Replies do not prove that `reply_to` belongs to the same thread. Reply/activity metadata is not updated consistently.

**Required fix:** validate parent visibility/lock/community/thread relationships in one transaction and update authoritative activity metadata atomically.

#### P1-6: Search exposes email/metadata without the intended privacy control

- `backend/public/search_users.php:19-49,63-78` returns email addresses without applying `show_email`.
- `backend/public/fetch_user.php:30-52,121-133` returns role/login/2FA/settings metadata beyond what a public profile requires.
- `fetch_user.php:195-207` and other endpoints return raw exception details.

**Required fix:** define explicit public/profile-owner/admin response schemas; apply discoverability and email visibility policy in SQL and serialization; remove security metadata from public responses; return generic errors and log redacted details server-side.

#### P1-7: Rate limiting trusts spoofable client IPs and fails open

- `backend/db_connection.php:57-66` trusts the first `X-Forwarded-For` value.
- `/home/nick/.config/srp/nginx.conf:43-49` preserves client-supplied forwarded values through `$proxy_add_x_forwarded_for`.
- `backend/includes/rate_limit.php:34-60` permits the request if rate-limit storage/checking fails and creates its table at runtime.

**Required fix:** overwrite forwarded headers at the trusted edge, configure an explicit trusted-proxy chain, use a durable atomic limiter, fail closed for authentication/recovery endpoints, and monitor limiter health.

#### P1-8: Upload handling lacks defense-in-depth

`backend/public/create_forum.php:97-114`, `edit_forum.php:80-97`, `upload_avatar.php:54-69`, `upload_banner.php:56-71`, and `update_university.php:130-205` retain client-supplied extensions after MIME checks. Application-level file size, image dimensions, and decoded-pixel limits are missing. Nginx allows 12 MB while PHP defaults observed are lower, producing inconsistent behavior.

**Required fix:** derive extensions from validated content, decode/re-encode images, set consistent byte/dimension/pixel limits at every layer, store files outside executable roots, and explicitly disable script execution.

#### P1-9: Production dependency audits fail across every application stack

- frontend production audit: **55 vulnerabilities** — 2 critical, 29 high, 14 moderate, 10 low;
- mobile production audit: **33 vulnerabilities** — 2 critical, 12 high, 18 moderate, 1 low;
- mobile full audit: **44 vulnerabilities** — 2 critical, 16 high, 24 moderate, 2 low;
- root Composer audit: **11 advisories**;
- backend Composer audit: **12 advisories**, plus abandoned `doctrine/cache`.

Direct frontend concerns include DOMPurify 3.3.1 (`frontend/package-lock.json:6663-6664`) used immediately before `dangerouslySetInnerHTML` (`frontend/src/components/ThreadView.js:793-796,1642-1646`), Axios, React Router, and the obsolete `react-scripts` toolchain. Composer reported affected Guzzle, PSR-7, and Slim versions.

**Required fix:** triage reachable advisories, upgrade DOMPurify first, then direct networking/router/framework packages; upgrade Guzzle/PSR-7/Slim to fixed supported releases; migrate away from obsolete tooling; regenerate lockfiles; rerun behavior, security, and audit gates. Do not apply automated major-version fixes without regression testing.

#### P1-10: Contact/feedback delivery is not production-capable

`backend/public/send_feedback.php:23-31` initializes Mailgun with a literal placeholder, uses a hardcoded sandbox domain and personal recipient, and has no rate limit or abuse control. The required current Mailgun configuration was not present.

**Impact:** contact submissions are expected to fail and the public endpoint can be abused.

**Required fix:** use managed environment configuration, a verified sender/domain and role mailbox, generic user-facing failure handling, rate limiting, spam protection, monitoring, and delivery integration tests.

#### P1-11: Runtime errors and CORS are configured like development

- multiple public endpoints enable `display_errors`; representative files are `backend/public/update_profile.php:6-7`, `upload_avatar.php:6-8`, `upload_banner.php:6-8`, and `fetch_user.php:7-9`;
- several responses expose raw exception text, including `fetch_user.php:195-207` and `follow_user.php:46-51`;
- `backend/public/cors.php:6-17,37-49` contains development origins and same-host development exceptions.

**Required fix:** disable display errors globally in the production PHP configuration; return uniform generic JSON errors; use structured redacted logs and correlation IDs; allow only exact production HTTPS origins and required methods/headers.

#### P1-12: Event notification/fetch paths do not scale

- `backend/includes/event_notifications.php:198-228` loads all users and performs approximately 7–9 queries per user synchronously during event creation.
- `backend/public/fetch_events.php:43-59` performs two additional queries per returned event, up to hundreds of queries for one request.
- `backend/public/fetch_feed.php:89-137`, `fetch_threads.php:19-64`, and `fetch_posts.php:20-77` return unbounded collections.
- `backend/public/search.php:8-10` accepts an uncapped limit and uses `%LIKE%` scans.

**Required fix:** enqueue/batch notification fan-out; replace N+1 queries with joins/aggregates; add cursor pagination and hard maximums; inspect slow-query plans and add measured indexes; add load targets and tests before launch.

#### P1-13: Hidden/private content policy is not enforced consistently

- `backend/public/search.php:114` does not filter hidden forums, threads, or posts.
- `backend/public/fetch_user_threads.php:39` and `fetch_user_replies.php:37` expose hidden activity and do not consistently enforce private-profile authorization.
- saved-content endpoints accept a supplied user ID rather than deriving the owner from the session.
- `profile_visibility` is returned by profile APIs but is not applied consistently to the underlying activity.

**Required fix:** centralize visibility predicates and response policy; require ownership for saved/private data; test hidden, deleted, private-profile, blocked-user, and moderator-only content across search, feeds, profiles, and direct IDs.

#### P1-14: CSRF and HTTP-method enforcement are incomplete

Only a minority of the public scripts enforce `REQUEST_METHOD`, and cookie-authenticated mutations have no consistent CSRF token or trusted `Origin` validation. Many scripts accept both form and JSON input. `SameSite=Lax` is useful defense-in-depth but is not a complete mutation authorization policy.

**Required fix:** reject unexpected methods and content types centrally; add CSRF protection for cookie-authenticated browser writes; validate exact production origins; keep server-side authentication and object authorization independent of CSRF.

#### P1-15: Administrative workflows are incomplete or non-idempotent

- only ambassador submission/eligibility paths reference `ambassador_applications`; no complete review/approve/reject product path was found.
- `backend/includes/onboarding.php:70` uses uniqueness on `(user_id, community_id, status)`, which will impede repeated historical outcomes when review is added.
- `backend/public/apply_ambassador.php:139` inserts application/notification state without a transaction.
- `backend/public/handle_community_request.php:44` does not lock or require a still-pending request, so retries can duplicate communities/ambassadors; authorization includes a hardcoded personal email at `:17-21`.
- `backend/public/update_verification_request.php:58` can repeat an outcome and performs related writes without one transaction.

**Required fix:** complete staff/super-admin review APIs and UI; derive capabilities from current database roles; make review actions idempotent and state-machine based; lock rows and transact all related changes; retain an immutable audit trail.

#### P1-16: Notification behavior contradicts the API/UI contract

`backend/public/mark_notifications_read.php:17` deletes notifications instead of recording read state.

**Required fix:** add/update a `read_at` field, preserve notification history according to retention policy, and test unread counts, multi-device synchronization, deletion, and archival separately.

#### P1-17: Encryption and credential handling can fail open

`backend/includes/crypto.php:30` can fall back to storing OAuth credentials as plaintext when encryption configuration is unavailable.

**Required fix:** make missing/invalid encryption keys a startup or operation failure; use envelope encryption backed by a managed key service; add key versioning/rotation and tests proving ciphertext is stored.

#### P1-18: A concrete banner upload binding bug can orphan data

`backend/public/upload_banner.php:96` binds the prefixed string user ID as `PDO::PARAM_INT`. It can target user `0`, after the old file is removed and a new file is placed, leaving the database unchanged and the new file orphaned.

**Required fix:** use the schema's actual string ID type, wrap file/database replacement in a recoverable transaction-like workflow, and delete new/old media only after the corresponding database operation succeeds.

### P2 — Important pre-launch improvements

#### P2-1: Development servers and listeners are running alongside the production-like service

Observed PM2/listener state included:

- PHP's built-in server for the API on loopback port 3003;
- the custom Nginx service on public port 3001;
- the CRA development server on `0.0.0.0:3000`;
- Expo/Metro on all interfaces at port 8081.

**Required fix:** run PHP through a hardened PHP-FPM/application-server path; stop or firewall development listeners; use a dedicated unprivileged service identity, startup supervision, timeouts, health checks, and immutable artifacts.

#### P2-2: Monitoring, log rotation, capacity alerts, and operational runbooks are absent

No application error monitoring, uptime checks, alerting, or PM2 log rotation was found. Nginx logs live outside the normal distribution log-rotation path. At review time the host was approximately 87% disk-full, with material swap use, and application logs were already multi-megabyte.

**Required fix:** add structured centralized logs, rotation/retention, exception and uptime monitoring, disk/memory/latency/error-rate alerts, release markers, on-call ownership, and tested incident/rollback/restore runbooks.

#### P2-3: Frontend request volume and bundle loading are unnecessarily high

- `frontend/src/layout/AppShell.tsx:182-193` always mounts the rail; community pages mount another copy at `UniversityProfile.js:1704-1711` and `GroupProfile.js:1423-1430`.
- each rail independently fetches multiple datasets at `RightRail.tsx:334-439`.
- `frontend/src/App.js:142-147,395-405` duplicates initial notification/message requests and polls every ten seconds.
- all routes, including administrator Newsroom, are eagerly imported at `App.js:35-65`.
- current build output was about 11 MB, with a 1.27 MB main JavaScript file (353 KB gzip) and a 6.58 MB source map.

**Required fix:** mount one rail/data owner, add client request caching, use visibility-aware backoff or push delivery, lazy-load routes, define bundle budgets, and keep source maps private in production monitoring.

#### P2-4: Frontend accessibility has material gaps

- `frontend/src/components/ModalOverlay.js:12-75` lacks initial focus, focus trapping, focus restoration, and title association.
- kebab controls lack accessible names in `ForumCard.js:147-157` and `ThreadCard.js:160-170`.
- carousel dots are undersized targets in `NewsRailPane.css:89-105`.
- `NavBar.js:764-773` applies unsupported `aria-pressed` semantics to a menu item.

**Required fix:** run keyboard/screen-reader checks and automated accessibility tests; repair modal semantics/focus; label icon controls; meet target-size and state-semantic requirements.

#### P2-5: Mobile release metadata and release engineering are incomplete

- `mobile/app.json:3-8` retains generic app identity/slug/scheme values.
- iOS has no explicit build number at `mobile/app.json:11-16`.
- Android has no package identifier/version code at `mobile/app.json:18-29` and requests microphone access without an identified audio feature.
- `mobile/eas.json:1-20` has no release channels, environment policy, update/runtime policy, or submission setup.
- there are no mobile behavior tests or test script.

**Required fix:** finalize bundle/package IDs, versioning, deep-link scheme, least-privilege permissions, icons/splash/store metadata, EAS environments/channels, signing/secrets, runtime/update policy, device testing, crash reporting, and store submission checks.

#### P2-6: Privacy, deletion, and retention requirements are unfinished

No complete production privacy policy, terms, account-deletion workflow, or documented data-retention/deletion policy was found. `docs/PROJECT_OVERVIEW.md:340-351` acknowledges age and retention gaps.

**Required fix:** complete legal/privacy review; implement self-service account deletion and downstream cleanup; define age/consent handling, verification-document retention, export/deletion SLAs, subprocessors, and incident notification obligations before accepting public users.

#### P2-7: External browser dependencies and security headers need hardening

`frontend/public/index.html:25-32` loads external fonts and jQuery without a complete integrity/CSP strategy.

**Required fix:** remove unused jQuery, self-host required assets or pin them with SRI/crossorigin, and deploy a tested restrictive CSP.

#### P2-8: Client authorization and diagnostics are inconsistent

- `/messages` is omitted from protected routes at `frontend/src/App.js:67` and rendered at `:828-831`.
- `/community-requests` uses a hardcoded personal email check at `App.js:795-803`.
- web-vitals are discarded at `frontend/src/index.js:20-23`; there is no application error boundary/reporting.
- session/user debug logs remain at `App.js:140,212-224`.

**Required fix:** drive UI capabilities from server-provided permissions, guard routes consistently, remove personal-identity checks and sensitive logging, add an error boundary, and integrate production telemetry. Server authorization must remain authoritative.

### P3 — Repository and maintainability improvements

1. Remove checked-in `vendor` trees and generated static/source-map assets; install dependencies from lockfiles in isolated builds.
2. Stop tracking runtime logs and cache serialization files; route logs to managed storage.
3. Fix strict Composer metadata/constraints:
   - root `composer.json` lacks required/recommended package metadata;
   - `backend/composer.json:7,10` uses wildcard constraints and lacks a description.
4. Replace the CRA placeholder test at `frontend/src/App.test.js:1-8` and substantially expand coverage beyond the current two frontend test files.
5. Resolve 86 frontend warnings and 39 mobile lint warnings rather than suppressing them.
6. Cap and paginate every collection endpoint and document response schemas/versioning.

## Recent-change assessment

The normal frontend build and PHP syntax checks show that the recent Newsroom, news pane, UI recoloring, title wrapping/content limits, image-layout, translation, and forum/thread changes compile or parse. That is not sufficient for production certification because most lack behavior/integration coverage.

Specific recent-change risks:

- `backend/includes/newsroom.php`, Newsroom endpoints, `backend/scripts/import_news.php`, `backend/migrations/20260803_newsroom.sql`, and the corresponding frontend files are untracked and would be omitted from a normal Git release.
- the Newsroom does reread the database role for its privileged operations and includes a human-review workflow, which is a good direction.
- no live external news API/AI credential was configured during the audit; current items come from local database content/import/seed paths, with template fallback rather than a verified AI/news automation path.
- the news importer is not scheduled; only event reminders were found in the StudentSphere cron configuration.
- the migration is not recorded in `schema_migrations`, despite Newsroom schema already existing, demonstrating drift.
- the rail's event/poll fixtures and local-only poll behavior can make recent UI appear operational when the shared backend workflow is not.

Before release, commit/review the intended change set, run the migration through a controlled staging pipeline, configure and test source ingestion with licensing/provenance, keep human approval mandatory, add prompt/output safety and attribution, and test the complete draft-review-publish-rail lifecycle.

## Validation results

| Area | Command/check | Result | Notes |
|---|---|---:|---|
| PHP | `find backend -name '*.php' ... php -l` | **PASS** | All first-party PHP files parsed. |
| PHP permissions | `php backend/tests/permissions_test.php` | **PASS** | Existing assertions passed; coverage is much narrower than the endpoint surface. |
| PHP targeted checks | content-limit and sanitizer boundary probes | **PASS** | Length boundaries and removal of script elements, JavaScript URLs, and inline event handlers passed. |
| Backend test tooling | PHPUnit/PHPStan/Psalm/PHPCS discovery | **NOT AVAILABLE** | No installation/configuration was found; only one backend test file covers roughly 150 public endpoints. |
| News ingestion | live Department of Education fetch/parser check | **PASS** | Ten source items parsed; this does not prove scheduled ingestion, AI generation, or production publishing. |
| Git | `git diff --check` | **PASS** | No whitespace errors. |
| Frontend build | `npm run build` | **PASS WITH WARNINGS** | 86 warnings; generated main JS about 353 KB gzip. |
| Frontend strict build | `CI=true npm run build` | **FAIL** | Warnings are treated as errors. |
| Frontend lint | ESLint over JS/TS source | **PASS WITH WARNINGS** | Exit 0 with 86 warnings. |
| Frontend strict lint | ESLint with `--max-warnings=0` | **FAIL** | 86 warnings. |
| Frontend tests | `CI=true npm test -- --watchAll=false --runInBand` | **FAIL** | Both suites failed before execution; missing `@testing-library/jest-dom` from `frontend/src/setupTests.js:5`; zero tests ran. |
| Frontend types | `npx tsc --noEmit` | **FAIL** | TypeScript 4.9 does not support `moduleResolution: "Bundler"` in `frontend/tsconfig.json:12-13`; source types were not checked. |
| Frontend dependencies | `npm audit --omit=dev` | **FAIL** | 55 vulnerabilities: 2 critical, 29 high, 14 moderate, 10 low. |
| Frontend dependency tree | `npm ls --depth=0` | **PASS** | Installed direct tree resolves. |
| Mobile lint | `npm run lint` | **PASS WITH WARNINGS** | 39 warnings. |
| Mobile types | `npx tsc --noEmit` | **PASS** | No type errors. |
| Mobile export | Expo web/static export | **PASS** | 32 routes; web bundle approximately 3.33 MB. This is not a signed native release test. |
| Mobile diagnostics | `npx expo-doctor` | **FAIL** | 2 of 18 checks failed: project-local `eas-cli` and seven Expo patch-version mismatches. |
| Mobile dependencies | `npm audit --omit=dev` | **FAIL** | 33 production vulnerabilities: 2 critical, 12 high, 18 moderate, 1 low. |
| Root npm dependencies | `npm audit` | **PASS** | No reported vulnerabilities in the small root npm tree. |
| Root Composer metadata | `composer validate --strict` | **FAIL** | Package metadata incomplete. |
| Backend Composer metadata | `composer validate --strict` | **FAIL** | Missing description and wildcard constraints. |
| Root Composer security | `composer audit` | **FAIL** | 11 advisories. |
| Backend Composer security | `composer audit` | **FAIL** | 12 advisories plus abandoned `doctrine/cache`. |
| Composer platform | `composer check-platform-reqs` | **PASS** | Required PHP extensions/platform available. |
| Composer installability | `composer install --no-dev --dry-run` | **PASS** | Lockfiles are installable in the current environment. |
| Live web health | `GET http://127.0.0.1:3001/` | **PASS, STALE** | HTTP 200, but serves the older frontend artifact. |
| Live API health | `GET http://127.0.0.1:3001/api/` | **PASS** | HTTP 200 and DB-up response; not an authorization/functionality test. |
| Database engine/tables | metadata and `CHECK TABLE ... QUICK` | **PASS** | MySQL 8.0.46; 54 InnoDB/utf8mb4 tables; all table checks passed. |
| Database referential checks | PK/FK/orphan audit | **PASS** | No missing primary keys and no orphans across 92 checked FK columns. |
| Database invariants | counter/constraint audit | **FAIL** | Vote and reply counters drift; required vote uniqueness constraints absent. |
| Migration state | files vs. `schema_migrations` vs. schema | **FAIL** | later files unrecorded while related schema exists. |
| Secrets tooling | gitleaks/trufflehog/semgrep availability | **NOT RUN** | Dedicated scanners were unavailable; targeted source/history review still found active historical credentials. |

## Database risk summary

Positive observations:

- MySQL 8.0.46;
- 54 tables, all InnoDB and `utf8mb4`;
- all quick table checks passed;
- no missing primary keys;
- zero detected orphans across 92 checked foreign-key columns;
- current database is small (approximately 6.9 MB and 6,578 estimated rows).

Release-blocking concerns:

- known denormalized counter drift already exists;
- vote uniqueness/concurrency invariants are not enforced;
- conversation ID generation is unsafe under concurrency;
- migrations and the ledger disagree;
- request-time schema creation requires dangerous runtime DDL privileges;
- no verified current full backup plus upload snapshot or restore drill exists;
- no isolated staging migration rehearsal exists.

The small present data volume reduces current load but does not make the query patterns, concurrency behavior, or backup posture safe.

## Required production gate

All of the following should be completed before reconsidering release:

- [ ] Close the endpoint-by-endpoint authentication/authorization gaps and pass negative integration tests.
- [ ] Eliminate active-content upload risk and move sensitive verification files to private storage.
- [ ] Disable and fail closed on development/debug bypasses.
- [ ] Rotate every historically committed credential and deploy through a secret manager.
- [ ] Centralize session transport, validation, timeout, revocation, current-role checks, and password-reset revocation.
- [ ] Retire legacy signup/verification routes.
- [ ] Correct service identity/file permissions and test uploads under the real production runtime.
- [ ] Establish a public HTTPS API/web origin and rebuild artifacts without private HTTP URLs.
- [ ] Create a clean, reviewed, immutable release from tracked source and controlled migrations.
- [ ] Replace local-only/fake event and poll workflows with durable APIs and truthful states.
- [ ] Repair frontend tests/type-check/strict build, Expo Doctor, dependency audits, and Composer gates.
- [ ] Create, encrypt, and restore-test database plus upload backups.
- [ ] Repair database counter drift and add atomic uniqueness/concurrency guarantees.
- [ ] Restrict ambassador/moderation actions to resource/community scope and prevent one-report auto-censorship.
- [ ] Add production monitoring, log rotation, capacity alerts, runbooks, and rollback verification.
- [ ] Complete privacy, retention, deletion, store metadata, signed mobile builds, and physical-device testing.
- [ ] Run a staging security regression, accessibility pass, load test, migration rehearsal, and end-to-end smoke suite.

## Final recommendation

**NO-GO.**

The current system should remain non-public and should not be submitted to mobile stores. A conditional release is not appropriate while broken object-level authorization, active development bypasses, exposed historical credentials, unsafe session revocation, insecure upload handling, private HTTP production URLs, dirty/stale deployment artifacts, failed test/type/dependency gates, and unverified recovery remain unresolved.

After the P0 items are fixed, repeat this audit against a clean release candidate in an isolated staging environment. Only consider **CONDITIONAL GO** after the P0 gate is fully green, the P1 security/data-integrity fixes are completed or explicitly risk-accepted by an accountable owner, and backup restore plus rollback have been demonstrated.
