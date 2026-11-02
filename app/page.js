"use client";

import { useEffect, useMemo, useState } from "react";
import { SEED_ITEMS, draftIssue, draftPatch, downloadHref } from "../lib/seed";
import {
  mapGitHubIssue,
  parseRss,
  mapRssEntry,
  detectDocGaps,
} from "../lib/ingest";

const SOURCE_LABEL = { github: "GitHub", rss: "RSS", docs: "Local docs" };
const APPROVALS_KEY = "dev-stitch-approvals-v1";

function loadApprovals() {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(APPROVALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function Home() {
  const [filter, setFilter] = useState("all");
  const [approved, setApproved] = useState({});
  // Hydration-safe load: server prerender and first client render both use
  // {}, then the mount effect applies stored approvals. The persist effect
  // stays gated on approvalsLoaded so the mount run never overwrites
  // stored approvals with {}.
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [liveItems, setLiveItems] = useState([]);
  const [liveNote, setLiveNote] = useState("");

  // GitHub panel state
  const [repoInput, setRepoInput] = useState("");
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  // RSS panel state
  const [feedInput, setFeedInput] = useState("");
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState("");
  // Docs panel state
  const [docText, setDocText] = useState("");
  const [docNote, setDocNote] = useState("");

  // Slice 2: approvals persist in localStorage so a refresh no longer
  // loses them (slice 1's disclosed limitation). Private-mode / quota
  // failures degrade to page-state-only, never a crash.
  useEffect(() => {
    setApproved(loadApprovals());
    setApprovalsLoaded(true);
  }, []);
  useEffect(() => {
    if (!approvalsLoaded) return;
    try {
      window.localStorage.setItem(APPROVALS_KEY, JSON.stringify(approved));
    } catch {
      // ignore: approvals still work for this page session
    }
  }, [approved, approvalsLoaded]);

  const allItems = useMemo(
    () => [...SEED_ITEMS, ...liveItems],
    [liveItems]
  );

  const items = useMemo(() => {
    const sorted = [...allItems].sort(
      (a, b) => b.triage.score - a.triage.score
    );
    if (filter === "all") return sorted;
    if (filter === "approved") return sorted.filter((i) => approved[i.id]);
    if (filter === "queued") return sorted.filter((i) => !approved[i.id]);
    return sorted.filter((i) => i.source === filter);
  }, [filter, approved, allItems]);

  // Count only approvals that belong to items currently in the queue, so
  // approvals for cleared live items do not inflate the stats.
  const approvedCount = allItems.filter((i) => approved[i.id]).length;

  function appendLive(mapped, note) {
    const seen = new Set(liveItems.map((i) => i.id));
    const fresh = mapped.filter(
      (i) => !seen.has(i.id) && !SEED_ITEMS.some((s) => s.id === i.id)
    );
    setLiveNote(
      fresh.length === mapped.length
        ? note
        : `${note} (${mapped.length - fresh.length} already in the queue, skipped.)`
    );
    setLiveItems((prev) => [...prev, ...fresh]);
  }

  async function fetchGitHub() {
    // Accept a pasted https://github.com/owner/repo URL as well as
    // plain owner/repo: take the last two path segments.
    const cleaned = repoInput.trim().replace(/^https?:\/\/github\.com\//i, "");
    const [owner, repo] = cleaned.split("/").map((s) => s.trim());
    if (!owner || !repo) {
      setGhError("Enter owner/repo, e.g. facebook/react.");
      return;
    }
    setGhLoading(true);
    setGhError("");
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=20&sort=updated`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset");
      setRateLimit(
        remaining !== null
          ? `GitHub rate limit: ${remaining} unauthenticated requests remaining${
              reset ? ` (resets ${new Date(Number(reset) * 1000).toLocaleTimeString()})` : ""
            }. No key is used, by design.`
          : ""
      );
      if (res.status === 404) {
        setGhError("Repo not found or not public.");
        return;
      }
      if (res.status === 403) {
        setGhError(
          remaining === "0"
            ? `Rate limit exhausted — resets ${reset ? new Date(Number(reset) * 1000).toLocaleString() : "within the hour"}. Wait, or try a smaller repo later.`
            : "GitHub refused the request (403). Try again later."
        );
        return;
      }
      if (!res.ok) {
        setGhError(`GitHub returned HTTP ${res.status}.`);
        return;
      }
      const data = await res.json();
      const mapped = data
        .map((d) => mapGitHubIssue(d, `${owner}/${repo}`))
        .filter(Boolean);
      appendLive(
        mapped,
        `GitHub ${owner}/${repo}: ${mapped.length} of ${data.length} records mapped into the queue.`
      );
    } catch (e) {
      setGhError(`Fetch failed: ${e.message}. Check the repo name and your connection.`);
    } finally {
      setGhLoading(false);
    }
  }

  async function fetchRss() {
    const url = feedInput.trim();
    if (!url) {
      setRssError("Enter a feed URL, e.g. https://example.com/feed.xml.");
      return;
    }
    setRssLoading(true);
    setRssError("");
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (!res.ok) {
        setRssError(`Feed returned HTTP ${res.status}.`);
        return;
      }
      const text = await res.text();
      if (text.length > 2_000_000) {
        setRssError("Feed is over 2 MB — too large to parse in the browser. Try a smaller feed.");
        return;
      }
      const entries = parseRss(text);
      if (!entries.length) {
        setRssError(
          "No feed entries found. The URL may not be an RSS/Atom feed, or its markup is unsupported."
        );
        return;
      }
      const mapped = entries
        .slice(0, 10)
        .map((entry, i) => mapRssEntry(entry, url, i))
        .filter(Boolean);
      appendLive(
        mapped,
        `RSS ${url}: ${mapped.length} of ${Math.min(entries.length, 10)} entries mapped into the queue.`
      );
    } catch (e) {
      setRssError(
        `Fetch failed: ${e.message}. Many feeds block cross-origin browser fetch (CORS) — that feed can only be read by a feed reader or a server, not from this page.`
      );
    } finally {
      setRssLoading(false);
    }
  }

  function importDocText(text) {
    const batch = `doc-${Date.now()}`;
    const found = detectDocGaps(text, batch);
    if (!found.length) {
      setDocNote(
        "No gaps detected in this doc (no TODO / FIXME / XXX / TBD / outdated / deprecated / retired signals). Nothing was added — gap detection does not invent work."
      );
      return;
    }
    setDocNote(`${found.length} gap item(s) added from the doc.`);
    appendLive(found, `Local doc: ${found.length} gap item(s) added.`);
  }

  function handleDocFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importDocText(String(reader.result || ""));
    reader.onerror = () => setDocNote("Could not read that file.");
    reader.readAsText(file);
  }

  function clearApprovals() {
    setApproved({});
    try {
      window.localStorage.removeItem(APPROVALS_KEY);
    } catch {
      // ignore
    }
  }

  const queueJson = JSON.stringify(
    { exportedAt: new Date().toISOString(), items: allItems, approved },
    null,
    2
  );

  return (
    <main className="wrap">
      <header>
        <h1>🧵 Dev Stitch</h1>
        <p>
          A multi-agent triage console: GitHub issues, RSS feeds and local
          docs stitched into one prioritized action queue. Triage classifies,
          Researcher adds context, Critic verifies — you approve.
        </p>
      </header>

      <div className="banner">
        <b>Seeded demo mode + live sources.</b> The 6 seeded items below
        always work with no network. Live items you fetch are added to the
        same queue and mapped to the same Item shape. Approvals are stored
        in this browser (localStorage) and survive a refresh. Approving an
        item only generates draft text on this page — never a GitHub write.
      </div>

      <div className="stats">
        <div className="stat">
          <b>{allItems.length}</b> queued items
        </div>
        <div className="stat">
          <b>{approvedCount}</b> approved
        </div>
        <div className="stat">
          <b>{allItems.length - approvedCount}</b> still open
        </div>
        {liveItems.length > 0 && (
          <div className="stat">
            <b>{liveItems.length}</b> live items
          </div>
        )}
      </div>

      <section className="live-panel">
        <h2>Live sources (slice 2)</h2>
        <p className="muted">
          Live triage is a deterministic keyword heuristic, not a model call
          — every live card&apos;s Critic note says so. Seeded demo mode
          keeps working with no network at all.
        </p>

        <div className="live-row">
          <b>GitHub (public, no key)</b>
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo, e.g. facebook/react"
            aria-label="GitHub repository owner slash repo"
          />
          <button onClick={fetchGitHub} disabled={ghLoading}>
            {ghLoading ? "Fetching…" : "Fetch open issues"}
          </button>
          {ghError && <p className="err">{ghError}</p>}
          {rateLimit && <p className="muted">{rateLimit}</p>}
        </div>

        <div className="live-row">
          <b>RSS / Atom feed</b>
          <input
            value={feedInput}
            onChange={(e) => setFeedInput(e.target.value)}
            placeholder="https://example.com/feed.xml"
            aria-label="RSS feed URL"
          />
          <button onClick={fetchRss} disabled={rssLoading}>
            {rssLoading ? "Fetching…" : "Fetch feed"}
          </button>
          {rssError && <p className="err">{rssError}</p>}
        </div>

        <div className="live-row">
          <b>Local doc (upload or paste markdown)</b>
          <input
            type="file"
            accept=".md,.markdown,.txt"
            aria-label="Upload a markdown document"
            onChange={(e) => handleDocFile(e.target.files && e.target.files[0])}
          />
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="…or paste markdown here, then click Detect gaps"
            rows={4}
            aria-label="Paste markdown document"
          />
          <button onClick={() => importDocText(docText)} disabled={!docText.trim()}>
            Detect gaps
          </button>
          {docNote && <p className="muted">{docNote}</p>}
        </div>

        {liveNote && <p className="muted">{liveNote}</p>}
        <div className="live-actions">
          <a
            className="dl"
            href={downloadHref(queueJson)}
            download="dev-stitch-queue.json"
          >
            ⬇ Export queue as JSON
          </a>
          {liveItems.length > 0 && (
            <button
              className="mini-btn"
              onClick={() => {
                setLiveItems([]);
                setLiveNote("Live items cleared. Seeded demo items remain.");
              }}
            >
              Clear live items
            </button>
          )}
          <button className="mini-btn" onClick={clearApprovals}>
            Clear stored approvals
          </button>
        </div>
      </section>

      <div className="filters">
        {[
          ["all", "All"],
          ["queued", "Queued"],
          ["approved", "Approved"],
          ["github", "GitHub"],
          ["rss", "RSS"],
          ["docs", "Local docs"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {items.map((item) => {
        const isApproved = !!approved[item.id];
        const issue = draftIssue(item);
        const patch = draftPatch(item);
        return (
          <article
            key={item.id}
            className={isApproved ? "card approved" : "card"}
          >
            <h2>{item.title}</h2>
            <div className="badges">
              <span className={`badge src-${item.source}`}>
                {SOURCE_LABEL[item.source]}
              </span>
              <span className="badge">{item.triage.cls}</span>
              <span
                className={`badge ${item.triage.priority.toLowerCase()}`}
              >
                {item.triage.priority} · score {item.triage.score}
              </span>
              <span
                className={`badge critic-${item.critic.verdict}`}
              >
                critic: {item.critic.verdict}
              </span>
              {isApproved && <span className="badge">✓ approved</span>}
            </div>

            <div className="section">
              <b>Triage</b>
              {item.triage.reason}
            </div>
            <div className="section">
              <b>Researcher</b>
              {item.research.summary} {item.research.context}
            </div>
            <div className="section">
              <b>Critic</b>
              {item.critic.note}
            </div>
            <div className="section">
              <b>Source</b>
              {item.sourceDetail}
            </div>

            {!isApproved ? (
              <button
                className="approve-btn"
                onClick={() =>
                  setApproved((prev) => ({ ...prev, [item.id]: true }))
                }
              >
                Approve → generate draft issue &amp; patch
              </button>
            ) : (
              <>
                <div className="section">
                  <b>Draft issue</b>
                  <pre>{issue}</pre>
                  <a
                    className="dl"
                    href={downloadHref(issue)}
                    download={`${item.id}-draft-issue.txt`}
                  >
                    ⬇ Download draft issue
                  </a>
                </div>
                <div className="section">
                  <b>Draft patch outline</b>
                  <pre>{patch}</pre>
                  <a
                    className="dl"
                    href={downloadHref(patch)}
                    download={`${item.id}-draft-patch.txt`}
                  >
                    ⬇ Download draft patch
                  </a>
                </div>
              </>
            )}
          </article>
        );
      })}

      {items.length === 0 && <p>No items match this filter.</p>}

      <footer>
        Slice 2: live GitHub/RSS/doc ingestion + localStorage approvals +
        queue JSON export + tests. Real model calls, Kiro hooks firing and
        the demo video are slice 3. See README.md for the honest Kiro status.
      </footer>
    </main>
  );
}
