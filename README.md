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
npm test        # 17 unit + property tests, zero dependencies
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

Nothing in this repo claims otherwise.

## Project layout

```
app/            Next.js pages (layout, queue UI, live-source panel, styles)
lib/            Seed data + draft generators (pure, no browser needed)
lib/ingest.js   Live ingestion: GitHub mapper, RSS parser, doc gap
                detection, triage heuristic, Item validator (pure)
test/           Unit + property tests (node:test, zero dependencies)
docs/samples/   Bundled local-doc samples for demo doc items
.kiro/
  specs/dev-stitch/   requirements.md, design.md, tasks.md
  steering/           product.md, tech.md, structure.md
  hooks/              triage-on-ingest.json
```

## License

MIT — see [LICENSE](LICENSE).
