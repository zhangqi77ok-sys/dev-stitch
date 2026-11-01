"use client";

import { useMemo, useState } from "react";
import { SEED_ITEMS, draftIssue, draftPatch, downloadHref } from "../lib/seed";

const SOURCE_LABEL = { github: "GitHub", rss: "RSS", docs: "Local docs" };

export default function Home() {
  const [filter, setFilter] = useState("all");
  const [approved, setApproved] = useState({});

  const items = useMemo(() => {
    const sorted = [...SEED_ITEMS].sort(
      (a, b) => b.triage.score - a.triage.score
    );
    if (filter === "all") return sorted;
    if (filter === "approved") return sorted.filter((i) => approved[i.id]);
    if (filter === "queued") return sorted.filter((i) => !approved[i.id]);
    return sorted.filter((i) => i.source === filter);
  }, [filter, approved]);

  const approvedCount = Object.keys(approved).length;

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
        <b>Seeded demo mode.</b> Every item below is bundled sample data.
        No accounts, no keys, no network calls, no GitHub writes. Approving
        an item only generates draft text on this page.
      </div>

      <div className="stats">
        <div className="stat">
          <b>{SEED_ITEMS.length}</b> queued items
        </div>
        <div className="stat">
          <b>{approvedCount}</b> approved
        </div>
        <div className="stat">
          <b>{SEED_ITEMS.length - approvedCount}</b> still open
        </div>
      </div>

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
        Slice 1: seeded queue + three-role crew notes + approve → draft
        text. Live GitHub/RSS ingestion, persistence and real model calls
        are later slices. See README.md for the honest Kiro status.
      </footer>
    </main>
  );
}
