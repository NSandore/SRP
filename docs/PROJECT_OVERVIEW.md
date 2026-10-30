# StudentSphere Project Overview

**Product:** StudentSphere  
**Slogan:** By Students. For Students.  
**Audit date:** July 5, 2026  
**Audit scope:** Current `dev` branch after PR #23, local database schema, web
source, mobile source, PHP API, and the active local deployment.

> This document describes what the current implementation does. It does not
> present roadmap items or database-only scaffolding as completed features.

## Status Legend

- **Implemented:** The feature has a working client and backend/data path.
- **Partial:** Some layers exist, but the feature is incomplete, local-only, or
  not consistently enforced.
- **Not implemented:** No working end-to-end feature exists.
- **Not verified:** The repository does not provide enough evidence to make the
  claim.

## 1. Product Summary

StudentSphere is a web and mobile community platform for prospective students,
current students, alumni, staff, representatives, and other members of
education communities. It currently focuses on:

- university and group communities;
- community forums, threads, nested replies, tags, votes, saves, and pins;
- user profiles, education and experience history;
- following users and communities;
- connections and direct messaging;
- personalized feeds, search, notifications, and announcements;
- events, RSVP tracking, and Zoom-based webinar creation;
- community ambassador workflows;
- account, email, and institution-verification workflows; and
- content reporting and moderation.

The platform is designed as a free-first community product. The current code
does not implement subscriptions or paid feature tiers.

## 2. Goal

Build an inclusive online community that helps people navigate education by
connecting them with peers, institution-centered communities, discussions,
events, and trustworthy representatives.

Scholarship discovery and tracking remain a stated product goal, but they are
not a completed feature in the current implementation.

## 3. Audience

The application collects an `education_status` and onboarding role intent, but
these audience labels are not the authorization roles used by the platform.

- **Prospective students — Implemented as an audience label:** Can create an
  account, select interests and communities, follow users and communities, and
  use normal member features. An unverified account is limited to one new
  post/reply per day.
- **Current students — Implemented as an audience and verification type:** Can
  identify a current university and optionally request institution verification.
- **Staff and representatives — Partial:** Can select a staff/representative
  intent and submit an institution-verification request. Approval grants a
  verified profile/community badge; it does not create a distinct global
  “Staff” permission role.
- **Alumni and other members — Implemented as audience/profile data:** Education
  history and broader community membership are supported.

## 4. Feature Coverage

### 4.1 Funding and Scholarships — Not Implemented

Current state:

- Web and mobile expose a Funding destination.
- Both clients explicitly identify the funding hub as “coming soon.”
- A Scholarship tag and promotional copy exist.

Missing:

- scholarship records and API endpoints;
- create, suggest, review, approve, and verify workflows;
- school, eligibility, and deadline categorization;
- saved-scholarship tracking; and
- deadline alerts or reminders.

The existing `polls` and survey schema does not provide scholarship
functionality.

### 4.2 Communities, Forums, and Q&A — Implemented

Current behavior:

- Communities can represent universities or groups.
- Communities contain forums; forums contain threads; threads contain posts and
  nested replies.
- Forums and threads support tags, including topics such as Admissions,
  Academics, Campus Life, Financial Aid, and Scholarships.
- Logged-in users can participate in discussions, subject to ownership,
  verification, and community permission checks.
- Forums, threads, and posts support upvotes and downvotes.
- Threads and replies can be sorted by newest, most upvoted, and most popular.
- Users can save forums, threads, and posts.
- Community ambassadors can verify posts as **Verified Correct** within their
  moderation scope. This is the implemented equivalent of the original
  “Certified Answer” concept.
- Community admins and super admins can manage forums under the current
  permission rules.
- Group question submission, approval/rejection, and ambassador answers are
  supported separately from the forum/thread model.

Important limitations:

- Admissions, Academics, and Campus Life are tags, not mandatory hard-coded
  subcategories for every school.
- The permission model has documented inconsistencies between global roles and
  community ambassador roles. See `docs/ROLES.md`.

### 4.3 Polls and Surveys — Partial

Current behavior:

- The database contains `polls`, `poll_options`, `poll_votes`, and survey
  tables.
- Web and mobile provide poll creation and voting interfaces.
- Community admins can compose community polls, and global admins can compose
  broader poll items in the management UI.
- The web UI locks a response after the first selection and replaces the
  selectable options with compact results.

