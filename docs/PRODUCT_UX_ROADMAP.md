# StudentSphere product and UX roadmap

This document translates the platform's gap-closing mission into an actionable
product backlog. It is a roadmap, not a record of currently implemented
features. Check an item only after its acceptance criteria are satisfied on web
and, where applicable, mobile.

## Product direction

> Users should not need to understand StudentSphere's structure before
> StudentSphere can help them.

The experience should be organized around four questions:

1. What does the person need help with?
2. What useful answer or resource already exists?
3. Who is qualified to help?
4. What should the person do next?

### Product principles

- [ ] Organize entry points around needs, answers, trust, and next steps rather
  than feeds, forums, software terminology, or internal content types.
- [ ] Preserve forums and communities as the underlying participation model,
  but do not require users to understand that structure to find help.
- [ ] Measure whether people move forward, not only views, votes, follows, or
  time spent on the platform.
- [ ] Use short interface language for routine actions and layered explanation
  for privacy, verification, financial information, policies, and other
  high-trust decisions.
- [ ] Design for people who do not know the educational term for what they need.
- [ ] Treat accessibility, translation, family support, and plain language as
  core functionality rather than optional polish.

## P0 — Reframe onboarding around user needs

### Replace software-oriented signup language

- [x] Replace “account creation and setup wizard” language with a benefit-led
  introduction such as “Find answers, guidance, and people who can help.”
- [x] Replace internal or nonconsecutive step numbering with a visible,
  accessible “Step X of 4” progress indicator.
- [x] Replace “Choose your role” with “What brings you to StudentSphere?”
- [x] Replace internal audience labels such as “Prospect” with plain-language
  choices:
  - I'm exploring schools or programs.
  - I'm currently enrolled.
  - I previously attended or graduated.
  - I'm supporting a student or family member.
  - I work for a school or educational organization.
  - I'm a mentor, professional, or community resource.
- [x] Allow users to choose more than one reason when their circumstances
  overlap.
- [x] Confirm that these audience choices remain separate from authorization
  roles and permissions.

**Acceptance criteria**

- Signup never exposes the terms “setup wizard,” “role-based questions,” or
  “feed personalization.”
- Every step has a clear title, a short explanation, Back/Continue controls,
  keyboard support, and an announced validation state.
- Users can understand each audience choice without prior knowledge of the
  platform or higher-education terminology.

### Replace interest-first onboarding with needs-first onboarding

- [x] Change “Select interests to personalize your feed” to:
  “What would you like help navigating? Choose any that apply. You can change
  these later.”
- [x] Present needs such as:
  - Applying to a school or program
  - Understanding financial aid
  - Finding scholarships
  - Paying for school
  - Choosing a program or major
  - Housing, food, or transportation
  - Academic support
  - Disability and accessibility services
  - Mental health and wellbeing
  - Student rights or institutional policies
  - Internships and careers
  - Finding people who understand my experience
  - I'm not sure where to start
- [x] Map these user-facing needs to the existing tag and community system
  behind the scenes instead of exposing internal categorization.
- [x] Make institution selection optional and inclusive of universities,
  community colleges, graduate programs, trade schools, and other pathways.

**Acceptance criteria**

- “I'm not sure where to start” always remains available.
- A user can continue without selecting an institution.
- Selected needs produce a useful starting experience rather than merely
  changing feed ranking.

### Reduce initial signup friction

- [x] Require only the information necessary to create and secure an account.
- [x] Move city, state, skills, extended biography, and similar profile fields
  into optional profile completion.
- [x] Explain why any personal information is requested before collecting it.
- [x] Move identity/institution verification out of initial signup.
- [ ] Introduce verification later, after explaining its benefit, badge,
  review process, document access, retention, and deletion policy.
- [x] Add persistent field labels, examples, visible requirements, inline
  validation, and accessible error summaries.
- [x] Make guest exploration available and clearly labeled where product and
  privacy rules permit it.

### End onboarding with immediate value

- [x] Replace a generic “You're all set” ending with a personalized starting
  point containing:
  - Up to three relevant guides or answers
  - One or two relevant communities
  - A relevant verified representative, ambassador, or mentor when available
  - A prominent “Ask your question” action
- [x] Offer profile completion and verification only after showing these
  results.
- [x] Define sensible fallback content when personalization has insufficient
  data.

## P0 — Reorganize the primary experience

### Make the home page task-oriented

- [x] Lead with “What are you trying to figure out?” rather than a generic
  Explore action or engagement feed.
- [ ] Provide one combined entry field for asking a question or searching for
  guidance.
