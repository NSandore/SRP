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

The compact feedback prompt is shown only on knowledge-base entries whose
content kind is `article`. It is intentionally omitted from ordinary
discussions, guide landing pages, and section pages on both web and mobile.

Positive feedback remains in `content_resolution_feedback` for measurement but
does not create an administrative work item. Existing unresolved feedback is
backfilled by `20261103_knowledge_gaps.sql`.

The search endpoint also aggregates searches that return no results. It stores
no user, session, or IP reference; obvious email addresses, links, phone
numbers, and long identifiers are replaced before the normalized phrase is
stored. A phrase enters the global administrator queue after three occurrences.
One-off aggregates that remain below that threshold expire after 30 days.

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
`/admin/knowledge-gaps`, review every community, assign eligible administrators
or community ambassadors, add private administrator notes, and make the final
resolved decision.

Ambassadors can open the same route, but the backend restricts their queue to
communities where they have an active ambassador record. They can claim an
unassigned gap for themselves, add contributor notes and a proposed resolution
link, and move it to `Ready for review`. They cannot see global administrator
notes, assign work to another person, access another community's gaps, or mark
a gap resolved. A gap already assigned to someone else is read-only to them.

Global moderators do not receive dashboard access unless they are also an
ambassador for the relevant community.

The review dashboard is intentionally web-only in this release because it is
an administrative workspace. No public mobile navigation is added or removed;
mobile parity should be reconsidered if moderation workflows are later brought
into the mobile application.

## Visual gap overview

The top of the dashboard includes a privacy-safe `Gaps that need closing`
overview. It aggregates unresolved work by public topic/forum or by community
and splits each bar into `Open`, `In progress`, and `Ready for review` segments.
It also highlights the most frequently selected missing-information reason.

The overview and review queue share the same community filter. Global
administrators can select any community represented in the gap data;
ambassadors receive only communities within their authorized scope. The chart
contains aggregate counts only and never exposes reporter identity or private
feedback text.

The queue uses a transparent, deterministic priority score rather than AI.
Frequency contributes up to 40 points, age up to 30, affected-audience reach
up to 25, and unresolved-feedback severity up to 45. A global administrator can add an explicit priority
(`Critical`, `High`, `Normal`, or `Low`), an affected audience, and an urgency
rationale. The dashboard displays the point breakdown and supports filtering by
priority, source, assignment, and several deterministic sort orders. New gaps
remain `Needs triage` until an administrator classifies them.

Each gap moves through:

1. `Open`
2. `In progress`
3. `Ready for review`
4. `Resolved`

Ambassadors contribute the proposed improvement, while global administrators
retain final review authority. Reporter identity is not displayed at either
level.

The sidebar shows the number of unresolved gaps available within the viewer's
authorized scope. In-app notifications are sent when work is assigned, when an
ambassador submits a proposed resolution for review, when it is returned for
another update, and when it is marked resolved. A weekly digest is deliberately
not part of this release; scheduling and per-user digest preferences need a
separate design.

## Current scope

This release covers unresolved answer feedback and repeated searches that
returned no useful result. Search gaps are global because no institution is
inferred from the query; only global administrators can review them. Future
roadmap work may add unanswered questions, thin institution coverage, outdated
guidance, and repeated redirections. Those signals should enter the same queue
without weakening the privacy boundary.