Missing or incomplete:

- There are no poll create, fetch, vote, update, or delete API endpoints.
- Poll definitions, responses, and tallies are stored in browser/device local
  storage rather than the database.
- Polls do not synchronize between users, browsers, or devices.
- “Public versus private” polls are not implemented. The UI supports global or
  community scope, which is a different concept.
- The database uniqueness rule permits more than one option per user when
  multiple-choice behavior is not intended; no backend vote service currently
  enforces poll rules.
- Poll results cannot currently be relied on as community-wide results.

### 4.4 Events, Webinars, and Zoom — Partial

Current behavior:

- Admins and community ambassadors can create and manage events.
- Event records are persisted in MySQL.
- Zoom OAuth connect/disconnect/status flows are implemented.
- Authorized users can create or update Zoom meetings through the Zoom API.
- Users can RSVP or cancel an RSVP; registrations are persisted in MySQL.
- The web event feed is backed by an access-filtered event-list API and provides
  agenda and full month-calendar views.
- Events can target members, ambassadors, administrators, or all platform
  members. Creators can also invite individual users.
- Included users and invitees receive deduplicated platform notifications;
  users can disable general upcoming-event notifications in Account Settings.
- A first Zoom RSVP sends the attendee the join link by email and notifies the
  event creator once. Repeated RSVP requests do not resend either notification.
- Creators can optionally notify registered attendees when an event date
  changes.
- A reminder script can email registered users approximately 15 minutes before
  an event and respects the event/email notification preferences.
- The event schema includes an optional `recording_url`.

Missing or incomplete:

- The web management UI still mirrors created items into `managedEvents` for
  announcements, polls, and immediate local updates. Mobile event consumption
  has not been migrated to the new web event-list API.
- The reminder script exists but is not scheduled by cron or a systemd timer on
  the current server.
- Zoom meetings are configured with automatic recording disabled.
- There is no recording-consent workflow.
- Event access is enforced by platform role, community relationship, creator,
  or direct invitation; it is not a password-based private-meeting model.
- Zoom behavior depends on valid external OAuth configuration and was not
  exercised against a live Zoom account during this audit.

### 4.5 Following, Connections, and Messaging — Implemented

- Logged-in users can follow and unfollow communities.
- Logged-in users can follow and unfollow other users.
- Following data influences personalized feed content.
- Follower and following counts/lists are available.
- Users can send, accept, cancel, and remove connection requests.
- Connected users and permitted users can exchange direct messages.
- Community and profile privacy settings affect discovery, profile details,
  email visibility, and who may send messages.
- Users can manage active sessions and revoke sessions.

### 4.6 Profiles, Feeds, Search, and Notifications — Implemented

- Profiles support biography, skills, education, experience, avatar, banner,
  colors, verification badges, community affiliations, followers, and
  connections.
- The application provides followed-content, explore, and information/forum
  views.
- Search covers communities, users, forums, threads, and related content.
- Notifications support follows, votes, replies, messages, connections,
  announcements, events, verification, and moderation-related workflows.
- Community and global announcements are persisted in MySQL.

## 5. Roles and Permissions

The original Prospect/Student/Representative/Staff role hierarchy is not the
implemented authorization model.

### 5.1 Global Roles

| ID | Role | Current meaning |
| --- | --- | --- |
| `0` | Guest | Not logged in; limited public browsing |
| `1` | Member | Default authenticated user |
| `3` | Moderator | Global moderation level, inconsistently honored by some endpoints |
| `4` | Admin | Global administration level, inconsistently honored by some community endpoints |
| `5` | Super admin | Full system-level access |

Role ID `2` is intentionally unused.

### 5.2 Community Roles

The `ambassadors` table adds community-scoped access:

- `member`: ambassador membership; helper code currently normalizes this to
  moderator-level community behavior;
- `admin`: community administration; and
- `moderator`: recognized by some code paths but not supported by the current
  documented database enum.

This mismatch is a known authorization gap. The detailed endpoint matrix and
caveats are maintained in `docs/ROLES.md`.

### 5.3 Verification Is Separate from Authorization

- `users.is_verified` means the account email has been verified.
- `users.verified` and `users.verified_community_id` represent an approved
  institution/profile badge.
- An approved student or staff verification request does not automatically
  create a Staff, Representative, Moderator, or Admin role.
- Ambassador status is a separate community application and approval process.

## 6. Account Setup and Verification — Implemented with Differences

