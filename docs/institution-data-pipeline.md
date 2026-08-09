# Institution data pipeline

This document records the production schema and integration inventory that was
completed before implementation, then describes how to operate and extend the
pipeline. The live schema is authoritative where older dumps or documentation
disagree.

## Pre-change inventory

### Architecture

StudentSphere uses PHP 8.3, PDO, and MySQL 8. There is no active ORM, entity,
repository, queue, or application scheduler. API routes are individual files in
`backend/public`, shared backend logic belongs in `backend/includes`, CLI jobs
belong in `backend/scripts`, SQL migrations are applied from
`backend/migrations`, and the deployment's user crontab is the existing
scheduler.

The only canonical institution storage is `srp_db.communities`. A university is
a row whose `community_type` is `university`; the same table also contains group
communities. At inspection time it held 6,173 universities and five groups.

There is no university model or entity class. `backend/db_connection.php`
provides PDO access and generates opaque internal community IDs. Pipeline code
must never derive, replace, or renumber those IDs.

### Exact pre-change table

```sql
CREATE TABLE `communities` (
  `id` varchar(32) NOT NULL,
  `community_type` enum('university','group') NOT NULL,
  `parent_community_id` varchar(32) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `tagline` varchar(150) DEFAULT NULL,
  `aliases` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
  `logo_path` varchar(255) DEFAULT NULL,
  `primary_color` varchar(100) DEFAULT NULL,
  `secondary_color` varchar(100) DEFAULT NULL,
  `banner_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_communities_name` (`name`),
  KEY `idx_parent_community_id` (`parent_community_id`),
  CONSTRAINT `fk_communities_parent`
    FOREIGN KEY (`parent_community_id`) REFERENCES `communities` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
```

The live schema has no triggers or check constraints. The `all_community_data`
view explicitly projects a subset of these columns and is recreated by list
endpoints during requests.

Schema history is fragmented:

- The root `srp_db.sql` dump creates `communities` with the parent relationship
  but does not contain the live `phone` or `aliases` columns.
- `docs/database-tables.md` contains `phone` and `aliases` but omits the parent
  relationship.
- `docs/add_community_phone.sql` and `docs/add_community_aliases.sql` added
  those fields outside the current migration runner.
- No existing file under `backend/migrations` directly creates or alters
  `communities`.

### Existing fields reused

The pipeline keeps the meaning of every existing field:

| Existing field | Pipeline use |
| --- | --- |
| `id` | Unchanged platform identity; never sourced externally |
| `community_type` | Must remain `university` for every pipeline write |
| `parent_community_id` | Platform-owned and never pipeline-managed |
| `name` | Existing platform display name; retained for existing rows |
| `location` | Existing combined display address |
| `website` | Selected official institution website |
| `phone` | Selected main directory telephone |
| `tagline` | Marketing tagline, distinct from motto and slogan |
| `aliases` | Alternate institution names |
| `created_at`, `updated_at` | Existing timestamp semantics |
| `logo_path` | Existing uploaded/platform logo; never replaced by a remote logo |
| `primary_color`, `secondary_color` | Selected normalized institution colors |
| `banner_path` | Platform-owned banner; never pipeline-managed |

`official_name` is intentionally distinct from `name`. The official directory
contains multiple institutions with the same official name, while the existing
table has a case-insensitive unique constraint on `name` across both
universities and groups. Existing display names and IDs therefore remain
unchanged. A new same-named institution receives a location-qualified display
name while retaining the source value in `official_name`.

### Relationships that must be preserved

The following live foreign keys reference `communities`:

| Referencing column | Delete behavior |
| --- | --- |
| `communities.parent_community_id` | SET NULL |
| `community_creation_requests.parent_community_id` | SET NULL |
| `users.recent_university_id` | SET NULL |
| `users.verified_community_id` | SET NULL |
| `user_verification_requests.community_id` | SET NULL |
| `reels.community_id` | SET NULL |
| `reel_upload_sessions.community_id` | SET NULL |
| `ambassador_applications.community_id` | CASCADE |
| `ambassadors.community_id` | CASCADE |
| `announcements.community_id` | CASCADE |
| `educational_experience.community_id` | CASCADE |
| `events.community_id` | CASCADE |
| `followed_communities.community_id` | CASCADE |
| `forums.community_id` | CASCADE |
| `group_questions.group_id` | CASCADE |
| `pinned_items.community_id` | CASCADE |
| `polls.community_id` | CASCADE |
| `reel_community_pins.community_id` | CASCADE |
| `reports.community_id` | CASCADE |
| `surveys.community_id` | CASCADE |
| `tags.community_id` | CASCADE |
| `verified_users.community_id` | CASCADE |

