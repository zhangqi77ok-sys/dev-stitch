// Live ingestion for Dev Stitch slice 2.
//
// Pure functions only: no window, no fetch, no DOMParser here, so the same
// code runs in the browser UI and in `node --test` with zero dependencies.
//
// Three live sources, all mapped into the exact Item shape from lib/seed.js:
//   - Public GitHub API issues/PRs (unauthenticated, read-only)
//   - RSS / Atom feed entries (XML text parsed with a small tolerant parser)
//   - Local docs (markdown split by heading, gap-detected into doc items)
//
// Honest limitation, stated up front: live triage is a deterministic
// KEYWORD HEURISTIC, not a model call. Every live item's Critic note says
// so. Slice 3 wires the same Item interface to real model calls.

export const LIVE_CLASSES = ["security", "bug", "docs", "upgrade", "feature", "task"];

const CLASS_KEYWORDS = [
  {
    cls: "security",
    re: /security|vulnerab|cve|injection|exploit|\bxss\b|\bcsrf\b|auth bypass|privilege escalation/i,
  },
  {
    cls: "bug",
    re: /bug|crash|error|fail(ure|ed|ing|s)?\b|broken|regression|exception|incorrect|panic/i,
  },
  {
    cls: "docs",
    re: /doc\b|readme|runbook|guide|tutorial|handbook/i,
  },
  {
    cls: "upgrade",
    re: /upgrade|release|\blts\b|version|deprecat|migration/i,
  },
  {
    cls: "feature",
    re: /feature|request|enhancement|add support|proposal/i,
  },
];

const CLASS_BASE_SCORE = {
  security: 88,
  bug: 68,
  docs: 62,
  upgrade: 48,
  feature: 30,
  task: 40,
};

const BOOST_RE = /crash|data loss|regression|breaking|urgent|critical/i;

function clampScore(n) {
  return Math.max(10, Math.min(98, Math.round(n)));
}

function priorityForScore(score) {
  if (score >= 85) return "P0";
  if (score >= 65) return "P1";
  if (score >= 45) return "P2";
  return "P3";
}

// Classify title + body (+ optional label names) into triage fields.
// First keyword match wins, in security -> bug -> docs -> upgrade ->
// feature order; no match defaults to "task" at low priority instead of
// mislabelling the item as a bug or feature.
export function triageForText({ title = "", body = "", labels = [] }) {
  const haystack = [title, body, labels.join(" ")].join("\n");
  let cls = "task";
  let matched = null;
  for (const { cls: c, re } of CLASS_KEYWORDS) {
    if (re.test(haystack)) {
      cls = c;
      matched = c;
      break;
    }
  }
  let score = CLASS_BASE_SCORE[cls];
  const boosted = BOOST_RE.test(haystack);
  if (boosted) score += 6;
  score = clampScore(score);
  const reason = matched
    ? `Keyword triage: matched "${matched}" class${boosted ? " with a severity boost" : ""}. Heuristic only — verify the linked source before acting.`
    : `Keyword triage: no class keywords matched, defaulted to "task" at low priority. Heuristic only — verify the linked source before acting.`;
  return { cls, priority: priorityForScore(score), score, reason };
}

function criticFor({ body = "" }) {
  const text = (body || "").trim();
  if (!text) {
    return {
      verdict: "flag",
      note: "Flagged: no body/description to verify — triage is keyword-based only.",
    };
  }
  if (text.length < 40) {
    return {
      verdict: "flag",
      note: "Flagged: very short body — keyword triage only, verify before acting.",
    };
  }
  return {
    verdict: "pass",
    note: "Heuristic triage from title/body keywords; verify the linked source before acting.",
  };
}

function summarize(text, max = 240) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "No description provided.";
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

// Assemble a full Item from one source's raw fields. Returns null when the
// title is missing, so callers can drop unusable records instead of
// rendering a broken card.
export function makeLiveItem({ id, title, source, sourceDetail, bodyText = "", context = "" }) {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return null;
  const item = {
    id,
    title: cleanTitle,
    source,
    sourceDetail,
    triage: triageForText({ title: cleanTitle, body: bodyText }),
    research: {
      summary: summarize(bodyText),
      context: context || "Live item: no extra context available.",
    },
    critic: criticFor({ body: bodyText }),
  };
  return validateItem(item) ? item : null;
}

// Property every Item must satisfy: all three crew blocks present with
// non-empty required fields, a sane score, a known priority and verdict.
// Used by the UI to drop bad records and by the property test.
export function validateItem(item) {
  if (!item || typeof item !== "object") return false;
  if (!item.id || !item.title || !item.source || !item.sourceDetail) return false;
  const { triage, research, critic } = item;
  if (!triage || !research || !critic) return false;
  if (!LIVE_CLASSES.includes(triage.cls)) return false;
  if (!["P0", "P1", "P2", "P3"].includes(triage.priority)) return false;
  if (typeof triage.score !== "number" || triage.score < 0 || triage.score > 100) return false;
  if (!triage.reason || !research.summary || !research.context) return false;
  if (!["pass", "flag"].includes(critic.verdict) || !critic.note) return false;
  return true;
}

