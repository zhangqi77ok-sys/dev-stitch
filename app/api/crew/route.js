// Server-only crew route (slice 3).
//
// GET  -> { modelConfigured: boolean } — never reveals the key.
// POST -> { crew } | { error } — calls Gemini generateContent with the
//   key from the DEV_STITCH_GEMINI_API_KEY server environment variable.
//   The key is read here, on the server, and never sent to the client,
//   never bundled, never logged, never committed.
//
// No key configured -> 503 model_not_configured: the UI keeps the slice 2
// keyword heuristic and seeded demo mode, so the app works with no account.
// Model API error / unparsable reply -> 502: the UI keeps the heuristic.
//
// No per-IP rate limit on this route by design (demo scope): whoever can
// reach a keyed deployment can spend its key quota. Do not expose a keyed
// deployment publicly beyond judging; the static Pages demo has no route
// at all, so it cannot spend anything.
//
// This route does not exist in the static export (GitHub Pages build):
// the Pages build moves app/api aside first (see scripts/build-pages.sh),
// so the Pages demo runs heuristic-only, exactly like no-key mode.

import { buildCrewPrompt, parseCrewResponse, CREW_MODEL } from "../../../lib/crew.js";

export const runtime = "nodejs";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CREW_MODEL}:generateContent`;

export async function GET() {
  return Response.json({ modelConfigured: !!process.env.DEV_STITCH_GEMINI_API_KEY });
}

export async function POST(request) {
  const apiKey = process.env.DEV_STITCH_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "model_not_configured" }, { status: 503 });
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const title = typeof input.title === "string" ? input.title : "";
  const body = typeof input.body === "string" ? input.body : "";
  const labels = Array.isArray(input.labels) ? input.labels.filter((l) => typeof l === "string") : [];
  if (!title.trim()) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  let res;
  try {
    res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildCrewPrompt({ title, body, labels }) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    return Response.json({ error: "model_unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    // Deliberately generic: upstream error bodies are not forwarded.
    return Response.json({ error: "model_unavailable" }, { status: 502 });
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return Response.json({ error: "model_unavailable" }, { status: 502 });
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const crew = parseCrewResponse(text);
  if (!crew) {
    return Response.json({ error: "model_unparsable" }, { status: 502 });
  }
  return Response.json({ crew, model: CREW_MODEL });
}
