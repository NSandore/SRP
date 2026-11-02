# Account deletion and recovery

StudentSphere uses a two-stage account-deletion lifecycle.

## Recoverable deletion

When a signed-in user requests deletion from **Account Settings → Data &
account**, the API requires both the current password and the typed phrase
`DELETE MY ACCOUNT` in the interface.

The account immediately becomes `pending`:

- all sessions are revoked;
- the profile is hidden from profile and people-search endpoints;
- author names and avatars become `Deleted User` and the defaults;
- posts, threads, and other public contributions remain available;
- the original email and remaining account data are retained for 30 days;
- the user can recover the account by signing in with the prior credentials.

An attempted signup with the retained email receives the remaining recovery
days. After proving ownership with the prior password, the person can either
recover the account or force its permanent deletion before creating a new one.

## Permanent purge

The nightly `purge_deleted_accounts.php` job purges accounts whose recovery
window has ended. Force deletion invokes the same purge immediately.

The purge:

- replaces the email with a unique `@deleted.invalid` address, releasing the
  original email for registration;
- replaces the password with an unknown random value;
- clears profile, verification, settings, session, relationship, saved-item,
  vote, private-message, and notification data;
- removes custom profile avatar and banner files while preserving media attached
  to the public contributions that remain;
- removes verification documents when their stored paths still exist;
- keeps the user row and public contributions so database relationships remain
  intact and attribution continues to display as `Deleted User`;
- erases the recovery snapshot.

## Minimal audit tombstone

After purge, `account_deletion_records` retains the original internal user ID,
request/purge timestamps, whether deletion was forced, and HMAC-SHA-256
fingerprints of the email and request IP. The HMAC uses `APP_ENCRYPTION_KEY`.
Plaintext email, IP, password, and profile data are not retained in this record.

The fingerprint can confirm whether a specifically supplied value matches a
record, but it is not intended to reconstruct the original value. This is a
technical audit design, not a complete legal-retention or subpoena-response
policy; those policies still require review by qualified counsel.

## Operations

- Migration: `backend/migrations/20261031_account_deletion.sql`
- Purge worker: `backend/scripts/purge_deleted_accounts.php`
- Cron example: `backend/scripts/account-deletion.crontab.example`
- API: `backend/public/account_lifecycle.php`

Production activation explicitly applies this feature's required migration and
installs the nightly cron entry after both health checks pass. Other pending
migrations remain governed by the normal `SRP_RUN_MIGRATIONS` opt-in.