There is deliberately no pipeline delete or merge operation. Closed, missing,
renamed, and potentially merged schools retain their internal row and all
relationships.

### Existing university integration surface

The original importer is `backend/scripts/import_university_csv.php`. It reads
the checked-in `data/university_data_02-08-2025.csv`, which has an OPE ID but no
IPEDS UNITID. It matches through the globally unique `communities.name`,
generates a new internal ID before duplicate detection, overwrites location and
website, and assigns generic logo/color values. It has no source provenance,
field resolution, transaction, overlap lock, retries, source validation,
history, or conflict reports. It is unsafe for renamed schools and can update a
same-named group through `ON DUPLICATE KEY UPDATE`.

University and community data is inserted or edited by:

- `backend/public/create_community.php`
- `backend/public/request_community.php`
- `backend/public/handle_community_request.php`
- `backend/public/update_university.php`
- `backend/scripts/import_university_csv.php`
- `backend/scripts/seed_uhart_profile_demo.php`
- `backend/scripts/seed_partner_demo_accounts.php`

Important list, search, profile, onboarding, and API integrations include:

- `backend/public/fetch_all_university_data.php`
- `backend/public/fetch_communities.php`
- `backend/public/fetch_university.php`
- `backend/public/fetch_group.php`
- `backend/public/fetch_community.php`
- `backend/public/fetch_subcommunities.php`
- `backend/public/search.php`
- `backend/public/onboarding_wizard.php`
- `backend/public/register_user.php`
- `backend/public/complete_registration.php`
- `backend/public/update_interests.php`
- `backend/public/followed_communities.php`
- `backend/public/user_education.php`
- `backend/public/check_session.php`
- `backend/public/fetch_user.php`

The web clients are centered on `Feed.js`, `SignUp.js`,
`UniversityProfile.js`, `GroupProfile.js`, `SearchResults.js`, the profile
components, event/community selectors, and the right rail. Mobile equivalents
use `mobile/lib/api/communities.ts`, the community and onboarding tabs,
university/group routes, profiles, events, polls, and reel community selectors.
All selection and relationship flows use the existing internal community ID.

Four public response paths used broad projections before this work:

- `fetch_university.php` used `c.*`.
- `fetch_group.php` used `c.*`.
- `fetch_community.php` used `SELECT *`.
- `update_university.php` returned `SELECT *`.

Those projections must be replaced by explicit public fields before internal
candidate, reviewer, override, provenance, or error data is populated.

There is no Redis or application search cache to rebuild. The current
`all_community_data` view is not materialized, so the cache/index refresh stage
is currently a documented no-op.

## Compatibility risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Internal metadata leaking through `SELECT *` | Explicit public projections in the same release |
| Name collisions across schools or with groups | Match by identifiers/domain/geography; keep `official_name`; disambiguate only new display names |
| First UNITID backfill has no trusted identifier | Conservative domain and name/city/state matching; ambiguous rows go to reports/review |
| Deletes cascade through content and relationships | No delete operation exists in the pipeline |
| Automated rename breaks exact-name legacy code | Preserve IDs, keep aliases/former names, require strong identity and conflict checks |
| Admin edits are later overwritten | Store university admin edits as manual overrides, which always win |
| Existing forms omit `phone` | Update only fields actually submitted |
| Local logos are replaced by remote candidates | A non-placeholder `logo_path` is platform-approved and wins |
| Inactive schools disappear for current users | Filter only new-selection lists; detail-by-ID remains available |
| Pipeline metadata updates alter `updated_at` | Skip unchanged field writes; refresh timestamps change only for a completed source refresh |
| A source outage damages another source's work | Source-isolated stages and transactions |
| Concurrent refreshes race | MySQL advisory lock plus atomic runtime files |
| Migration runner is forward-only and naive | Additive SQL without leading comment chunks; separate documented rollback file |