// --- GitHub ---------------------------------------------------------------
// apiObj: one element of GET /repos/{owner}/{repo}/issues (issues and PRs
// share this endpoint; PRs carry a `pull_request` field). Read-only, no
// auth, no writes. Rate-limit handling lives in the UI (headers), not here.
export function mapGitHubIssue(apiObj, repoFullName) {
  if (!apiObj || typeof apiObj !== "object") return null;
  const number = apiObj.number;
  const isPR = !!apiObj.pull_request;
  const labels = Array.isArray(apiObj.labels)
    ? apiObj.labels.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean)
    : [];
  const owner = (repoFullName || "").split("/")[0] || "unknown";
  const repo = (repoFullName || "").split("/")[1] || "unknown";
  const body = apiObj.body || "";
  const base = makeLiveItem({
    id: `gh-live-${owner}-${repo}-${number}`,
    title: apiObj.title || "",
    source: "github",
    sourceDetail: `Public ${isPR ? "pull request" : "issue"} #${number} in ${repoFullName} — ${apiObj.html_url || "no URL"}`,
    bodyText: body,
    context: `Open ${isPR ? "pull request" : "issue"} #${number} in ${repoFullName}; ${apiObj.comments ?? 0} comments; labels: ${labels.length ? labels.join(", ") : "none"}.`,
  });
  if (!base) return null;
  // Labels participate in classification (a "security" label classifies even
  // when the title does not say so). Recompute triage with labels included.
  base.triage = triageForText({ title: base.title, body, labels });
  return validateItem(base) ? base : null;
}

// --- RSS / Atom -----------------------------------------------------------
// Small tolerant parser: extracts <item> (RSS) or <entry> (Atom) blocks and
// their title/link/description fields. Handles CDATA, strips HTML tags from
// descriptions, decodes common entities. It is NOT a full XML parser: broken
// markup yields fewer entries, never a crash — callers surface that as a
// per-feed warning, not a page failure.
export function decodeEntities(text) {
  return (text || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(text) {
  return (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function tagContent(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  let inner = m[1].trim();
  const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) inner = cdata[1];
  return decodeEntities(stripTags(inner));
}

function atomLink(block) {
  const m = block.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
  if (m) return m[1];
  return tagContent(block, "link");
}

export function parseRss(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];
  const blocks = [];
  const itemRe = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m;
  while ((m = itemRe.exec(xmlText)) !== null) blocks.push(m[0]);
  return blocks.map((block) => {
    const isEntry = /^<entry/i.test(block.trim());
    return {
      title: tagContent(block, "title"),
      link: isEntry ? atomLink(block) : tagContent(block, "link"),
      pubDate: tagContent(block, "pubDate") || tagContent(block, "updated"),
      description:
        tagContent(block, "description") ||
        tagContent(block, "summary") ||
        tagContent(block, "content"),
    };
  });
}

export function mapRssEntry(entry, feedUrl, index) {
  if (!entry || !entry.title) return null;
  const slug = (entry.link || entry.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return makeLiveItem({
    id: `rss-live-${slug || `entry-${index}`}`,
    title: entry.title,
    source: "rss",
    sourceDetail: `Feed entry from ${feedUrl}${entry.link ? ` — ${entry.link}` : ""}${entry.pubDate ? ` (${entry.pubDate})` : ""}`,
    bodyText: entry.description || "",
    context: `RSS/Atom entry${entry.pubDate ? ` published ${entry.pubDate}` : ""}. Source feed: ${feedUrl}.`,
  });
}

// --- Local docs -----------------------------------------------------------
// Gap detection: split markdown on headings; a section becomes a doc item
// only when it carries a gap signal (TODO/FIXME/XXX/TBD or a staleness
// word). A doc with no signals yields [] — the UI reports "no gaps
// detected" rather than inventing work.
export const DOC_GAP_SIGNALS = [
  { re: /\bTODO\b/i, label: "TODO" },
  { re: /\bFIXME\b/i, label: "FIXME" },
  { re: /\bXXX\b/i, label: "XXX" },
  { re: /\bTBD\b/i, label: "TBD" },
  { re: /out of date/i, label: "out of date" },
  { re: /\boutdated\b/i, label: "outdated" },
  { re: /\bdeprecated\b/i, label: "deprecated" },
  { re: /\bretired\b/i, label: "retired" },
  { re: /no longer/i, label: "no longer" },
];

export function splitDocSections(markdown) {
  const lines = (markdown || "").split("\n");
  const sections = [];
  let current = { title: "", lines: [] };
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (heading) {
      if (current.title || current.lines.some((l) => l.trim())) sections.push(current);
      current = { title: heading[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.some((l) => l.trim())) sections.push(current);
  return sections.map((s) => ({
    title: s.title || "Untitled section",
    body: s.lines.join("\n").trim(),
  }));
}

export function detectDocGaps(markdown, idPrefix = "doc-live") {
  const items = [];
  const sections = splitDocSections(markdown);
  sections.forEach((section, i) => {
    const signals = DOC_GAP_SIGNALS.filter((s) => s.re.test(section.body)).map((s) => s.label);
    if (!signals.length) return;
    const firstLine = section.body.split("\n").find((l) => l.trim()) || "";
    const item = makeLiveItem({
      id: `${idPrefix}-${i + 1}`,
      title: section.title,
      source: "docs",
      sourceDetail: `Gap-detected section of an uploaded/pasted doc — signals: ${signals.join(", ")}`,
      bodyText: section.body,
      context: `Doc gap signals found in this section: ${signals.join(", ")}. First line: ${firstLine.trim() || "(empty)"}.`,
    });
    if (item) {
      // Doc items are docs-class by construction, not by keyword accident.
      item.triage = {
        cls: "docs",
        priority: signals.some((s) => ["TODO", "FIXME"].includes(s)) ? "P1" : "P2",
        score: signals.some((s) => ["TODO", "FIXME"].includes(s)) ? 68 : 58,
        reason: `Gap detection: section carries ${signals.join(", ")}. Actionable doc debt, not a code defect.`,
      };
      if (validateItem(item)) items.push(item);
    }
  });
  return items;
}
