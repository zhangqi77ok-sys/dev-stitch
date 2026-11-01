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

## Slice 2 — Live ingestion + persistence (planned)

- [ ] Public GitHub API reader (unauthenticated, rate-limit aware) that
      maps real issues/PRs into the Item shape
- [ ] RSS parser for user-supplied feed URLs (client-side fetch, CORS-safe
      defaults, graceful failure per feed)
- [ ] Local docs: upload or paste markdown, gap-detected into doc items
- [ ] localStorage persistence for approvals; export queue as JSON
- [ ] Unit tests for draft generators; property test: every item has all
      three crew blocks

## Slice 3 — Real crew + safe writes (planned)

- [ ] Wire Triage / Researcher / Critic to model calls behind the same
      Item interface (provider key supplied by the user, never bundled)
- [ ] Kiro hooks actually firing: triage-on-ingest on new items,
      critic-gate blocking approve on unreviewed flags unless overridden
- [ ] Optional authenticated GitHub draft-issue creation, behind an
      explicit user approval step per item (default off)
- [ ] Demo video (<3 min) + submission write-up for Devpost

## Out of scope (deliberate)

- No automatic GitHub writes, no auto-merge, no background daemons.
- No user accounts, no server database, no tracking in slice 1.
- No Kiro Web usage (paid tier); Kiro IDE/CLI usage awaits credits
  approval and is stated as pending in the README.