- [ ] Add an “I'm not sure where to start” guided pathway.
- [x] Show common help areas such as financial aid, scholarships, admissions,
  housing and food, student rights, accessibility, and careers.
- [x] Present personalized next steps before general engagement content.
- [x] Provide four clear platform actions:
  - Find an answer
  - Ask a question
  - Explore my school or program
  - Meet people who can help

### Simplify navigation language

- [x] Test replacing scholarly or internally meaningful navigation terms with
  plain-language labels:
  - Home
  - Guides & Answers
  - Communities
  - Events
  - Saved
- [x] Preserve brand character through visual design and editorial voice rather
  than requiring users to decode labels such as “Academic Commons,” “Reading
  Room,” or “Discussion Index.”
- [x] Ensure web and mobile use the same public terminology.

### Rewrite login and welcome messaging

- [x] Shift login copy away from following, saving, profile building, and feed
  behavior toward the outcome:
  “Get clear answers about education from students who have lived it,
  professionals who understand it, and verified representatives who can clarify
  the facts.”
- [x] Update the welcome experience so ambassadors are one helpful pathway,
  not the platform's only or default destination.
- [x] Review all empty states and calls to action for benefit-led, plain-language
  wording.

## P1 — Build the answer and guidance layer

### Guided Ask

- [ ] Accept questions written in ordinary language.
- [ ] Suggest relevant existing answers and guides before creating a duplicate.
- [ ] Infer or ask for the relevant institution, topic, and educational stage.
- [ ] Route new questions into the appropriate underlying community/forum.
- [ ] Show whether potential responders are students, alumni, professionals,
  ambassadors, or verified institutional staff.
- [ ] Escalate unanswered questions to an appropriate ambassador or
  representative after a defined period.
- [ ] Let the user correct automated topic or institution suggestions.
- [ ] Define safe handling for urgent, legal, medical, mental-health, and
  institution-specific questions that require professional support.

**Acceptance criteria**

- Users can ask for help without choosing a forum first.
- Existing useful information is offered without blocking the user from asking.
- The final destination and responder context are visible to the user.
- Routing failures and unanswered questions feed the gap-detection system.

### Universal, answer-oriented search

- [ ] Search across questions, responses, guides, resources, institutions,
  communities, scholarships, events, and people who can help.
- [ ] Group results by user purpose rather than only by database content type.
- [ ] Add filters for institution, topic, audience, answer source, language, and
  freshness without making filters necessary for a useful first result.
- [ ] Highlight verified and recently reviewed information without suppressing
  clearly labeled lived experience.
- [ ] Record searches that produce no useful result, while minimizing the
  collection of sensitive query data.

### Trust and provenance

- [ ] Define and display distinct labels for:
  - Student or alumni lived experience
  - Official institutional information
  - Professional guidance
  - Community suggestions
  - Verified answers
- [ ] Show what each verification badge means at the point of use.
- [ ] Add “last reviewed,” applicable institution, author perspective, and
  source links where appropriate.
- [ ] Establish review and expiration rules for time-sensitive information.
- [ ] Allow users to report information as outdated, unclear, or institutionally
  inaccurate.
- [ ] Avoid presenting lived experience as universal fact or official guidance.

## P1 — Turn resources into practical next steps

### Structured resource guidance

- [ ] Ensure every resource can answer:
  - Who is this for?
  - What does it help with?
  - What do I need?
  - Does it cost anything?
  - What is the deadline?
  - What should I do first?
  - Who can help if I get stuck?
  - Is it available in my language?
- [ ] Let users save resources to a personal checklist or action plan.
- [ ] Support reminders for deadlines and user-selected next steps.
- [ ] Mark stale, unavailable, or unverified resources clearly.

### Warm handoffs

- [ ] When StudentSphere cannot answer directly, provide the correct office or
  organization, contact method, what to ask, what to prepare, and what to expect.
- [ ] Connect users to a relevant community member when appropriate and with
  consent.
- [ ] Track whether the handoff helped the user move forward.
- [ ] Avoid generic external links without context or a next action.

### Family and supporter pathways

- [ ] Create a dedicated supporter path for parents, guardians, siblings,
  translators, caregivers, and other trusted people.
- [ ] Provide plain-language explanations designed for supporters rather than
  repurposing student-facing copy.
- [ ] Prioritize translated guidance for high-impact processes such as
  applications, financial aid, enrollment, housing, and student support.
- [ ] Define consent and privacy boundaries when supporters assist a student.

## P2 — Detect and close knowledge gaps

### Knowledge-gaps dashboard

