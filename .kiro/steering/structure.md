# Structure steering

```
app/            Next.js App Router pages (layout, page, styles)
lib/            Pure logic: seed data, draft generators
docs/samples/   Bundled local-doc samples for demo doc items
.kiro/
  specs/dev-stitch/   requirements.md, design.md, tasks.md
  steering/           product.md, tech.md, structure.md
  hooks/              hook configs (JSON)
```

Conventions:
- `lib/` modules are pure and importable without a browser.
- UI state lives in the page component; no global store in slice 1.
- File names are lowercase with dashes. Docs are Markdown.
- `.kiro/` is source, not generated output: it is committed, reviewed
  and never gitignored.
