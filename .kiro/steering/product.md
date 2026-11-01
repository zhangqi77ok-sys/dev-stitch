# Product steering

Dev Stitch is a triage console, not another dashboard. One queue, ranked,
with the reasoning visible. If a ranking cannot explain itself in one
sentence (the Triage reason), it does not ship.

Rules:
- The user is the approver. The app never acts on a repo without an
  explicit approve per item.
- Drafts are text. Text can be inspected, edited and discarded; that is
  the safety model for slice 1.
- Demo first: any feature that breaks the zero-setup demo does not land
  until the demo path is fixed.
- Honesty about tooling: README and specs say exactly what Kiro did and
  did not do. No borrowed credibility.
