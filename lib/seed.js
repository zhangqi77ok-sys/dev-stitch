// Seeded demo data for Dev Stitch slice 1.
//
// Every item is BUNDLED SAMPLE DATA — no network calls, no accounts, no keys.
// In later slices, live ingestion (public GitHub API, RSS fetch, local docs)
// will produce items in exactly this shape. The three crew roles are pure
// functions here; a future slice wires them to real model calls behind the
// same interface.

export const SEED_ITEMS = [
  {
    id: "gh-001",
    title: "Prototype pollution in lodash.merge via crafted config file",
    source: "github",
    sourceDetail: "Sample issue from a public repo tracker (seeded)",
    triage: {
      cls: "security",
      priority: "P0",
      score: 98,
      reason:
        "Security class + remotely triggerable data corruption. Beats every other item on blast radius.",
    },
    research: {
      summary:
        "A crafted config file can pollute Object.prototype through lodash.merge, affecting every downstream consumer that merges untrusted input.",
      context:
        "Same pattern as past merge-pollution CVEs. Mitigation is a one-line guard plus a regression test; no API change needed.",
    },
    critic: {
      verdict: "pass",
      note: "Claim checks out: the vulnerable call site exists in the seeded sample and the fix does not change public behaviour.",
    },
  },
  {
    id: "gh-002",
    title: "Flaky CI: checkout job fails intermittently on cache restore",
    source: "github",
    sourceDetail: "Sample issue from a public repo tracker (seeded)",
    triage: {
      cls: "bug",
      priority: "P1",
      score: 74,
      reason:
        "Blocks merges several times a week. High frequency, but no user-facing impact and a known workaround (retry).",
    },
    research: {
      summary:
        "Cache-restore step races with a concurrent job writing the same cache key; rerunning the job usually passes.",
      context:
        "Fix options: scope the cache key per job, or add a lock. Both are small; the lock is safer for shared runners.",
    },
    critic: {
      verdict: "flag",
      note: "Flagged: the 'just retry' workaround hides real failures. Do not close this as flaky-without-fix; require the key-scoping change.",
    },
  },
  {
    id: "rss-001",
    title: "React 19.2 release notes: performance work worth adopting",
    source: "rss",
    sourceDetail: "Sample feed entry (seeded)",
    triage: {
      cls: "upgrade",
      priority: "P2",
      score: 52,
      reason:
        "Useful but not urgent: an upgrade evaluation, not a defect. No deadline attached.",
    },
    research: {
      summary:
        "The release improves Suspense-related rendering paths and ships a smaller bundle for server components.",
      context:
        "Worth a trial upgrade in a branch; check the breaking-change list for the custom renderer first.",
    },
    critic: {
      verdict: "pass",
      note: "No overclaim: the summary sticks to the release notes and names the one check that must happen before adoption.",
    },
  },
  {
    id: "rss-002",
    title: "Node.js 24 enters LTS: what changes for our runtime pin",
    source: "rss",
    sourceDetail: "Sample feed entry (seeded)",
    triage: {
      cls: "upgrade",
      priority: "P2",
      score: 48,
      reason:
        "LTS status reduces upgrade risk, but the current pin is supported for months. Schedule, don't rush.",
    },
    research: {
      summary:
        "Node 24 is now LTS, so the team can move the runtime pin on the next planned maintenance window.",
      context:
        "Check native-module rebuilds and the minimum OpenSSL version before moving production traffic.",
    },
    critic: {
      verdict: "pass",
      note: "Correctly framed as scheduled work, not an emergency. The OpenSSL check is the right gate.",
    },
  },
  {
    id: "doc-001",
    title: "On-call runbook: database failover steps are out of date",
    source: "docs",
    sourceDetail: "Bundled sample doc: docs/samples/db-failover-runbook.md",
    triage: {
      cls: "docs",
      priority: "P1",
      score: 71,
      reason:
        "Stale failover steps are a latent incident risk: the doc is read exactly when things are already broken.",
    },
    research: {
      summary:
        "The runbook still names the retired primary host and omits the new promotion command added last quarter.",
      context:
        "Fix is a doc-only edit plus a drill. No code change, but verify the promotion command against staging first.",
    },
    critic: {
      verdict: "flag",
      note: "Flagged: do not merge the doc edit until someone runs the promotion command in staging — an untested runbook is worse than a stale one.",
    },
  },
  {
    id: "gh-003",
    title: "Feature request: dark mode for the settings page",
    source: "github",
    sourceDetail: "Sample issue from a public repo tracker (seeded)",
    triage: {
      cls: "feature",
      priority: "P3",
      score: 31,
      reason:
        "Nice to have, no functional gap, no deadline. Lowest priority by design.",
    },
    research: {
      summary:
        "Users ask for a dark theme on the settings page for late-night use; the design tokens already exist elsewhere in the app.",
      context:
        "Small effort, but it competes with P0/P1 work. Queue it behind the security and reliability items.",
    },
    critic: {
      verdict: "pass",
      note: "Priority is honest: the item is real but correctly ranked last.",
    },
  },
];

// Draft outputs are generated locally from templates. They are TEXT ONLY:
// slice 1 never writes to GitHub, never opens a PR, never sends anything.
export function draftIssue(item) {
  return [
    `Title: ${item.title}`,
    ``,
    `Source: ${item.source} — ${item.sourceDetail}`,
    `Triage: ${item.triage.cls} / ${item.triage.priority} (score ${item.triage.score})`,
    `Reason: ${item.triage.reason}`,
    ``,
    `Summary (Researcher):`,
    item.research.summary,
    ``,
    `Context:`,
    item.research.context,
    ``,
    `Critic check: ${item.critic.verdict.toUpperCase()} — ${item.critic.note}`,
    ``,
    `Suggested next step: assign an owner and open a branch for this item.`,
  ].join("\n");
}

export function draftPatch(item) {
  return [
    `# Draft patch outline for ${item.id} — ${item.title}`,
    `# Generated locally from the seeded triage result. NOT applied anywhere.`,
    ``,
    `# 1. Reproduce / confirm`,
    `#    - ${item.research.summary}`,
    ``,
    `# 2. Change`,
    `#    - TODO: implement the fix described in the draft issue`,
    `#    - Keep the change minimal; add a regression test first`,
    ``,
    `# 3. Verify`,
    `#    - ${item.critic.note}`,
    `#    - Run the affected test suite before requesting review`,
    ``,
    `--- a/placeholder`,
    `+++ b/placeholder`,
    `@@ -0,0 +1,3 @@`,
    `+# TODO: replace this outline with the real diff`,
    `+# Triage: ${item.triage.cls} / ${item.triage.priority}`,
    `+# Critic: ${item.critic.verdict}`,
  ].join("\n");
}

export function downloadHref(text) {
  if (typeof window === "undefined") return "#";
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}