The pre-migration UNITID audit found that `ipeds_unitid` did not yet exist, so
there were no stored UNITID values or duplicates to resolve. The new nullable
unique key therefore permits every existing NULL while preventing duplicate
non-NULL UNITIDs from the first backfill onward.

## Implementation phases

1. Add nullable columns to `communities`, explicit public projections, JSON
   validation, deterministic normalization/resolution, IPEDS download/import,
   conservative matching, idempotent field updates, locking, reports, and
   regression tests.
2. Add optional College Scorecard API enrichment, bulk Wikidata enrichment,
   Wikimedia logo/license metadata, candidate resolution, and mocked fixtures.
3. Add super-admin review actions on the same row, manual overrides, validation,
   export/status/retry commands, and cron-compatible schedules.
4. Add the disabled-by-default, official-domain-only crawler with robots,
   depth, request-count, MIME, size, and timeout protections.

No phase creates another institution, branding, provenance, candidate, override,
review, conflict, or import-history table.

## Added columns

The additive migration groups new fields into:

- trusted identifiers and structured directory data;
- scalar branding and logo-license selections;
- lifecycle, matching, refresh, review, and error state;
- bounded field-level provenance, confidence, verification, candidates,
  manual overrides, and row metadata in native JSON.

All added fields are nullable except the review flag, which safely defaults to
false. Group rows leave institution-only fields NULL. See the migration and the
configuration/JSON sections below for the exact list and semantics.

The exact added columns are:

```text
ipeds_unitid, wikidata_id, ope_id, official_name, former_names,
normalized_domain, address, city, state, zip, county, latitude, longitude,
institution_sector, institution_level, institution_control, accreditor,
degree_granting, operating_status, is_hbcu, is_tribal_college,
source_reporting_year, motto, slogan, nickname, logo_url,
logo_thumbnail_url, logo_type, logo_mime_type, logo_license_name,
logo_license_url, logo_attribution, logo_width, logo_height, first_seen_at,
last_seen_at, last_directory_refresh_at, last_branding_refresh_at,
last_logo_check_at, pipeline_active, pipeline_review_required,
pipeline_match_method, pipeline_match_confidence, pipeline_data_confidence,
pipeline_last_error, pipeline_last_error_at, pipeline_version,
data_sources_json, data_confidence_json, data_verified_json,
data_candidates_json, pipeline_metadata_json, manual_overrides_json
```

`college_scorecard_id` and `official_website` were not added: Scorecard `id`
is the IPEDS UNITID, and the existing `website` column already has the correct
meaning. `alternate_names` was not added because existing `aliases` is reused;
historical values use `former_names`. The existing local `logo_path` remains
the preferred platform-approved logo and is never repurposed as a remote URL.

The migration adds:

- a nullable unique key on `ipeds_unitid`;
- lookup indexes on OPE ID, Wikidata ID, and normalized domain;
- review and active-selection composite indexes.

No JSON document is indexed.

## Installation and migration

Deploy the explicit public projections and the additive migration in the same
release. The public projection helper detects absent pipeline columns, so old
rows and pre-migration requests retain their original shape during a rolling
deployment. University settings also continue working before the migration;
manual-override recording starts once its JSON column exists.

Preflight:

```bash
php backend/scripts/institution_data.php status
php backend/scripts/institution_data.php validate
```

Apply migrations with the existing deployment migration procedure. Do not run
the full migration runner casually from a developer checkout: it applies every
unrecorded migration in filename order. The institution migration is:

```text
backend/migrations/20260806_institution_pipeline.sql
```

After applying it:

```bash
php backend/scripts/institution_data.php validate
php backend/scripts/institution_data.php refresh --source ipeds --dry-run
```

Review the generated duplicate, unmatched, conflict, inactive, and insert
reports before the first write-enabled refresh.

The rollback SQL is
`backend/migrations/rollback/20260806_institution_pipeline.sql`. It removes
only columns and indexes introduced by this pipeline; it does not delete or
recreate any community row. Export first if pipeline metadata must be retained.
Rollback is not a substitute for restoring a database backup after a partially
failed deployment.

## Commands

The cron-safe entry point is:

```bash
php backend/scripts/institution_data.php refresh
php backend/scripts/institution_data.php refresh --source ipeds
php backend/scripts/institution_data.php refresh --source scorecard
php backend/scripts/institution_data.php refresh --source wikidata
php backend/scripts/institution_data.php refresh --source wikimedia
php backend/scripts/institution_data.php refresh --branding-only
php backend/scripts/institution_data.php refresh --state CT
php backend/scripts/institution_data.php refresh --unitid 100751
php backend/scripts/institution_data.php refresh --source ipeds --file /private/HD2024.zip
php backend/scripts/institution_data.php validate
php backend/scripts/institution_data.php resolve --dry-run
php backend/scripts/institution_data.php export --format csv
php backend/scripts/institution_data.php export --format json --include-inactive
php backend/scripts/institution_data.php status
php backend/scripts/institution_data.php retry-failures --limit 500
```

`refresh` is never called by a web endpoint. It takes both a non-blocking
filesystem lock and a MySQL advisory lock. Source stages are isolated; one
source failure does not roll back a previously committed source. Rows within a
source use transaction savepoints so one malformed/conflicting record is
reported without discarding unrelated safe updates.

`--dry-run` downloads, validates, normalizes, matches, resolves, and reports,
but does not write rows. `--file` is accepted only by IPEDS and is intended for
an official HD CSV/ZIP or a structurally equivalent fixture. The deprecated
`import_university_csv.php` now forwards to this safe path; the old
name-based `ON DUPLICATE KEY UPDATE` importer no longer exists.

`resolve` recalculates bounded review state after candidate/admin decisions. It
does not approve a source candidate, merge duplicate rows, or infer a missing
value. `retry-failures` processes rows with a stored refresh request/error and
a trusted UNITID. Rows without one remain reviewable rather than being matched
weakly.

`export` intentionally excludes internal candidates, reviewer identities,
manual notes, raw errors, and provenance documents. Add `--include-inactive`
when the export is intended for archival or relationship reconciliation.

Exit codes are `0` for success, `2` for a partial source run or failed
validation, `1` for operational failure, and `64` for invalid CLI usage.

## Configuration