### Account Creation

- First name, last name, email, and password are required.
- Passwords are hashed with bcrypt.
- Users can select an audience/education intent, current school, followed
  communities, and interests.
- Email verification uses a six-digit code delivered by email.
- Email verification may be skipped; an unverified account is limited to one
  new post/reply per day.
- Optional email-based two-factor authentication is implemented.

### Institution Verification

- Student verification supports ID/selfie or recent tuition-document uploads.
- Staff/representative verification currently supports an ID-photo flow.
- Super admins review verification requests.
- Approval adds a verified profile badge linked to a community.
- Official school-domain matching and third-party verification services are not
  implemented.

### Ambassador Transition

- Users can apply to become university ambassadors after following the
  university and showing a current or prior education connection.
- Applications route to community admins or super admins.
- Direct ambassador invitation is currently disabled.
- The repository contains role-change notifications and verification prompts.

## 7. Moderation and Safety

### Implemented

- Authenticated users can report forums, threads, posts/replies,
  announcements, events, and users.
- Reports include reason, severity, details, item context, and community scope.
- High-severity reports, or an item reported by at least three distinct users,
  can be automatically hidden.
- Community moderators/admins and super admins can review applicable reports.
- Moderators can retain, hide, restore, dismiss, or remove supported content.
- Reporters and reported users receive status notifications.
- HTML content is sanitized in key editor/display paths with DOMPurify,
  HTMLPurifier, or tag restrictions.
- Email verification and the one-post-per-day unverified limit provide limited
  abuse resistance.
- Session IP address and user-agent metadata are recorded for session
  visibility and revocation.

### Missing or Incomplete

- CAPTCHA is not implemented for registration or posting.
- There is no general API rate-limiting layer.
- IP addresses are recorded, but there is no automated suspicious-IP blocking
  or abuse-scoring workflow.
- There is no machine-learning moderation system.
- There is no general prohibited-keyword/profanity filter.
- User warning and suspension enforcement is not implemented as a complete
  moderation workflow.
- Global Moderator and Admin access is not consistently applied across all
  moderation endpoints.

## 8. Security, Privacy, and Compliance

### Implemented Controls

- Password hashing uses bcrypt.
- Database calls generally use prepared PDO statements.
- Session cookies are HTTP-only, use SameSite `Lax`, and become `Secure` when
  the application is actually served over HTTPS.
- Optional email-based two-factor authentication is available.
- Users can review and revoke sessions, and inactivity timeouts are enforced.
- CORS uses an explicit development-origin allowlist.
- Profile visibility, discoverability, email visibility, online presence, and
  direct-message preferences have working settings and partial backend
  enforcement.
- User-generated rich text is sanitized in important post and display paths.

### Critical Gaps

- The database password is hard-coded in `backend/db_connection.php`; it is not
  exclusively loaded from environment variables.
- The original overview contained the database password in plaintext. It has
  been intentionally removed from this revised document.
- The current SRP deployment is available over HTTP on port `3001`; end-to-end
  TLS has not been configured for it.
- `backend/public/index.php` exposes `phpinfo()` and there is no `/api/health`
  endpoint.
- `serve_upload.php` does not authorize access before serving files, including
  verification documents when their paths are known.
- Zoom access and refresh tokens are stored in the `account_settings.extras`
  JSON data without application-level encryption.
- Some API error responses expose database exception details.
- A centralized CSRF defense is not present.
- Encryption at rest, key rotation, backup encryption, formal security audits,
  and vulnerability-management procedures are not evidenced in the repository.

### Compliance and Legal Status

- FERPA compliance: **Not verified**
- COPPA compliance: **Not verified**
- Privacy Policy: **Not implemented in this repository**
- Terms of Service: **Not implemented in this repository**
- Explicit user-content ownership terms: **Not implemented**
- Legal review by professional counsel: **Not verified**

The platform should not claim regulatory compliance until legal requirements,
age handling, data retention, parental consent where applicable, and operational
controls have been reviewed and documented.

## 9. Technical Architecture

### 9.1 Application Stack

**Web client**

- React 19 application created with Create React App / `react-scripts`
- JavaScript and TypeScript source
- React Router, Axios, TipTap, DOMPurify, and Lucide/React Icons
- Responsive layouts for desktop and mobile-width browsers

**Mobile client**

