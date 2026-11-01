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

## What slice 1 does NOT do (yet)

- No live GitHub API or RSS ingestion (seeded data only)
- No persistence (approvals live in page state only)
- No model calls — crew notes are deterministic local content
- No GitHub writes of any kind

See `.kiro/specs/dev-stitch/tasks.md` for slices 2 and 3.

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
app/            Next.js pages (layout, queue UI, styles)
lib/            Seed data + draft generators (pure, no browser needed)
docs/samples/   Bundled local-doc samples for demo doc items
.kiro/
  specs/dev-stitch/   requirements.md, design.md, tasks.md
  steering/           product.md, tech.md, structure.md
  hooks/              triage-on-ingest.json
```

## License

MIT — see [LICENSE](LICENSE).
