// Tests for lib/seed.js draft generators + lib/ingest.js live ingestion.
// Zero dependencies: node:test + node:assert only. Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { SEED_ITEMS, draftIssue, draftPatch } from "../lib/seed.js";
import {
  triageForText,
  validateItem,
  makeLiveItem,
  mapGitHubIssue,
  parseRss,
  mapRssEntry,
  decodeEntities,
  splitDocSections,
  detectDocGaps,
} from "../lib/ingest.js";

// --- draft generators ------------------------------------------------------

test("draftIssue contains title, source, triage, researcher and critic", () => {
  for (const item of SEED_ITEMS) {
    const out = draftIssue(item);
    assert.ok(out.includes(item.title), "title");
    assert.ok(out.includes(item.source), "source");
    assert.ok(out.includes(item.triage.cls), "triage class");
    assert.ok(out.includes(item.triage.priority), "priority");
    assert.ok(out.includes(item.research.summary), "researcher summary");
    assert.ok(out.includes(item.critic.verdict.toUpperCase()), "critic verdict");
  }
});

test("draftPatch contains id, title, triage and critic", () => {
  for (const item of SEED_ITEMS) {
    const out = draftPatch(item);
    assert.ok(out.includes(item.id), "id");
    assert.ok(out.includes(item.title), "title");
    assert.ok(out.includes(item.triage.cls), "triage class");
    assert.ok(out.includes(item.critic.verdict), "critic verdict");
    assert.ok(out.includes("TODO"), "outline is explicitly a TODO outline");
  }
});

test("draft generators never claim to have written anywhere", () => {
  for (const item of SEED_ITEMS) {
    assert.ok(!/opened a PR|created an issue|pushed to/i.test(draftIssue(item)));
    // The patch outline explicitly disclaims application.
    assert.ok(draftPatch(item).includes("NOT applied anywhere"));
  }
});

// --- property: every item has all three crew blocks ------------------------

test("property: every seed item validates", () => {
  assert.equal(SEED_ITEMS.length, 6);
  for (const item of SEED_ITEMS) assert.ok(validateItem(item), item.id);
});

test("property: every live-mapped item validates", () => {
  const gh = mapGitHubIssue(
    {
      number: 42,
      title: "Prototype pollution via crafted config",
      body: "A crafted config pollutes Object.prototype through merge.",
      html_url: "https://github.com/example/repo/issues/42",
      comments: 3,
      labels: [{ name: "security" }],
    },
    "example/repo"
  );
  const rss = mapRssEntry(
    {
      title: "Node.js 24 enters LTS",
      link: "https://example.com/node-24-lts",
      pubDate: "Mon, 01 Jan 2026 00:00:00 GMT",
      description: "Node 24 is now LTS, so teams can move the runtime pin.",
    },
    "https://example.com/feed.xml",
    0
  );
  const docs = detectDocGaps("# Runbook\n\n## Failover\n\nTODO: update the primary host name.\n");
  const all = [gh, rss, ...docs];
  assert.ok(all.length >= 3, "all three live sources produced items");
  for (const item of all) assert.ok(validateItem(item), item && item.id);
});

test("validateItem rejects broken shapes", () => {
  assert.equal(validateItem(null), false);
  assert.equal(validateItem({ id: "x" }), false);
  const noCritic = makeLiveItem({
    id: "t-1",
    title: "Something",
    source: "rss",
    sourceDetail: "test",
    bodyText: "Some body text long enough to pass the critic length check.",
  });
  assert.ok(validateItem(noCritic));
  assert.equal(validateItem({ ...noCritic, critic: null }), false);
  assert.equal(validateItem({ ...noCritic, triage: { ...noCritic.triage, score: 101 } }), false);
});

// --- triage heuristic ------------------------------------------------------

test("triage classifies security / bug / upgrade keywords", () => {
  assert.equal(triageForText({ title: "CVE-2026: XSS vulnerability in parser", body: "" }).cls, "security");
  assert.equal(triageForText({ title: "CI crash on cache restore", body: "" }).cls, "bug");
  assert.equal(triageForText({ title: "React 19.2 release notes", body: "" }).cls, "upgrade");
  assert.equal(triageForText({ title: "Weekly team sync notes", body: "No keywords here." }).cls, "task");
  assert.equal(triageForText({ title: "CVE in parser", body: "" }).priority, "P0");
});