- Expo SDK 54
- React Native 0.81 and React 19
- Expo Router 6 with file-based routing
- Shared PHP API and MySQL data model
- Web output is also supported by Expo

**Backend**

- PHP 8.3
- REST-like, file-per-endpoint API under `backend/public`
- PDO with MySQL
- Composer dependencies for HTMLPurifier, MailerSend, Mailgun, Twilio, and
  related HTTP libraries
- Slim, Doctrine, and FastRoute are installed transitively/directly but are not
  used as the active request-routing or persistence architecture
- Environment values are loaded by a custom `.env` parser; sensitive
  configuration is not yet consistently environment-only

**Database**

- MySQL 8
- Local database name: `srp_db`
- String/hash identifiers are used by most primary entities
- The live schema contains users, roles, communities, ambassadors, forums,
  threads, posts, votes, saves, tags, follows, connections, messages,
  notifications, reports, announcements, events, registrations, polls,
  surveys, sessions, and verification/application tables

### 9.2 API and Data Flow

- Web and mobile clients call PHP endpoints under `/api/*.php`.
- Most endpoints return JSON and use PHP session authentication.
- Role checks combine global role IDs, community ambassador membership, email
  verification, and profile/community verification.
- Media uploads are stored on the local filesystem.
- Email workflows use MailerSend.
- Zoom meetings use user-linked Zoom OAuth tokens.

The API is REST-like but is not a resource-oriented router with routes such as
`/api/health`; each PHP endpoint is addressed directly.

### 9.3 Core Relationships

- Users have one global role and may have institution/audience metadata.
- Users may follow multiple communities and users.
- Users may hold ambassador roles in multiple communities.
- Communities may be universities or groups.
- Forums belong to communities.
- Threads belong to forums.
- Posts belong to threads and may reply to other posts.
- Votes and saved-item tables track forum, thread, and post engagement.
- Events and announcements may be global or community-scoped.
- Event registrations connect users to events.
- Reports retain item and community context for scoped moderation.

Foreign-key behavior is defined table-by-table. The implementation uses a mix of
`ON DELETE CASCADE`, `ON DELETE SET NULL`, and default restrictive behavior; it
does not universally apply `ON UPDATE CASCADE`.

## 10. Repository and Deployment

### 10.1 Current Repository Layout

```text
/home/nick/services/srp-server/srp
├── backend/
│   ├── public/                 # PHP API endpoints
│   ├── includes/               # Roles, permissions, onboarding
│   ├── scripts/                # Event reminder and import scripts
│   └── vendor/                 # Composer dependencies
├── frontend/
│   ├── public/
│   ├── src/                    # React web source
│   └── package.json
├── mobile/
│   ├── app/                    # Expo Router screens
│   ├── components/
│   ├── lib/
│   └── package.json
├── docs/
├── uploads/
└── .env
```

The prior `/var/www/html/SRP` structure, `setup_srp_project.sh`, backend `src`
directory, and FastRoute-based single-entry architecture described in the old
overview do not match this repository.

### 10.2 Branch and Promotion Model

At the time of this audit:

| Branch | Purpose | Current state |
| --- | --- | --- |
| `master` | Production/release branch | At `b9963bb`; does not contain the PR #23 mobile integration |
| `dev` | Shared integration and testing branch | At `ad92a94`; contains the web, backend, and squash-merged Expo mobile application |
| Feature branches | Temporary, focused development work | Created from `dev`, merged back through a pull request, then deleted |

The former `mobile/react-native` feature branch was merged into `dev` through
PR #23, **Integrate Expo mobile application**, and then deleted locally and
remotely. Its five commits were squash-merged as `ad92a94`. The mobile
application now lives in the `mobile/` directory on `dev`; “mobile” is a client
platform, not a permanent deployment branch.

The intended promotion path is:

```text
feature branch
    -> draft pull request into dev
    -> validation and manual testing
    -> squash merge into dev
    -> integration testing/soak period
    -> release pull request from dev into master
    -> production build and deployment from master
```

Merging a feature branch into `dev` does not merge it into `master` and does not
deploy a new production web build. Direct feature development on `master`
should be avoided.

### 10.3 Current Platform and Runtime State

As verified on July 5, 2026:

