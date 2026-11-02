# Devpost submission draft — Dev Stitch (Frankenstein track)

> DRAFT ONLY. This file is the submission text ready to paste. Nothing
> has been submitted to Devpost, no video has been uploaded to YouTube,
> and GitHub Pages has not been enabled — those three publish steps are
> listed at the bottom as pending confirmations.

## Project name

Dev Stitch

## Tagline

Three incompatible developer sources, one prioritized action queue.

## Description

Developers triage the same work in three places that never agree:
public GitHub issues, RSS feeds, and local docs. Dev Stitch stitches
them into one prioritized action queue. A crew of three specialist
roles works every item — Triage classifies and scores it, Researcher
summarizes and adds context, Critic challenges it and can block
approval with a flag — and you approve items to generate a draft issue
and a draft patch outline as downloadable text.

What works today:

- **Seeded demo mode**: six bundled items across all three sources.
  No accounts, no keys, no network — judges run the whole flow
  offline.
- **Live sources**: public GitHub repos (unauthenticated, read-only,
  rate-limit aware), RSS/Atom feeds (tolerant parser, per-feed
  errors), and local markdown docs (gap detection: only sections
  carrying TODO / FIXME / outdated-style signals become items; a clean
  doc adds nothing).
- **Approvals persist** in the browser (localStorage) and the queue
  exports as JSON for handoff.
- **Model crew (optional)**: when the server has a model key, the
  keyword heuristic blocks are replaced with real model output through
  a server route — the key never reaches the browser. With no key,
  the heuristic and seeded demo keep working unchanged.
- **Safety by default**: approving only generates draft text. Creating
  a real GitHub issue is an explicit, per-item, opt-in step behind a
  confirmation checkbox, and the panel warns it posts a real public
  issue (GitHub has no draft issues). No automatic writes, no
  auto-merge, no background daemons.

## How Kiro was used (honest statement)

- **Specs**: `.kiro/specs/dev-stitch/` (requirements, design, tasks)
  drove all three slices; slice scope and the out-of-scope list come
  from the spec, not from after-the-fact description.
- **Steering**: `.kiro/steering/` (product, tech, structure) fixed the
  architecture: plain-JS Next.js, pure-function lib, zero-dependency
  tests, no server database.
- **Hooks**: `.kiro/hooks/triage-on-ingest.json` and
  `.kiro/hooks/critic-gate.json` are implemented as running code, not
  config: every ingested batch passes a crew-block validation gate
  (incomplete records are rejected and reported), and a flagged item
  cannot be approved until the user explicitly overrides the flag.
- **Property-based testing**: every item must carry all three crew
  blocks with valid enums and score ranges — asserted by
  `npm test` (25 tests, Node built-in runner, zero dependencies).
- **What Kiro did NOT do**: Kiro IDE / Kiro CLI have not run, built,
  or tested this project, and no Kiro credits have been claimed or
  used. The `.kiro/` artifacts were authored in Kiro format by the
  agent building the slices. Kiro IDE/CLI usage is pending the
  Kiroween 4000-credits approval; when that lands, the crew roles
  will be wired to real Kiro runs and this section will be updated to
  say exactly what ran. Nothing here claims otherwise.

## Links (pending publish steps — see below)

- Public repo: https://github.com/zhangqi77ok-sys/dev-stitch
- Demo URL: https://zhangqi77ok-sys.github.io/dev-stitch/ (PENDING:
  gh-pages branch is pushed; Pages must be enabled in repo Settings
  -> Pages -> Deploy from branch gh-pages)
- Demo video: under 3 minutes (PENDING: file produced locally, not yet
  uploaded to YouTube)
- Test credentials: none needed — seeded demo mode runs with no account.

## Pending publish confirmations (NOT done in slice 3)

1. Upload the demo video to YouTube (public, under 3 minutes) and
   paste the link above.
2. Submit this text on Devpost (Kiroween 2026, Frankenstein track)
   with the repo link, demo URL, and video link.
3. Enable GitHub Pages: repo Settings -> Pages -> Deploy from branch
   `gh-pages`, then verify the demo URL serves the app.
