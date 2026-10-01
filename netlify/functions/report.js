// report.js -- in-game report channel (replaces leaderboard/Code.gs,
// hf7y/chezz#83). It holds NO credential. A report is stored here and served
// back at ?scope=pending; scripts/drain-reports.mjs, run by something that
// already holds a GitHub token, turns each one into an issue. The org refuses
// long-lived personal tokens, and Zach ruled 2026-10-01 that credentials stay
// on dexter, so this function never talks to GitHub with one (#145).

import { getStore } from "@netlify/blobs";

const REPO = "hf7y-estate/chezz";
const LABEL = "player-report";
const API = "https://api.github.com";

const MAX_DESCRIPTION = 4000;
const MAX_TITLE = 72;
const MAX_PENDING = 500; // a public write endpoint must not be an unbounded store

// The test seam: Netlify Blobs only exists inside Netlify's runtime.
let store;
export function useStore(s) { store = s; }
const reports = () => store || getStore("reports");

// CORS: classic.html posts here by absolute URL (hf7y/chezz#128).
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...headers },
  });

// Unauthenticated reads of a public repo: 60 an hour per address, so every
// read that reaches GitHub is cached at the edge for five minutes.
const CACHED = { "cache-control": "public, max-age=300" };
const gh = path =>
  fetch(`${API}${path}`, { headers: { accept: "application/vnd.github+json", "user-agent": "chezz-report-function" } });

function toEntry(issue) {
  const kind = issue.labels.some(l => (l.name || l) === "idea") ? "feature" : "bug";
  const player = /- player: `([0-9a-f]{6})`/.exec(issue.body || "");
  const build = /- build: (\S+)/.exec(issue.body || "");
  return {
    timestamp: issue.created_at,
    name: player ? player[1] : "",
    url: build ? build[1] : issue.html_url,
    description: issue.title,
    status: issue.state === "closed" ? "resolved" : "open",
    note: "",
    type: kind,
    issue: issue.number,
  };
}

export default async (req) => {
  const scope = new URL(req.url).searchParams;

  if (req.method === "POST") {
    let payload;
    try {
      payload = JSON.parse(await req.text()); // text/plain body dodges a CORS preflight.
    } catch {
      return json({ ok: false, error: "body is not JSON" }, 400);
    }

    const description = String(payload.description || "").trim();
    if (!description) return json({ ok: false, error: "description is required" }, 400);
    if (description.length > MAX_DESCRIPTION) {
      return json({ ok: false, error: "description too long" }, 413);
    }

    // "feature" is what both report UIs send for an idea (hf7y/chezz#120).
    const kind = payload.kind === "idea" || payload.kind === "feature" ? "idea" : "bug";
    const name = /^[0-9a-f]{6}$/.test(String(payload.name || "")) ? payload.name : "unknown";
    const build = String(payload.url || "").startsWith("http")
      ? String(payload.url).slice(0, 300)
      : "(not supplied)";

    const { blobs } = await reports().list();
    if (blobs.length >= MAX_PENDING) return json({ ok: false, error: "report queue is full" }, 503);

    const id = crypto.randomUUID();
    await reports().setJSON(id, { id, at: new Date().toISOString(), kind, name, build, description });
    return json({ ok: true, queued: id });
  }

  if (req.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);

  // What the drain reads. A report whose id already appears in an issue has
  // been filed: it is dropped here, which is how the queue empties without
  // the drain needing any right to delete.
  if (scope.get("scope") === "pending") {
    const { blobs } = await reports().list();
    if (!blobs.length) return json([]);
    const res = await gh(`/repos/${REPO}/issues?state=all&labels=${LABEL}&per_page=100&sort=created`);
    if (!res.ok) return json({ ok: false, error: `unreadable (${res.status})` }, 502);
    const filed = (await res.json()).map(i => i.body || "").join("\n");
    const pending = [];
    for (const { key } of blobs) {
      if (filed.includes(key)) await reports().delete(key);
      else pending.push(await reports().get(key, { type: "json" }));
    }
    return json(pending.filter(Boolean));
  }

  if (scope.get("scope") === "sweep-status") {
    const res = await gh(`/repos/${REPO}/issues?state=closed&labels=${LABEL}&per_page=100&sort=updated`);
    if (!res.ok) return json({ ok: false, error: `unreadable (${res.status})` }, 502);
    const closed = (await res.json()).filter(i => !i.pull_request);
    if (!closed.length) return json({}, 200, CACHED);
    return json({ timestamp: closed[0].closed_at || closed[0].updated_at, fixed: closed.length }, 200, CACHED);
  }

  if (scope.get("scope") === "bugs") {
    const want = scope.get("status") || "resolved";
    const type = scope.get("type") || "all";
    const limit = Math.min(Number(scope.get("limit")) || 20, 100);
    const state = want === "all" ? "all" : want === "resolved" ? "closed" : "open";

    const res = await gh(`/repos/${REPO}/issues?state=${state}&labels=${LABEL}&per_page=100&sort=updated`);
    if (!res.ok) return json({ ok: false, error: `unreadable (${res.status})` }, 502);

    let entries = (await res.json()).filter(i => !i.pull_request).map(toEntry);
    if (type !== "all") entries = entries.filter(e => e.type === type);
    return json(entries.slice(0, limit), 200, CACHED);
  }

  return json({ ok: false, error: "unknown scope" }, 400);
};