All settings are read from the process environment (the existing root `.env`
loader is also used by CLI commands):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_GOV_API_KEY` | empty | Optional College Scorecard key; source skips cleanly when absent |
| `INSTITUTION_PIPELINE_USER_AGENT` | StudentSphere identifier | Descriptive outbound User-Agent |
| `INSTITUTION_PIPELINE_CONTACT_EMAIL` | empty | Optional valid operator contact |
| `INSTITUTION_PIPELINE_CACHE_PATH` | `backend/runtime/institution_pipeline/cache` | Private HTTP response cache |
| `INSTITUTION_PIPELINE_RAW_DATA_PATH` | `backend/runtime/institution_pipeline/raw` | Preserved source archive/manifest root |
| `INSTITUTION_PIPELINE_REPORT_PATH` | `backend/runtime/institution_pipeline/reports` | Private run reports and exports |
| `INSTITUTION_PIPELINE_REQUEST_TIMEOUT` | `30` | Per-request timeout in seconds |
| `INSTITUTION_PIPELINE_CONNECT_TIMEOUT` | `10` | Connection timeout, capped by request timeout |
| `INSTITUTION_PIPELINE_MAX_RETRIES` | `3` | Retries after the first request |
| `INSTITUTION_PIPELINE_MAX_RESPONSE_BYTES` | `50000000` | Global bounded response size |
| `INSTITUTION_PIPELINE_CANDIDATE_LIMIT` | `5` | Candidates retained per field |
| `INSTITUTION_PIPELINE_MAX_JSON_BYTES` | `262144` | Maximum bytes per row JSON document |
| `INSTITUTION_PIPELINE_CRAWLER_ENABLED` | `false` | Explicit official-site crawler switch |
| `INSTITUTION_PIPELINE_MAX_REQUESTS_PER_DOMAIN` | `10` | Conservative crawler domain budget |
| `INSTITUTION_PIPELINE_CRAWLER_MAX_DEPTH` | `2` | Internal-link depth |
| `INSTITUTION_PIPELINE_CRAWLER_MAX_FILE_BYTES` | `10000000` | Downloaded asset/PDF bound |

Runtime directories must be outside the public document root, writable only by
the deployment/worker account, and excluded from source control. API keys are
removed from URLs before logs, cache metadata, errors, or reports are written.

## Sources and mappings

### IPEDS

NCES/IPEDS HD directory archives are the canonical record source. The adapter
discovers the latest official `HDYYYY.zip`, validates ZIP signatures, entry
paths, compressed/uncompressed sizes, CSV headers and row widths, and streams
the matching `HDYYYY.csv`. Downloaded bytes and a SHA-256 manifest are
preserved in the configured raw directory.

Default mappings include UNITID, institution name and aliases, street/city/
state/ZIP/county, coordinates, website, telephone, OPE ID, sector, level,
control, degree-granting, HBCU, tribal-college, directory status, closure, and
reporting year. Mappings are adapter configuration rather than hardcoded write
assignments so future column names can be replaced in one map.

Only a successful, unfiltered, unlimited IPEDS snapshot can mark a previously
known UNITID as missing from the current release. Even then, the row is merely
flagged for review; it is never deleted or automatically merged.

### College Scorecard

College Scorecard is an optional secondary federal cross-check for name,
website/domain, geography, ownership/control, operating state, accreditor,
OPE/federal codes, and UNITID. Requests are paginated, cached, bounded, and
filterable by state/UNITID. If `DATA_GOV_API_KEY` is empty, the stage records a
clean skip and the rest of the refresh continues.

### Wikidata

Wikidata is queried in batches by exact IPEDS identifier (`P1771`), never one
request per school. It can contribute a QID, website/domain, motto, nickname,
coordinates, official color candidates, logo/seal filenames, and parent/system
review metadata. Referenced statements are classified separately from
unreferenced statements. Parent values never alter
`parent_community_id`, which remains a platform relationship.

### Wikimedia Commons

Commons filenames returned by Wikidata are sent to the batched MediaWiki
Imageinfo API. The pipeline records original/thumbnail URL, MIME type,
dimensions, author/attribution, license name/URL, file identity, restrictions,
and logo type. A remote logo is selectable only when the configured
machine-readable license policy permits redistribution and any required
attribution is present. Unknown/restricted candidates stay in bounded review
JSON and never replace a local platform upload.

Institutional logos, seals, and wordmarks are distinct from athletics logos.
Athletics candidates are non-selectable unless explicitly approved. Trademark
restrictions are separate from copyright licensing; an open file license does
not imply permission to suggest sponsorship or affiliation.

### College colours (English Wikipedia)

`Module:College_color/data` (CC BY-SA 4.0) carries primary/secondary/tertiary
hex values for about 1,550 athletics programmes, roughly 98% of them citing an
official brand guide.

It is keyed by team name ("Alabama Crimson Tide"), never by institution, so a
name comparison against the directory would be guesswork. Each team is instead
resolved through Wikidata — the team item's **P1268 ("represents")** points at
its university, which carries **P1771 (IPEDS UNITID)** — giving an exact
identifier match. On the current data 1,111 of 1,552 teams resolve to a UNITID
and 1,073 of those exist in this table.

Values are classified `third_party_dataset` (0.50). Most cite a brand guide, but
the pipeline is trusting Wikipedia's transcription rather than reading the guide
itself, so the lower confidence is deliberate: it fills empty colours and never
displaces IPEDS, an official page, or a manual override. Because the seeded
`#0077B5`/`#005F8D` pair is treated as a legacy placeholder rather than a real
value, those rows count as empty.

The module's second colour slot is frequently plain white, which is a contrast
choice rather than a brand colour; when that happens the third slot becomes the
secondary. Every candidate records its originating team name and whether the
entry was cited, so a reviewer can see that a colour came from an athletics
palette — usually identical to the institutional one, but not guaranteed.

Third-party colour lists that cannot show their provenance are out of scope.
`frishberg/University-Hex-Colors` was evaluated and rejected: 548 of its 2,639
values are model-written sentences such as "The main hex color code of … is not
specified in the provided sources", indicating the set was generated rather than
compiled, and it declares no license.

### Official-site enrichment

The optional crawler is disabled by default. It is restricted to the already
verified normalized institution domain, honors `robots.txt`, uses only
same-domain internal links, and enforces request count, depth, MIME, redirect,
timeout, and file-size limits. It may inspect sitemap entries, HTML metadata,
JSON-LD, manifests, CSS/SVG declarations, and linked public brand PDFs.

