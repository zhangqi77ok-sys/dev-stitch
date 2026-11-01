# Design — Dev Stitch

## Overview

Slice 1 is a frontend-only Next.js app. All data is seeded and all crew
work is deterministic local logic, so the demo runs with zero services.
Later slices keep the same item shape and swap each seam for a live one:
seed loader → live ingest, local crew notes → model calls, draft text →
optional authenticated GitHub writes (only with the user's explicit key
and approval, never by default).

## Architecture

```
app/page.js        Client component: filters, queue, approve action
app/layout.js      Shell + metadata
app/globals.css    Dark console theme, no UI framework
lib/seed.js        Seeded items + draftIssue/draftPatch generators
docs/samples/      Bundled local-doc samples referenced by doc items
.kiro/specs/       Kiro spec documents (this project)
.kiro/steering/    Product / tech / structure guidance
.kiro/hooks/      Hook configs (declared; enforced in later slices)
```

## Components and Interfaces

### Item (the stable contract)

```ts
type Item = {
  id: string;                 // e.g. "gh-001"
  title: string;
  source: "github" | "rss" | "docs";
  sourceDetail: string;
  triage: { cls: string; priority: "P0" | "P1" | "P2" | "P3"; score: number; reason: string };
  research: { summary: string; context: string };
  critic: { verdict: "pass" | "flag"; note: string };
};
```

Every future ingester MUST produce items in this shape; every future
crew implementation MUST fill the three role blocks. The UI never depends
on where an item came from beyond `source`.

### Crew pipeline (slice 1: local, deterministic)

1. **Triage** — class + priority + score + reason (seeded).
2. **Researcher** — summary + context (seeded).
3. **Critic** — verdict + note; a `flag` verdict must name what blocks
   trust (slice 1 rule: flags never silently pass).

### Draft generation

`draftIssue(item)` and `draftPatch(item)` are pure string templates.
They produce text only. Slice 1 has no transport for drafts; download
links use `data:` URIs.

## Data Flow

```
seed items → sort by score desc → filter (source/state) → card
approve click → approved state → draftIssue + draftPatch rendered
```

No state leaves the browser in slice 1. Persistence (slice 2) will use
localStorage first, then an optional server store.

## Correctness

- Sorting is stable: score descending, then id ascending on ties
  (implemented by the sort in `app/page.js` over seeded order).
- A `flag` critic verdict is always visible on the card; it never
  hides behind the approve button.
- The demo banner always states the data is seeded and that approval
  has no side effects.

## Testing

- `npm run build` must pass (Next.js production build, the slice 1 gate).
- Manual check: load the page, filter each source, approve one item of
  each critic verdict, download both draft files, confirm contents match
  the on-screen text.
- Later slices add: unit tests for draft generators, and property-based
  tests that every ingested item carries all three crew blocks.
