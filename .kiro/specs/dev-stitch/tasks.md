# Tasks — Dev Stitch

## Slice 1 (this delivery) — DONE

- [x] Next.js app scaffold (App Router, plain JS, no UI framework)
- [x] Seeded demo data: 6 items across github / rss / docs
- [x] Queue UI: sort by score, filter by source and approved/queued
- [x] Crew notes on every card: Triage, Researcher, Critic
- [x] Approve action revealing draft issue + draft patch outline, both
      downloadable as text; zero network writes
- [x] `.kiro/` specs, steering and hooks config at repo root, NOT gitignored
- [x] MIT LICENSE, README with honest Kiro status
- [x] `npm run build` passes; public GitHub repo created and pushed

## Slice 2 — Live ingestion + persistence (DONE, slice 2 delivery)

- [x] Public GitHub API reader (unauthenticated, rate-limit aware) that
      maps real issues/PRs into the Item shape
- [x] RSS parser for user-supplied feed URLs (client-side fetch, CORS-safe
      defaults, graceful failure per feed)
- [x] Local docs: upload or paste markdown, gap-detected into doc items
- [x] localStorage persistence for approvals; export queue as JSON
- [x] Unit tests for draft generators; property test: every item has all
      three crew blocks

## Slice 3 — Real crew + safe writes (DONE, slice 3 delivery)

- [x] Wire Triage / Researcher / Critic to model calls behind the same
      Item interface (server route /api/crew, key in server env only,
      strict reply validation, heuristic fallback with no key)
- [x] Kiro hooks actually firing: triage-on-ingest on new items,
      critic-gate blocking approve on unreviewed flags unless overridden
- [x] Optional authenticated GitHub draft-issue creation, behind an
      explicit user approval step per item (default off)
- [x] Demo video (<3 min) + submission write-up for Devpost
      (video file + script in the delivery dir, Devpost text in
      docs/devpost-submission-draft.md; upload/submission/Pages-enable
      are pending publish confirmations, NOT done in slice 3)

## Out of scope (deliberate)

- No automatic GitHub writes, no auto-merge, no background daemons.
- No user accounts, no server database, no tracking in slice 1.
- No Kiro Web usage (paid tier); Kiro IDE/CLI usage awaits credits
  approval and is stated as pending in the README.
