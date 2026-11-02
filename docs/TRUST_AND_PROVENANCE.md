# Content trust and provenance

StudentSphere separates three questions that were previously easy to confuse:

1. **Who is the author?** Profile identity verification says a student or staff
   connection was reviewed. It does not make every statement official.
2. **What perspective is this?** Each answer is described as student experience,
   alumni experience, professional guidance, official institutional information,
   or a community suggestion.
3. **Was this answer reviewed?** An authorized community moderator can review a
   specific answer, record a source and note, and choose a 90-, 180-, or 365-day
   review window. An expired window is shown publicly as potentially outdated.

## Public labels

| Label | Meaning |
| --- | --- |
| Student experience | A current or prospective student is describing lived experience; it may not apply to everyone. |
| Alumni experience | A former student is describing past experience; procedures may have changed. |
| Professional guidance | A person is presenting professional, mentor, or staff experience; users should confirm binding requirements. |
| Official institutional information | The answer is authorized to speak for the named institution or program. This label must be selected deliberately by an authorized reviewer. |
| Community suggestion | A community member is offering a suggestion rather than an official or universal answer. |

The API derives a default perspective from the author's onboarding audience when
no explicit perspective is stored. This default never derives “Official
institutional information.” Existing StudentSphere editorial guides are marked
as professional guidance and retain their supporting sources in the guide body.

## Review rules

- Existing community moderation permissions control who can review an answer.
- Review records include reviewer, review date, applicable community, optional
  source name/URL, optional reviewer note, and the next review date.
- Removing verification clears the review record but keeps the perspective and
  source fields so provenance is not silently discarded.
- Readers can report content as outdated, unclear, misinformation, or incorrect
  for the named institution.
- A content review is not a permanent guarantee. The interface always explains
  that requirements and policies can change.

## Data fields

Migration `20261102_content_provenance.sql` adds the provenance and review fields
to `posts`. `fetch_posts.php` returns normalized labels, descriptions, and a
`review_status` of `unreviewed`, `reviewed`, or `stale` to both web and mobile.
