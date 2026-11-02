# 🧵 Dev Stitch

A multi-agent triage console for developers — **Kiroween 2026,
Frankenstein track**.

Dev Stitch stitches three incompatible sources — public GitHub repos,
RSS feeds, and local docs — into **one prioritized action queue**.
A Kiro Crew of three specialist roles works each item:

- **Triage** — classify + prioritize (class, P0–P3, score, reason)
- **Researcher** — summarize + add context
- **Critic** — challenge + verify (pass / flag, with a note)

You approve items. Approving generates a **draft issue and a draft patch
outline as downloadable text** — the app never writes to GitHub on your
behalf.

## Demo (zero setup)

```bash
npm install
npm run dev     # open http://localhost:3000
npm run build   # production build check
npm test        # 25 unit + property tests, zero dependencies
```

**Seeded demo mode** is the default: every item on the page is bundled
sample data. No accounts, no keys, no network calls, no GitHub writes.
Filter by source (GitHub / RSS / Local docs) or by queued / approved,
approve any card, and download its draft issue and draft patch.

## What works in slice 1

- Next.js app (App Router, plain JS, no UI framework)
- 6 seeded items across all three sources, sorted by triage score
- Crew notes on every card: Triage, Researcher, Critic
- Approve → draft issue + draft patch outline, both downloadable
- `.kiro/` specs, steering docs and hooks config at the repo root,
  committed and **not** gitignored (Kiroween requirement)
- MIT licensed

## What works in slice 2 (new)

- Live GitHub ingestion: enter `owner/repo`, fetch open issues/PRs from
  the public unauthenticated API (read-only, no key, no writes), with
  rate-limit status shown from the response headers and a friendly
  message when the limit is exhausted
- Live RSS/Atom ingestion: paste any feed URL; entries are parsed in
  the browser (CDATA, tag-stripping, entity decoding) and mapped to the
  same Item shape; per-feed failures (bad URL, CORS-blocked feed,
  unparsable markup) are shown inline and never break the page
- Local docs: upload a `.md`/`.txt` file or paste markdown; sections
  carrying gap signals (TODO / FIXME / XXX / TBD / outdated /
  deprecated / retired / no longer) become doc items — a clean doc adds
  nothing, gap detection does not invent work
- Approvals persist in `localStorage` (key `dev-stitch-approvals-v1`)
  and survive a refresh; "Clear stored approvals" wipes them
- Export queue as JSON (items + approvals) for handoff elsewhere
- Live triage is a deterministic keyword heuristic, not a model call —
  every live card's Critic note says so, and the mapping is covered by
  `npm test` (17 tests, zero dependencies, Node built-in runner)
- Seeded demo mode is unchanged and still works with no network at all

## What is still NOT done (slice 3)

- No model calls — crew notes are deterministic local content
  (live triage is a keyword heuristic; see slice 2 notes above)
- No GitHub writes of any kind
- Kiro hooks do not fire yet (hook config is present, wiring is slice 3)

See `.kiro/specs/dev-stitch/tasks.md` for slice 3.

## What works in slice 3 (new)

- Model crew behind a server route: `POST /api/crew` calls
  gemini-3.8-flash (current free generation model; older flash models
  return 404) with the key from the `DEV_STITCH_GEMINI_API_KEY`
  server environment variable. The key never reaches the browser,
  is never bundled, never logged, never committed.
  - `GET /api/crew` reports `{ modelConfigured: boolean }` so the UI
    can show model availability without revealing anything.
  - With no key the route answers 503 and the UI keeps the slice 2
    heuristic + seeded demo — judges with no account run everything.
  - Model replies are untrusted input: `lib/crew.js` validates every
    field (class, priority, score 0–100, verdict, non-empty strings)
    and a bad reply degrades to the heuristic instead of a broken card.
    The prompt treats item text as data, never as instructions.
  - No per-IP rate limit on `/api/crew` (demo scope): do not expose a
    keyed deployment publicly beyond judging; the static Pages demo has
    no route and cannot spend anything.
  - Run it with: `DEV_STITCH_GEMINI_API_KEY=your-key npm run dev`
    (server mode only — the static Pages export has no `/api/crew`
    and runs heuristic-only, like no-key mode).
- Kiro hooks fire as code: triage-on-ingest rejects ingested records
  missing a crew block (and reports the count), and the critic gate
  blocks approval of a flagged item until you tick the explicit
  override checkbox.
- Optional authenticated issue creation, default off: in an approved
  card, open "Create GitHub issue (optional)", enter owner/repo + a
  token, and tick the confirmation. The panel warns this posts a REAL
  public issue (GitHub has no draft issues). The token lives only in
  page state, is cleared after every attempt, and is never stored.
- Tests: `npm test` now runs 25 tests (17 slice 2 + 8 slice 3:
  prompt shape, parser accept/reject, enhance, critic gate, hook gate).
- Static demo export: `bash scripts/build-pages.sh` builds the static
  export (temporarily moving `app/api` aside, since static export
  refuses route handlers) and pushes it to the `gh-pages` branch.
  Enabling Pages itself is a manual repo-settings step.
- Demo video + Devpost draft: see `docs/devpost-submission-draft.md`
  (draft text only — nothing submitted, video not uploaded, Pages not
  enabled; the pending publish steps are listed there).

## What is still NOT done (after slice 3)

- No Kiro IDE/CLI runs yet (see honest Kiro status below)
- No automatic GitHub writes — issue creation stays explicit per item
- No YouTube upload, no Devpost submission, no Pages enable (all
  pending publish confirmations, listed in the Devpost draft)

## Honest Kiro status (read this before judging)

The `.kiro/` artifacts in this repo — specs (`requirements.md`,
`design.md`, `tasks.md`), steering docs, and the `triage-on-ingest`
hook config — were **authored in Kiro format by the agent** building
this slice.

**What Kiro has NOT done (yet):** Kiro IDE / Kiro CLI have not run,
built, or tested this project. No Kiro credits have been claimed or
used for this slice, and no Kiro model generated this code. Kiro
IDE/CLI usage is **pending the Kiroween 4000-credits approval**; when
that lands, the crew roles and hooks will be wired to real Kiro runs
and this section will be updated to say exactly what ran.

**What changed in slice 3:** the hook configs are now implemented as
running application code (ingest gate + critic gate, see above) — but
that code was still written by the agent, not by a Kiro run. Nothing
in this repo claims otherwise.

## Project layout

```
app/            Next.js pages (layout, queue UI, live-source panel, styles)
app/api/crew/   Server-only model route (key in server env, never bundled)
lib/            Seed data + draft generators (pure, no browser needed)
lib/ingest.js   Live ingestion: GitHub mapper, RSS parser, doc gap
                detection, triage heuristic, Item validator (pure)
lib/crew.js     Model crew: prompt, strict reply parser, critic gate,
                triage-on-ingest hook as code (pure)
test/           Unit + property tests (node:test, zero dependencies)
docs/samples/   Bundled local-doc samples for demo doc items
docs/devpost-submission-draft.md   Submission text (draft only, not submitted)
scripts/build-pages.sh   Static export -> gh-pages branch (branch push only)
.kiro/
  specs/dev-stitch/   requirements.md, design.md, tasks.md
  steering/           product.md, tech.md, structure.md
  hooks/              triage-on-ingest.json, critic-gate.json
```

## License

MIT — see [LICENSE](LICENSE).
