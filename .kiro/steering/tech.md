# Tech steering

- Next.js App Router, plain JavaScript (no TypeScript in slice 1).
- No UI framework, no CSS framework: one hand-written stylesheet.
- No backend in slice 1: no API routes, no database, no server secrets.
- No dependencies beyond Next.js + React. Every new dependency must
  justify itself against the zero-setup demo.
- Data contract: the `Item` shape in `.kiro/specs/dev-stitch/design.md`
  is stable. Ingesters and crew implementations adapt to it, not the
  other way around.
- Secrets rule: no credentials, tokens or keys anywhere in the repo.
  Provider keys, if ever added, come from the user's environment at
  runtime and are never committed.
