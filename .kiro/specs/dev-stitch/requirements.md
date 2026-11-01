# Requirements — Dev Stitch

## Introduction

Dev Stitch is a multi-agent triage console for developers. It stitches
three incompatible sources — public GitHub repositories, RSS feeds, and
local docs — into one prioritized action queue. A Kiro Crew of three
specialist roles works each item: Triage (classify + prioritize),
Researcher (summarize + add context), Critic (challenge + verify).
The user approves items, and the app emits draft issues/patches as
downloadable text. Seeded demo mode must let anyone run end-to-end with
bundled sample data and no accounts or keys.

## Glossary

- **Item**: one unit of work from any source (issue, feed entry, doc gap).
- **Crew**: the three roles (Triage, Researcher, Critic) applied to an item.
- **Queue**: the single prioritized list the user works through.
- **Draft**: generated text (issue or patch outline). Drafts never write
  anywhere unless the user explicitly takes them out of the app.

## Requirements

### Requirement 1: One prioritized queue from three sources

**User Story:** As a developer, I want GitHub issues, RSS entries and
local-doc gaps in one list, ranked, so I stop checking three places.

#### Acceptance Criteria

1. WHEN the app loads in demo mode, THEN it SHALL show items from all
   three sources (github, rss, docs) without any account or key.
2. WHEN items are listed, THEN they SHALL be sorted by triage score
   descending.
3. WHEN the user filters by source or by approved/queued state, THEN only
   matching items SHALL be shown.

### Requirement 2: Three-role crew notes on every item

**User Story:** As a developer, I want each item to carry a
classification, a summary with context, and a verification note, so I can
trust the ranking before acting.

#### Acceptance Criteria

1. WHEN an item is displayed, THEN it SHALL show a Triage class, a
   priority (P0–P3), a numeric score and a reason.
2. WHEN an item is displayed, THEN it SHALL show a Researcher summary
   and a context note.
3. WHEN an item is displayed, THEN it SHALL show a Critic verdict
   (pass or flag) and a note.

### Requirement 3: Approve produces draft text, never a side effect

**User Story:** As a developer, I want approving an item to hand me a
draft issue and a draft patch I can use elsewhere, without the app
writing to GitHub on my behalf.

#### Acceptance Criteria

1. WHEN the user approves an item, THEN the item SHALL move to the
   approved state and reveal a draft issue and a draft patch outline.
2. WHEN drafts are shown, THEN each SHALL be downloadable as a plain
   text file.
3. WHEN the app runs in slice 1, THEN it SHALL NOT make any network
   write (no GitHub API writes, no PR creation, no external POST).

### Requirement 4: Seeded demo mode works with zero setup

**User Story:** As a hackathon judge, I want to run the app and see the
full loop in under a minute, with no accounts, keys or setup.

#### Acceptance Criteria

1. WHEN a judge runs `npm install && npm run dev`, THEN the queue SHALL
   render with seeded items and no error.
2. WHEN a judge runs `npm run build`, THEN the build SHALL pass.
3. WHEN a judge approves any item, THEN draft outputs SHALL appear
   without any external service.

### Requirement 5: Kiro artifacts live at the repo root and are honest

**User Story:** As a judge, I want to see how Kiro was used, stated
honestly, so the entry can be evaluated on its real tooling.

#### Acceptance Criteria

1. WHEN the repo is inspected, THEN a `.kiro/` directory SHALL exist at
   the root containing specs, steering docs and hooks config.
2. WHEN `.gitignore` is inspected, THEN it SHALL NOT list `.kiro`.
3. WHEN the README is read, THEN it SHALL state plainly which Kiro
   usage is real and which is still pending, with no fabricated claim
   that Kiro built or ran anything it did not.