test("triage does not misclassify 'fallback' as a failure", () => {
  assert.equal(
    triageForText({ title: "Keep the server Suspense fallback when browser-only content", body: "" }).cls,
    "task"
  );
  assert.equal(triageForText({ title: "Cache restore fails intermittently", body: "" }).cls, "bug");
  assert.equal(triageForText({ title: "Login failure on retry", body: "" }).cls, "bug");
});

test("triage uses labels when the title does not classify", () => {
  const item = mapGitHubIssue(
    { number: 7, title: "Odd behaviour in merge", body: "Merging configs behaves oddly.", labels: [{ name: "security" }] },
    "example/repo"
  );
  assert.equal(item.triage.cls, "security");
});

// --- GitHub mapper ---------------------------------------------------------

test("mapGitHubIssue maps PRs and issues distinctly", () => {
  const issue = mapGitHubIssue({ number: 1, title: "Bug report", body: "It fails.", labels: [] }, "a/b");
  const pr = mapGitHubIssue(
    { number: 2, title: "Fix thing", body: "Fixes the failure.", labels: [], pull_request: {} },
    "a/b"
  );
  assert.ok(issue.sourceDetail.includes("issue #1"));
  assert.ok(pr.sourceDetail.includes("pull request #2"));
  assert.notEqual(issue.id, pr.id);
  assert.equal(mapGitHubIssue({ number: 3, title: "   ", body: "x" }, "a/b"), null);
});

// --- RSS parser ------------------------------------------------------------

const SAMPLE_FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Example</title>
<item><title><![CDATA[Node 24 LTS &amp; beyond]]></title>
<link>https://example.com/node-24</link>
<pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
<description><![CDATA[<p>Node 24 is <b>LTS</b> now.</p>]]></description></item>
<item><title>Plain entry</title><link>https://example.com/plain</link>
<description>Just text.</description></item>
</channel></rss>`;

test("parseRss handles CDATA, strips tags, decodes entities", () => {
  const entries = parseRss(SAMPLE_FEED);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "Node 24 LTS & beyond");
  assert.equal(entries[0].description, "Node 24 is LTS now.");
  assert.equal(entries[0].link, "https://example.com/node-24");
  assert.equal(entries[1].title, "Plain entry");
});

test("parseRss returns [] for empty or broken input, never throws", () => {
  assert.deepEqual(parseRss(""), []);
  assert.deepEqual(parseRss(null), []);
  assert.deepEqual(parseRss("<rss><channel><item><title>Unclosed"), []);
});

test("decodeEntities handles numeric entities", () => {
  assert.equal(decodeEntities("a &#65; b &#x42;"), "a A b B");
});

test("mapRssEntry builds stable ids from links", () => {
  const a = mapRssEntry({ title: "T", link: "https://example.com/a-b", description: "Body text here." }, "https://example.com/feed", 0);
  const b = mapRssEntry({ title: "T", link: "https://example.com/a-b", description: "Body text here." }, "https://example.com/feed", 5);
  assert.equal(a.id, b.id);
  assert.ok(a.id.startsWith("rss-live-"));
});

// --- doc gap detection -----------------------------------------------------

test("detectDocGaps flags TODO sections and ignores clean sections", () => {
  const md = [
    "# Runbook",
    "",
    "## Failover",
    "",
    "TODO: update the primary host name.",
    "",
    "## Contacts",
    "",
    "Ping the on-call channel.",
    "",
  ].join("\n");
  const items = detectDocGaps(md);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Failover");
  assert.equal(items[0].triage.cls, "docs");
  assert.equal(items[0].triage.priority, "P1");
});

test("detectDocGaps returns [] for a clean doc (no invented work)", () => {
  assert.deepEqual(detectDocGaps("# Guide\n\n## Setup\n\nInstall and run.\n"), []);
});

test("splitDocSections handles docs without headings", () => {
  const sections = splitDocSections("TODO: fix this line.\n");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Untitled section");
});