| Platform/runtime | Source or artifact | Process and address | Current status |
| --- | --- | --- | --- |
| Production web | Static assets in `/var/www/srp-frontend` | PM2 `srp-production`; user-managed Nginx at `http://10.0.0.251:3001` | Running, but the deployed assets predate the current `dev` source |
| PHP API | Current checkout at `/home/nick/services/srp-server/srp` | PM2 `srp-api`; PHP at `127.0.0.1:3003`, proxied through `/api` on port `3001` | Running from the current `dev` checkout |
| Mobile preview | `mobile/` in the current `dev` checkout | PM2 `srp-mobile`; Expo/Metro at `http://10.0.0.251:8081` | Running and manually smoke-tested |
| Database | Local MySQL 8 | Shared by the running API | Running; no separate development and production databases are established |

The mobile runtime on port `8081` is an Expo development/preview server. It is
not a signed App Store or Play Store production release.

The current deployment is not fully isolated by environment. The API and mobile
preview use the checked-out `dev` working tree, while the production web server
uses separately built static files. Restarting `srp-api` after pulling `dev` can
therefore expose development API changes immediately, even though the
production web build and `master` branch remain unchanged. The shared local
database is another production/development coupling point.

Apache remains active on port `80` but serves the Ubuntu default page and is not
the current SRP application server. The system Nginx unit is failed because port
`80` is already occupied; the SRP-specific Nginx process is managed separately
by PM2.

The old GCP Ubuntu 20.04 instance, `34.31.85.242`, and Apache deployment cannot
be treated as current infrastructure based on this repository/server. The
hostname `thestudentsphere.com` did not resolve from the current server during
this audit.

### 10.4 Current Mobile Integration Record

PR #23 was validated, squash-merged into `dev`, and cleaned up as follows:

- Mobile ESLint: 0 errors and 39 warnings
- Mobile TypeScript check: passed
- Expo Android, iOS, and web exports: passed
- PHP syntax checks: 149 files passed
- Clean React dependency install and production build: passed
- Production dependency audit: 0 vulnerabilities
- Runtime API and mobile smoke checks: passed
- Manual login and primary application flows: passed
- `mobile/react-native` branch: deleted after merge
- `master`: intentionally unchanged

The React build was repaired by aligning the frontend with TypeScript `4.9.5`.
The missing mobile document-picker declaration and mobile TypeScript errors were
also resolved before the merge.

### 10.5 Release Workflow

For future work:

```bash
# 1. Start from the latest integration branch
cd /home/nick/services/srp-server/srp
git switch dev
git pull --ff-only origin dev

# 2. Create a focused feature branch
git switch -c feature/short-description

# 3. After implementation and local validation
git push -u origin feature/short-description
```

Open a draft pull request with `dev` as the base. After review and validation,
squash-merge it into `dev`, delete the feature branch, and update the local
checkout:

```bash
git switch dev
git pull --ff-only origin dev
git fetch --prune
```

When the integrated `dev` state is approved for release, open a separate pull
request with `master` as the base and `dev` as the comparison branch. Re-run the
release checks on that exact diff. After merging, build and deploy production
from `master`, verify the web and API health checks, and tag the release.

Do not treat a PM2 restart as a production deployment. A production deployment
must identify the source commit, build the web artifact, install it in the
production asset directory, and verify the running result.

### 10.6 Operational Commands

```bash
# Confirm the checked-out branch and remote state
cd /home/nick/services/srp-server/srp
git status --short --branch
git branch -vv

# Process status
pm2 list

# Logs
pm2 logs srp-production --lines 100
pm2 logs srp-api --lines 100
pm2 logs srp-mobile --lines 100

# Restart only the dev-backed API and mobile preview after an approved dev update
pm2 restart srp-api srp-mobile --update-env

# Save the process list for reboot recovery
pm2 save

# Web source build
cd /home/nick/services/srp-server/srp/frontend
npm run build

# Mobile development server
cd /home/nick/services/srp-server/srp/mobile
npm start -- --lan --port 8081
```

Restart or redeploy `srp-production` only as part of the explicit
`dev`-to-`master` release workflow.

There is currently no dedicated application health endpoint.

### 10.7 Updating Each Environment (Dev, Production, Mobile)

There are four PM2-managed processes, and **all four must remain running at
all times**: `srp-api` (PHP backend, shared by every environment),
`srp-production` (Nginx serving the built web app on port `3001`),
`srp-mobile` (Expo/Metro dev server on port `8081`), and the local MySQL
service (not PM2-managed; verify with `sudo systemctl status mysql`). Never
run `pm2 stop` or `kill` on any of these without immediately restarting them,
and never let a config edit leave one down — apply the fix and confirm the
process shows `online` in `pm2 list` before moving on.

