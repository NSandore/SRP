# Knowledge gaps dashboard

The Knowledge Gaps Dashboard turns private resolution feedback into an
operational queue for authorized global administrators. It is intentionally a
human review workflow; it does not use AI to interpret, rank, or rewrite user
feedback.

## How a gap is created

`submit_content_feedback.php` creates a `knowledge_gaps` record when any of the
following is true:

- The answer was not helpful.
- The user's issue was only partly resolved or not resolved.
- The user is unsure of the next step or does not know the next step.

Positive feedback remains in `content_resolution_feedback` for measurement but
does not create an administrative work item. Existing unresolved feedback is
backfilled by `20261102_knowledge_gaps.sql`.

## Privacy boundary

The database keeps the source user reference so one feedback response cannot
create duplicate work items. The administrative API deliberately omits that
identifier, along with the person's name, email, profile, and other account
details. Reviewers see only the feedback signals, optional missing-information
note, and the content being reviewed.

Optional notes can still contain information a user chose to type. Reviewers
should use only what is necessary to improve the guidance and must not copy
private details into public answers.

## Access and workflow

Global administrators and super administrators can open
`/admin/knowledge-gaps` and can be selected as assignees. Global moderators do
not receive dashboard access in the first release.

The review dashboard is intentionally web-only in this release because it is
an administrative workspace. No public mobile navigation is added or removed;
mobile parity should be reconsidered if moderation workflows are later brought
into the mobile application.

Each gap moves through:

1. `Open`
2. `In progress`
3. `Resolved`

Reviewers can assign an authorized team member, record internal resolution
notes, and link the updated StudentSphere answer or an authoritative external
resource. Reporter identity is not displayed.

## Current scope

This first release covers unresolved answer feedback. Future roadmap work may
add privacy-conscious signals for unsuccessful searches, unanswered questions,
thin institution coverage, outdated guidance, and repeated redirections. Those
signals should enter the same queue without weakening the privacy boundary.