It does not authenticate, bypass blocks, solve challenges, execute arbitrary
site scripts, or follow off-domain download redirects. Homepage colors are
candidates, not official facts. A CSS/SVG value is promoted only with brand
context; otherwise it remains an inference at lower confidence. PDF text/image
extraction depends on locally available safe tooling and is reported as
unsupported when that tooling is absent.

## Field ownership and source priority

`FieldPolicy.php` is the write allowlist. Source adapters return candidate
envelopes and never mass-assign source objects into PDO updates. The repository
may write only policy-managed scalar columns, the six JSON documents, and
explicit pipeline state columns. It always scopes updates by both internal
`id` and `community_type = 'university'`.

Priority order:

| Source classification | Base priority |
| --- | ---: |
| Manual verified / platform approved / official brand guide | 1.00 |
| Existing protected platform value | 0.97 |
| Official institution page / IPEDS | 0.95 |
| College Scorecard | 0.90 |
| Official CSS or SVG | 0.85 |
| Referenced Wikidata / Wikimedia Commons | 0.80 |
| Official-logo color extraction | 0.70 |
| Unreferenced Wikidata | 0.65 |
| Third-party dataset | 0.50 |
| Inferred webpage value | 0.40 |

Selection also considers institution-match confidence, verification, source
agreement, current selected quality, and conflict distance. NULL candidates
never clear an existing scalar. Existing local logos and non-placeholder
legacy colors are protected as platform data. The old generic importer colors
`#0077B5` and `#005F8D` are recognized as placeholders, not official branding.

The existing display `name` is stable for matched rows. A changed federal name
updates `official_name`, adds a display-name candidate/review reason, and
preserves aliases/former names. New rows use the official name where globally
available; unavoidable duplicate official names are qualified with city/state
or UNITID because the legacy table has a global unique name constraint.

Colors selected for scalar fields are uppercase six-digit hex. Three/six-digit
hex, RGB/RGBA, HSL and supported CSS names normalize deterministically. Pantone
text is retained as a candidate unless a cited conversion source and
approximation metadata exist; the pipeline does not invent a conversion.

Motto, slogan, and tagline remain separate fields. A historical motto does not
replace a campaign slogan, and an inferred homepage phrase does not become a
verified tagline.

## Matching and lifecycle

The conservative matcher evaluates:

1. exact UNITID;
2. exact trusted OPE or Wikidata ID;
3. exact normalized official domain;
4. exact normalized name plus city and state;
5. high-threshold fuzzy name with exact city/state and a clear score margin;
6. review/unmatched.

The first backfill can read city/state from the trailing shape of the legacy
`location` display string only for matching; it does not promote that parsed
text into structured columns. Conflicting trusted identifiers always stop
automatic matching. Unrelated names on one domain, geographic conflicts, and
close fuzzy candidates go to the potential-duplicate report.

A shared domain is not by itself evidence of a duplicate: multi-campus systems
publish one domain for every campus. When a domain resolves to several rows the
matcher narrows that candidate set by exact normalized name, city, and state
(reported as `domain_name_city_state`). Only when that cannot single out one row
does the record go to review as `domain_ambiguous`. Narrowing never widens a
match — it applies the same exact evidence step 4 uses to an already
domain-confirmed subset. On the current production data this is the difference
between 4,506 and 5,557 matched institutions.

Field comparison ignores pure formatting. A phone number is compared as digits
without a US country code, and `location`/`address` are compared without case or
punctuation, so `(256) 372-5000` and `2563725000` are one value rather than a
source conflict. Real differences — a changed street number, an added ZIP+4 —
still register and are still reported.

Only a valid IPEDS record with UNITID, name, and state can create a new row.
No secondary enrichment source can create an institution. Internal IDs come
from the existing ID generator and are never derived from external IDs.

Explicit active/closed/merged status is stored, but ambiguous source status
does not deactivate a row. A closed row remains available through detail-by-ID
APIs and existing user/community relationships. Discovery and new-selection
queries use `COALESCE(pipeline_active, 1) = 1`. Merges are never automatic:
administrators can record `duplicate_of`, `not_duplicate`, or `defer` review
metadata without moving relationships or deleting either row.

## Row JSON formats

Every JSON column is a top-level object, application-validated, recursively
bounded, deterministically encoded, and size-limited.

Selected source:

```json
{
  "website": {
    "source_type": "ipeds",
    "source_url": "https://nces.ed.gov/ipeds/",
    "source_record_id": "100751",
    "retrieved_at": "2026-08-06T00:00:00Z"
  }
}
```

Confidence and verification:

```json
{
  "data_confidence_json": {
    "website": 0.95
  },
  "data_verified_json": {
    "primary_color": {
      "verified": true,
      "verified_by": "u_internal_id",
      "verified_at": "2026-08-06T00:00:00Z"
    }
  }
}
```

Candidate:

```json
{
  "logo_url": [
    {
      "value": "https://upload.wikimedia.org/example.svg",
      "source_type": "wikimedia_commons",
      "source_url": "https://commons.wikimedia.org/wiki/File:Example.svg",
      "confidence": 0.8,
      "selected": false,
      "status": "license_review",
      "reason": "license_missing_or_unrecognized"
    }
  ]
}
```

Manual override:

```json
{
  "primary_color": {
    "value": "#9E1B32",
    "source_url": "https://example.edu/brand",
    "notes": "Verified against the current public brand guide.",
    "verified_by": "u_internal_id",
    "verified_at": "2026-08-06T00:00:00Z",
    "expires_at": null
  }
}
```

Pipeline metadata:

```json
{
  "last_ipeds_import": "2026-08-06T00:00:00Z",
  "match_method": "unitid",
  "match_score": 1.0,
  "review_reasons": [],
  "source_versions": {
    "ipeds": "2024"
  },
  "source_fingerprints": {
    "ipeds": "sha256..."
  }
}
```

Candidate identity excludes retrieval time, so rerunning the same source value
refreshes one candidate rather than appending duplicates. Retention favors the
selected value, reviewed decisions, and strongest recent alternatives.

## Administrative review

The super-admin route renders `InstitutionDataReview.js`. Its two endpoints
re-read the current database role rather than trusting a cached session role:

```text
GET  /api/fetch_institution_reviews.php
POST /api/institution_review_action.php
```

The interface can filter review/error/missing/refresh-request rows, inspect
selected values and sources, approve/reject bounded candidates, set/clear
manual overrides, mark fields verified, request a focused background refresh,
and record duplicate decisions. Web requests only store refresh intent; they
never execute external source work.

A rejected lower-confidence candidate only raises a review flag when it differs
from the kept value in a way a reviewer could act on. A secondary source
restating the same site with a different scheme or `www.`, or placing a campus a
few hundred metres away, is agreement in substance; the resolver still keeps the
stronger federal value and still records the alternative in
`data_candidates_json`, but does not queue the row. Coordinates are treated as
agreeing within 0.01° (~1.1 km) for this purpose only — the stored value is
never loosened. On the first production enrichment this distinguished 14 real
conflicts from 8,695 restatements.

Review reasons are seeded from the row so an administrator's outstanding items
survive a refresh, but every reason the current run recomputes is cleared first
and re-added only if it still applies. A field conflict that a later source
release resolves therefore leaves the queue on its own, while reasons the run
did not re-evaluate (another source's fields, `source_error:*`,
`missing_from_current_ipeds_release`) are left untouched. Without this the queue
grows monotonically and every institution ends up permanently flagged.

A manual approval updates the scalar and the source, confidence, verification,
candidate, override, and review metadata on the same `communities` row in one
transaction. Ordinary university settings edits are also recorded as
platform-approved manual values after the migration. Clearing an override
removes its precedence and flags the field for review; it does not guess a
replacement.

## Public API and search compatibility

Public community APIs use `PublicProjection.php`, an explicit allowlist. They
retain every original community field and add selected institution fields,
`selected_logo_url`, `institution_type`, and `is_active`. They never expose
source payloads, candidates, reviewer IDs, manual notes, pipeline metadata, or
pipeline errors.

List/search/autocomplete paths prioritize active universities. Groups are
unaffected. Detail endpoints do not apply the active filter, ensuring existing
profiles and relationships can still display a closed institution. The former
per-request `CREATE OR REPLACE VIEW` in the university list endpoint was
removed; direct indexed queries preserve the response fields without web
requests performing schema DDL.

There is no materialized application search index or Redis cache in this
repository. Consequently the pipeline's cache/index refresh stage is a no-op;
the next database-backed request immediately sees committed selected values.