**Dev (web, local React dev server on port 3000)**

Dev does not need a "deploy" step — it reads source directly.

```bash
cd /home/nick/services/srp-server/srp/frontend
npm start
```

Leave this running while developing; it hot-reloads on save. This is
separate from the `srp-production` PM2 process and does not affect port
`3001`.

**Production (web, served from `/var/www/srp-frontend` via PM2
`srp-production` + user Nginx on port `3001`)**

Production does **not** read from `frontend/src` or `frontend/build`
directly — it serves a static copy that must be rebuilt and re-copied every
time. Skipping the copy step is the reason the button-text fix in this
session did not show up initially.

```bash
# 1. Build the current source
cd /home/nick/services/srp-server/srp/frontend
npm run build

# 2. Replace the deployed static copy
sudo rm -rf /var/www/srp-frontend/*
sudo cp -r /home/nick/services/srp-server/srp/frontend/build/* /var/www/srp-frontend/

# 3. Confirm srp-production is (still) running — do not stop/restart it for a
#    plain static-asset update, it just serves whatever is on disk
pm2 list
```

Per section 10.5, treat an actual `master`-branch release the same way, but
only after the `dev`-to-`master` pull request has merged.

If `srp-production` itself ever needs restarting (not just the static
files), use PM2, not systemd Nginx:

```bash
pm2 restart srp-production
```

Do not run `sudo systemctl restart nginx` / `sudo killall nginx` for this
app. The system Nginx unit is a separate, unrelated instance that normally
fails to bind (see 10.3) because PM2's Nginx already holds ports `80`/`3001`;
killing PM2's Nginx only causes PM2 to immediately respawn it under a new
PID, and manually stacking `nginx -g 'daemon on'` invocations on top of it
just produces more `Address already in use` errors.

**Mobile (Expo preview, PM2 `srp-mobile` on port `8081`)**

Mobile reads live from the `mobile/` checkout (like `srp-api`), so a plain
`pm2 restart` picks up new source — no build/copy step is required for the
Expo dev bundle:

```bash
pm2 restart srp-mobile --update-env
```

If dependencies changed (`package.json` edited), install first:

```bash
cd /home/nick/services/srp-server/srp/mobile
npm install
pm2 restart srp-mobile --update-env
```

Remember this is an Expo development/preview server, not a signed
App Store/Play Store build (see 10.3).

**Backend/API (PM2 `srp-api`, shared by web, mobile, and dev)**

Like mobile, the API reads live from the checkout, so restarting after a
`git pull` is sufficient:

```bash
pm2 restart srp-api --update-env
```

Because `srp-api` is shared, restarting it applies backend changes to
dev, production, and mobile simultaneously — there is no per-environment API
isolation yet (see the coupling caveat in 10.3).

**Keeping everything running**

After any restart, always confirm all four processes are `online`:

```bash
pm2 list
```

And persist the current process list so a server reboot restores the same
processes automatically (PM2's systemd startup hook, `pm2-nick`, is already
enabled):

```bash
pm2 save
```

If any process shows `errored` or `stopped`, treat that as an incident, not
a background task — restart it and check `pm2 logs <name> --lines 100`
before doing anything else, since dev, production, and mobile all depend on
`srp-api` and the shared local MySQL instance staying up.

## 11. Validation Results and Release Blockers

Validation performed July 5, 2026:

- Existing production web page: HTTP `200`
- Live API and database-backed tag/community/session checks: HTTP `200`
- Expo web bundle: HTTP `200`
- PHP syntax checks: 149 files passed
- Clean React dependency install and production build: passed
- Mobile lint: passed with 0 errors and 39 warnings
- Mobile TypeScript check: passed
- Expo Android, iOS, and web exports: passed
- Production dependency audit: 0 vulnerabilities
- Runtime API/mobile smoke checks and manual login: passed

The currently served web build predates the audited source changes. A successful
release pull request from `dev` to `master`, production build, deployment, and
post-deployment verification are still required before the live web application
can be claimed to match the current source.

Remaining release/operations gaps include:

- no automated GitHub Actions checks on pull requests;
- 39 non-blocking mobile lint warnings;
- development dependency vulnerabilities inherited from the older Create React
  App toolchain, despite a clean production dependency audit;
