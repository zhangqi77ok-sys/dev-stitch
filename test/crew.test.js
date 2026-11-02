// Tests for lib/crew.js (slice 3): prompt shape, strict model-reply
// parsing, critic gate, triage hook. Zero dependencies: node:test +
// node:assert only. Run: npm test
//
// NOTE: these tests use hand-written model replies, not live model calls.
// The live generation endpoint (gemini-3.8-flash) returned 503 high-demand
// during slice 3 verification, so no live model output is asserted here;
// the parser is validated against valid and invalid reply shapes instead.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrewPrompt,
  parseCrewResponse,
  enhanceItem,
  canApprove,
  applyTriageHook,
  CREW_MODEL,
} from "../lib/crew.js";
import { makeLiveItem } from "../lib/ingest.js";

const GOOD_REPLY = JSON.stringify({
  cls: "bug",
  priority: "P1",
  score: 72,
  reason: "Intermittent failure with a known trigger.",
  summary: "CI checkout fails when restoring the cache.",
  context: "Reruns pass, pointing at cache reads rather than code.",
  verdict: "pass",
  note: "Logs support the cache-timeout theory.",
});

function goodItem() {
  return makeLiveItem({
    id: "test-1",
    title: "Flaky CI checkout",
    source: "github",
    sourceDetail: "test",
    bodyText: "The checkout job fails about 1 in 20 runs on cache restore.",
    context: "test context",
  });
}

// --- prompt ----------------------------------------------------------------

test("prompt names the model contract: JSON only, all fields, enums", () => {
  const prompt = buildCrewPrompt({ title: "T", body: "B", labels: ["ci"] });
  for (const token of ["cls", "priority", "score", "reason", "summary", "context", "verdict", "note"]) {
    assert.ok(prompt.includes(token), token);
  }
  assert.ok(prompt.includes("T"), "title in prompt");
  assert.ok(prompt.includes("ci"), "labels in prompt");
  assert.ok(prompt.includes("JSON"), "JSON-only instruction");
  assert.ok(prompt.includes("DATA only"), "item content treated as data, not instructions");
});

// --- parser: accept ----------------------------------------------------------

test("parser accepts a valid reply and tags blocks with the model name", () => {
  const crew = parseCrewResponse(GOOD_REPLY);
  assert.ok(crew, "parsed");
  assert.equal(crew.triage.cls, "bug");
  assert.equal(crew.triage.priority, "P1");
  assert.equal(crew.triage.score, 72);
  assert.equal(crew.critic.verdict, "pass");
  assert.ok(crew.triage.reason.includes(CREW_MODEL), "model tagged");
  assert.ok(crew.critic.note.includes(CREW_MODEL), "model tagged");
});

test("parser strips one markdown fence", () => {
  const crew = parseCrewResponse("```json\n" + GOOD_REPLY + "\n```");
  assert.ok(crew, "fenced reply parsed");
  assert.equal(crew.triage.cls, "bug");
});

test("parser accepts boundary scores 0 and 100", () => {
  for (const score of [0, 100]) {
    const reply = JSON.stringify({ ...JSON.parse(GOOD_REPLY), score });
    assert.ok(parseCrewResponse(reply), `score ${score}`);
  }
});

// --- parser: reject ----------------------------------------------------------

test("parser rejects non-JSON, wrong enums, bad scores, empty strings", () => {
  assert.equal(parseCrewResponse("not json at all"), null, "non-JSON");
  assert.equal(parseCrewResponse(""), null, "empty");
  assert.equal(parseCrewResponse(null), null, "null input");
  const base = JSON.parse(GOOD_REPLY);
  const bad = [
    { ...base, cls: "unknown" },
    { ...base, priority: "P9" },
    { ...base, verdict: "maybe" },
    { ...base, score: 101 },
    { ...base, score: -1 },
    { ...base, score: 72.5 },
    { ...base, score: "72" },
    { ...base, reason: "" },
    { ...base, summary: "   " },
    { ...base, note: "" },
  ];
  for (const obj of bad) {
    assert.equal(parseCrewResponse(JSON.stringify(obj)), null, JSON.stringify(obj));
  }
  const missing = { ...base };
  delete missing.context;
  assert.equal(parseCrewResponse(JSON.stringify(missing)), null, "missing field");
});

// --- enhance -----------------------------------------------------------------

test("enhanceItem swaps blocks and marks model source; invalid crew keeps original", () => {
  const item = goodItem();
  const crew = parseCrewResponse(GOOD_REPLY);
  const next = enhanceItem(item, crew);
  assert.ok(next, "enhanced");
  assert.equal(next.crewSource, "model");
  assert.equal(next.triage.cls, "bug");
  assert.equal(next.title, item.title, "identity fields untouched");
  assert.equal(enhanceItem(item, null), null, "null crew");
  assert.equal(enhanceItem(item, { triage: crew.triage }), null, "partial crew");
});

// --- critic gate ---------------------------------------------------------------

test("canApprove: pass approves, flag needs override, unknown never", () => {
  assert.equal(canApprove("pass", false), true);
  assert.equal(canApprove("pass", true), true);
  assert.equal(canApprove("flag", false), false);
  assert.equal(canApprove("flag", true), true);
  assert.equal(canApprove("other", true), false);
  assert.equal(canApprove(undefined, true), false);
});

// --- triage hook ---------------------------------------------------------------

test("applyTriageHook accepts complete items, rejects block-less ones", () => {
  const good = goodItem();
  const broken = { id: "broken-1", title: "No crew blocks", source: "github", sourceDetail: "x" };
  const { accepted, rejected } = applyTriageHook([good, broken, null]);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, "test-1");
  assert.equal(rejected.length, 2);
});