## Reports, raw files, and recovery

Each refresh creates a private run directory containing:

```text
pipeline-run-summary.json
inserted-institutions.csv
updated-institutions.csv
unmatched-source-records.csv
conflicting-values.csv
potential-duplicates.csv
inactive-institutions.csv
missing-branding.csv
logo-license-issues.csv
failed-requests.csv
```

Reports use atomic summary publication and locked streaming CSV handles. Run
history is deliberately filesystem-based; no run, conflict, candidate, source,
or review table is created. Raw official downloads have checksums/manifests in
the configured private raw directory. Retention, backup, encryption, and
rotation are deployment responsibilities.

Recovery procedure:

1. Run `status` and inspect the newest summary/failed-request report.
2. Correct credentials, network policy, source mappings, permissions, or disk
   space without editing stored institution IDs.
3. Use a filtered dry run (`--source`, `--state`, or `--unitid`).
4. Review proposed conflicts/duplicates.
5. Re-run the filtered write command or `retry-failures`.
6. Run `validate`.

Never clear a failure by deleting an institution. A source outage is retried
with exponential backoff; an exhausted source remains isolated from successful
stages.

## Scheduling

The repository has no application scheduler or queue, so the integration point
is its existing deployment crontab. A ready-to-adapt example is:

```text
backend/scripts/institution_data.crontab.example
```

It schedules a monthly canonical refresh, weekly Commons metadata check,
quarterly branding enrichment, and daily focused retries. Use absolute paths,
a private log destination, and the same environment as the web deployment.
The built-in lock is still required even when the scheduler also uses `flock`.

The official-site crawler should target only missing, stale, low-confidence,
explicitly requested, or broken-logo records. Do not enable it until the
deployment has reviewed its User-Agent/contact, egress policy, robots behavior,
storage retention, and source/trademark policy.

## Adding another free source

1. Implement `SrpInstitutionSourceInterface` under
   `backend/includes/institution_data/Sources`.
2. Return the standard source envelope with all six match keys, normalized
   field candidates, source URL/record ID/retrieval time/confidence, and bounded
   metadata. Never retain API credentials or full raw person-related payloads.
3. Add only its permitted fields/source classification to `FieldPolicy.php`.
4. Give it a bulk/filterable strategy, deterministic cache keys, timeouts,
   response-size limits, retries, rate limits, response validation, and mocked
   fixtures.
5. Register it in **four** places, or it fails quietly: the class map in
   `scripts/institution_data.php`, the `$allowedSources` allowlist in
   `CommandOptions.php`, and both the `branding_only` and default source lists
   in `Pipeline::selectedSources()`. A name missing from the allowlist makes
   `--source <name>` print the help text rather than report an unknown source.
6. Document license/terms, failure behavior, refresh cadence, and precedence.
7. Verify that it cannot insert rows unless it is an official canonical
   directory source with an equally strong identity contract.

Paid data, scraping bypasses, and generative guesses are out of scope.

## Known limitations

- No source can prove that two existing internal rows should be merged without
  application-specific relationship review; the system records a decision but
  never performs that merge.
- IPEDS reporting releases lag real-world openings, renames, and closures.
- Wikidata coverage/reference quality and Commons license metadata are uneven.
- A freely licensed image can still carry institutional trademark restrictions.
- Remote images can disappear; local verified uploads remain preferred.
- Official colors may be published only in proprietary guides or Pantone; the
  pipeline leaves those scalar colors missing rather than inventing hex values.
- Safe PDF text/image extraction depends on tools installed by the deployment.
- The existing global unique `communities.name` constraint requires display
  qualification for legitimately same-named campuses.
- A refresh request without a trusted UNITID stays in admin review.
- NCES throttles the IPEDS data-center pages under repeated access. When
  discovery fails, rerun with `--file` against the preserved archive under
  `backend/runtime/institution_pipeline/raw/ipeds/`; the run records
  `discovered_via: local_file` and is otherwise identical.
- Rows whose IPEDS `IALIAS` blob was stored as a single legacy alias entry are
  repaired on import by splitting on the documented `/` separator. Short
  fragments (under two characters) are dropped rather than indexed as names.

Missing data is an acceptable result. Incorrect identity, branding, status, or
licensing data is not.