- no dedicated application health endpoint;
- no isolated production API checkout or production database; and
- no documented, automated, commit-addressable production deployment.

## 12. Requirement Gap Summary

| Original requirement | Status | Difference or missing work |
| --- | --- | --- |
| Scholarship listings and contributions | Not implemented | Funding screens are placeholders; no scholarship API/data workflow |
| Scholarship categories and deadlines | Not implemented | No scholarship model or deadline service |
| Scholarship verification | Not implemented | No review/approval workflow |
| School-centered Q&A forums | Implemented | Uses communities, forums, threads, posts, and tags |
| Upvotes and sorting | Implemented | Available for forums/threads/posts and thread replies |
| Certified answers | Implemented with different naming | Implemented as ambassador-scoped “Verified Correct” posts |
| Student/staff-created polls | Partial | Admin/community-admin UI exists; data and votes are local-only |
| Public/private polls | Not implemented | Only global/community display scope exists |
| Platform decision polls | Partial | Global admin UI exists, but no shared backend vote persistence |
| Zoom-hosted webinars | Partial | OAuth and meeting creation exist; external account not live-tested |
| Event calendar and RSVP | Implemented on web; partial on mobile | Web has a filtered event API, agenda/month views, access controls, invites, and deduplicated RSVP notifications; mobile migration remains |
| Event reminders | Partial | Email script exists but is not scheduled |
| Recordings with consent | Not implemented | Schema field only; Zoom auto-recording is off; no consent flow |
| Follow communities and users | Implemented | End-to-end API, UI, counts, lists, and feed use |
| Prospect/Student/Representative/Staff roles | Different implementation | Audience intent is separate from global/member/admin and ambassador permissions |
| School-email-only verification | Not implemented as stated | General email code plus optional document/manual institution verification |
| Role upgrade requests | Partial | Ambassador application and verification workflows exist; no generic role-upgrade workflow |
| CAPTCHA | Not implemented | No CAPTCHA integration |
| IP abuse monitoring | Partial | IPs are stored for sessions; automated abuse detection is absent |
| Reporting dashboard | Implemented | Community-scoped and super-admin moderation workflows exist |
| Warnings and suspensions | Not implemented | Content action notifications exist; account enforcement workflow is absent |
| Keyword/ML moderation | Not implemented | Content sanitation is not automated semantic moderation |
| TLS for all traffic | Not implemented on current deployment | SRP currently runs over HTTP |
| Sensitive-data encryption at rest | Not verified / incomplete | No evidenced at-rest controls; Zoom tokens are plaintext in application data |
| FERPA/COPPA compliance | Not verified | No compliance program or legal documents in repository |
| Privacy controls | Partial | Multiple settings work, but no complete privacy/compliance assurance |
| Privacy Policy and Terms | Not implemented | No current legal pages/documents in repository |
| React frontend | Implemented | React 19 / CRA; clean production build passes after TypeScript 4.9.5 alignment |
| PHP backend | Implemented | File-per-endpoint PHP, not FastRoute-based centralized routing |
| MySQL | Implemented | Local MySQL 8 |
| Apache/systemd SRP deployment | Different implementation | SRP currently uses PM2 plus a user-managed Nginx/PHP process |
| `/api/health` | Not implemented | API index exposes `phpinfo()` instead |
| Future mobile support | Implemented | Expo/React Native mobile application exists |

## 13. Recommended Priority Order

1. Remove hard-coded credentials, rotate the exposed database password, remove
   `phpinfo()`, and protect verification uploads.
2. Configure HTTPS and a resolvable production hostname.
3. Isolate production from `dev`: use a production checkout/artifact for the
   API, separate databases/configuration, and a commit-addressable deployment.
4. Migrate mobile event consumption and the remaining management mirrors to the
   event-list API.
5. Implement poll APIs and database-backed voting before presenting polls as
   shared community results.
6. Schedule and monitor the event-reminder worker.
7. Reconcile global and ambassador permissions, especially moderator support.
8. Add rate limiting, CAPTCHA where appropriate, CSRF protection, and account
   enforcement controls.
9. Draft and legally review Privacy Policy, Terms of Service, age handling, and
   FERPA/COPPA applicability.
10. Add pull-request CI, reduce lint warnings, and plan migration away from the
    aging Create React App dependency stack.
11. Build the scholarship data, contribution, verification, categorization,
    save, and reminder workflows.
