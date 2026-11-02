"use client";

import { useEffect, useMemo, useState } from "react";
import { SEED_ITEMS, draftIssue, draftPatch, downloadHref } from "../lib/seed";
import {
  mapGitHubIssue,
  parseRss,
  mapRssEntry,
  detectDocGaps,
} from "../lib/ingest";
import {
  enhanceItem,
  canApprove,
  applyTriageHook,
} from "../lib/crew";

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
  // Slice 3: model crew status + per-item crew source + critic overrides.
  // modelStatus: "unknown" | "available" | "unavailable" (no key, or the
  // static export where /api/crew does not exist — both degrade to the
  // heuristic, never a crash).
  const [modelStatus, setModelStatus] = useState("unknown");
  const [modelNote, setModelNote] = useState("");
  const [enhancing, setEnhancing] = useState({});
  const [crewSource, setCrewSource] = useState({});
  const [overrides, setOverrides] = useState({});
  // Optional GitHub issue creation (default off): token lives only in
  // this component's state, is cleared after every attempt, and is never
  // stored in localStorage or sent anywhere except api.github.com.
  const [createOpen, setCreateOpen] = useState("");
  const [createRepo, setCreateRepo] = useState("");
  const [createToken, setCreateToken] = useState("");
  const [createConfirm, setCreateConfirm] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createResult, setCreateResult] = useState("");

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
  // Slice 3: probe the server crew route. A 404 (static export) or any
  // failure means "no model here" — the heuristic stays, by design.
  useEffect(() => {
    fetch("/api/crew")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setModelStatus(d && d.modelConfigured ? "available" : "unavailable")
      )
      .catch(() => setModelStatus("unavailable"));
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
    // Slice 3 triage-on-ingest hook, as code: an item enters the queue
    // only with all three crew blocks. Rejected records are reported,
    // never silently dropped.
    const { accepted, rejected } = applyTriageHook(mapped);
    const seen = new Set(liveItems.map((i) => i.id));
    const fresh = accepted.filter(
      (i) => !seen.has(i.id) && !SEED_ITEMS.some((s) => s.id === i.id)
    );
    // Fresh ids must not inherit a stale "model" badge or a stale flag
    // override from a previous fetch of the same id: the new record is
    // heuristic until it is enhanced again.
    if (fresh.length > 0) {
      const freshIds = new Set(fresh.map((i) => i.id));
      setCrewSource((prev) => {
        const next = { ...prev };
        freshIds.forEach((id) => delete next[id]);
        return next;
      });
      setOverrides((prev) => {
        const next = { ...prev };
        freshIds.forEach((id) => delete next[id]);
        return next;
      });
    }
    const rejectedNote =
      rejected.length > 0
        ? ` (${rejected.length} record(s) rejected by the triage hook: missing a crew block.)`
        : "";
    setLiveNote(
      fresh.length === accepted.length
        ? `${note}${rejectedNote}`
        : `${note} (${accepted.length - fresh.length} already in the queue, skipped.)${rejectedNote}`
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

  // Slice 3: enhance one live item with the model crew. The item's
  // stored summary + context stand in for the raw body (live mappers do
  // not retain full bodies in the Item shape). On any failure — no key,
  // model error, unparsable reply — the heuristic item stays untouched
  // and the failure is reported, never rendered as a broken card.
  async function enhanceLiveItem(item) {
    if (modelStatus !== "available" || enhancing[item.id]) return;
    setEnhancing((prev) => ({ ...prev, [item.id]: true }));
    setModelNote("");
    try {
      const res = await fetch("/api/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          body: `${item.research.summary} ${item.research.context}`,
          labels: [],
        }),
      });
      if (!res.ok) {
        setModelNote(
          res.status === 503
            ? "Model crew is not configured on this server (no key) — heuristic kept."
            : "Model crew call failed — heuristic kept."
        );
        return;
      }
      const data = await res.json();
      const next = enhanceItem(item, data.crew);
      if (!next) {
        setModelNote("Model crew reply failed validation — heuristic kept.");
        return;
      }
      setLiveItems((prev) => prev.map((i) => (i.id === item.id ? next : i)));
      setCrewSource((prev) => ({ ...prev, [item.id]: "model" }));
    } catch {
      setModelNote("Model crew call failed (network) — heuristic kept.");
    } finally {
      setEnhancing((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function enhanceAllLive() {
    for (const item of liveItems) {
      if (crewSource[item.id] === "model") continue;
      // Sequential, one at a time: polite to a free-tier model.
      await enhanceLiveItem(item);
    }
  }

  // Slice 3: optional authenticated GitHub issue creation. Default off:
  // nothing happens until the user opens the panel, types a repo + token,
  // and ticks the explicit confirmation. This creates a REAL public
  // issue (GitHub has no draft issues) — the panel says so. The token
  // is cleared after every attempt and never persisted.
  async function createGitHubIssue(item) {
    const cleaned = createRepo.trim().replace(/^https?:\/\/github\.com\//i, "");
    const [owner, repo] = cleaned.split("/").map((s) => s.trim());
    if (!owner || !repo || !createToken.trim() || !createConfirm) {
      setCreateResult("Enter owner/repo, a token, and tick the confirmation.");
      return;
    }
    setCreateBusy(true);
    setCreateResult("");
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${createToken.trim()}`,
        },
        body: JSON.stringify({
          title: item.title,
          body: draftIssue(item),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateResult(
          `GitHub refused (HTTP ${res.status}): ${data.message || "check the repo name and token scope (needs repo write on that repo)."}` 
        );
        return;
      }
      setCreateResult(`Created: ${data.html_url || "(no URL returned)"}`);
    } catch (e) {
      setCreateResult(`Request failed: ${e.message}`);
    } finally {
      setCreateToken("");
      setCreateBusy(false);
    }
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
        Slice 3: the triage-on-ingest hook now runs as code (items missing
        a crew block are rejected, not displayed), and a flagged item
        cannot be approved until you explicitly override the flag.
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
        <h2>Live sources (slice 2) + model crew (slice 3)</h2>
        <p className="muted">
          Live triage starts as a deterministic keyword heuristic — every
          live card&apos;s Critic note says so. When this server has a
          model key configured, &ldquo;Run model crew&rdquo; replaces the
          heuristic blocks with real model output (free-tier Gemini via a
          server route; the key never reaches the browser). With no key,
          the heuristic and seeded demo keep working unchanged.
        </p>

        <div className="live-row">
          <b>Model crew</b>
          <span className="muted">
            {modelStatus === "unknown" && "Checking server…"}
            {modelStatus === "available" &&
              "Available on this server — model calls will replace heuristic blocks."}
            {modelStatus === "unavailable" &&
              "Not configured here (no server key, or static export) — heuristic mode."}
          </span>
          <button
            onClick={enhanceAllLive}
            disabled={
              modelStatus !== "available" ||
              liveItems.length === 0 ||
              Object.values(enhancing).some(Boolean)
            }
          >
            Run model crew on live items
          </button>
          {modelNote && <p className="muted">{modelNote}</p>}
        </div>

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
              {liveItems.some((l) => l.id === item.id) && (
                <span className="badge">
                  {crewSource[item.id] === "model" ? "model crew" : "heuristic"}
                </span>
              )}
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
              <>
                {!canApprove(item.critic.verdict, !!overrides[item.id]) ? (
                  <div className="section">
                    <b>Critic gate — approval blocked</b>
                    This item is flagged: {item.critic.note} Approval stays
                    blocked until you review the flag and explicitly
                    override it.
                    <label>
                      <input
                        type="checkbox"
                        checked={!!overrides[item.id]}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }
                      />{" "}
                      I reviewed the flag and approve anyway
                    </label>
                  </div>
                ) : (
                  <button
                    className="approve-btn"
                    onClick={() =>
                      setApproved((prev) => ({ ...prev, [item.id]: true }))
                    }
                  >
                    Approve → generate draft issue &amp; patch
                  </button>
                )}
                {liveItems.some((l) => l.id === item.id) &&
                  modelStatus === "available" &&
                  crewSource[item.id] !== "model" && (
                    <button
                      className="mini-btn"
                      onClick={() => enhanceLiveItem(item)}
                      disabled={!!enhancing[item.id]}
                    >
                      {enhancing[item.id]
                        ? "Running model crew…"
                        : "Enhance with model crew"}
                    </button>
                  )}
              </>
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
                {createOpen === item.id ? (
                  <div className="section">
                    <b>Create GitHub issue (optional, off by default)</b>
                    <p className="muted">
                      Warning: this creates a REAL public issue in the repo
                      you name — GitHub has no draft issues. Nothing is
                      posted until you submit below. Your token is used for
                      this one request only, is cleared afterwards, and is
                      never stored.
                    </p>
                    <input
                      value={createRepo}
                      onChange={(e) => setCreateRepo(e.target.value)}
                      placeholder="owner/repo to post the issue to"
                      aria-label="Repository to post the issue to"
                    />
                    <input
                      type="password"
                      value={createToken}
                      onChange={(e) => setCreateToken(e.target.value)}
                      placeholder="GitHub token (repo write on that repo)"
                      aria-label="GitHub token"
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={createConfirm}
                        onChange={(e) => setCreateConfirm(e.target.checked)}
                      />{" "}
                      I understand this posts a real public issue
                    </label>
                    <button
                      onClick={() => createGitHubIssue(item)}
                      disabled={createBusy}
                    >
                      {createBusy ? "Posting…" : "Create issue"}
                    </button>{" "}
                    <button
                      onClick={() => {
                        setCreateOpen("");
                        setCreateResult("");
                      }}
                    >
                      Cancel
                    </button>
                    {createResult && <p className="muted">{createResult}</p>}
                  </div>
                ) : (
                  <button
                    className="mini-btn"
                    onClick={() => {
                      setCreateOpen(item.id);
                      setCreateResult("");
                    }}
                  >
                    Create GitHub issue (optional)
                  </button>
                )}
              </>
            )}
          </article>
        );
      })}

      {items.length === 0 && <p>No items match this filter.</p>}

      <footer>
        Slice 3: model crew behind a server route (key in server env only,
        heuristic fallback with no key), triage-on-ingest hook and critic
        gate as running code, optional authenticated issue creation (off
        by default). See README.md for the honest Kiro status.
      </footer>
    </main>
  );
}