- [ ] Record privacy-conscious signals for:
  - Searches with no useful results
  - Repeated unanswered questions
  - Institutions with little coverage
  - Topics with outdated guidance
  - Questions repeatedly redirected elsewhere
  - Users reporting that they still do not know what to do
- [ ] Build a dashboard for authorized ambassadors, staff, and administrators.
- [ ] Rank gaps by frequency, urgency, affected audience, and age.
- [ ] Allow an authorized person to claim a gap, publish an answer/resource, and
  mark the gap resolved.
- [ ] Prevent the dashboard from exposing sensitive user questions or identity
  beyond what is necessary to resolve the gap.

### Resolution-oriented feedback

- [ ] Add lightweight prompts:
  - Did this answer your question?
  - Do you know what to do next?
  - Were you connected to the right person?
  - Is anything still unclear?
- [ ] Distinguish “helpful content” from “issue resolved.”
- [ ] Use unresolved feedback to improve answers, routing, and gap reports.
- [ ] Define mission-aligned product metrics before optimizing the experience.

### Privacy-sensitive participation

- [ ] Research controlled anonymous or pseudonymous questions for immigration,
  finances, discrimination, disability, mental health, and institutional
  complaints.
- [ ] Complete a threat, abuse, moderation, retention, and legal review before
  implementation.
- [ ] Prevent anonymity from bypassing platform safety controls.
- [ ] Clearly communicate to users what is hidden from the community, what is
  visible to moderators, and what records are retained.

## Cross-cutting design and content work

### Visual hierarchy

- [ ] Preserve the calm, credible, welcoming academic identity.
- [ ] Establish the visual order: need → answer → person → next step.
- [ ] Prioritize legibility, accessible forms, responsive layouts, immediate
  feedback, and good defaults over decorative animation.
- [ ] Use motion only when it clarifies progress, hierarchy, state, or feedback.
- [ ] Validate light/dark themes, zoomed layouts, mobile breakpoints, keyboard
  navigation, screen readers, reduced motion, and color contrast.

### Content design system

- [ ] Create a terminology guide for public labels, internal labels, roles,
  verification states, and educational terms.
- [ ] Establish plain-language and translation review standards.
- [ ] Define reusable patterns for explaining why information is requested and
  what happens after submission.
- [ ] Audit signup, login, welcome, navigation, empty states, verification,
  notifications, and error messages against the terminology guide.
- [ ] Avoid promising scholarships, multilingual coverage, mentorship, or
  institutional authority before the corresponding feature is operational.

## Delivery sequence

- [ ] **Milestone 1 — Language and onboarding:** Complete the P0 signup copy,
  field, progress, audience, needs, and verification-timing changes.
- [ ] **Milestone 2 — Task-oriented home:** Ship the new home hierarchy,
  plain-language navigation, common help areas, and immediate next steps.
- [ ] **Milestone 3 — Answers and trust:** Ship Guided Ask, universal search,
  answer provenance, review dates, and outdated-information reporting.
- [ ] **Milestone 4 — Actionable support:** Ship structured resources, personal
  action plans, warm handoffs, and supporter pathways.
- [ ] **Milestone 5 — Gap-closing operations:** Ship resolution feedback,
  knowledge-gap detection, and the authorized dashboard.
- [ ] **Milestone 6 — Sensitive participation:** Consider anonymous or
  pseudonymous participation only after the required safety review.

## Definition of done for each milestone

- [ ] Product behavior and user-facing language are documented.
- [ ] Web and mobile behavior are intentionally aligned or differences are
  documented.
- [ ] Authorization and privacy rules are enforced by the backend, not only the
  interface.
- [ ] Loading, empty, error, offline, and insufficient-data states are designed.
- [ ] Accessibility checks and keyboard testing pass.
- [ ] Relevant automated tests and API permission tests pass.
- [ ] Analytics measure resolution without collecting unnecessary sensitive
  data.
- [ ] Documentation reflects what is actually implemented.
- [ ] The change is tested in development before promotion to production.

## Primary implementation surfaces

These are starting points, not an exhaustive file list:

- `frontend/src/components/SignUp.js`
- `frontend/src/components/Login.js`
- `frontend/src/components/WelcomeOverlay.js`
- `frontend/src/components/Feed.js`
- `frontend/src/components/LeftSidebar.js`
- `frontend/src/components/SearchResults.js`
- `frontend/src/components/AccountSettings.js`
- `mobile/app/` and `mobile/components/`
- `backend/public/` for search, routing, resources, feedback, and gap reporting
- `backend/includes/` for shared authorization and provenance rules
- `backend/migrations/` for reviewed schema changes

