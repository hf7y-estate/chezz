// report.js -- in-game report channel, backed by GitHub Issues (replaces
// leaderboard/Code.gs, hf7y/chezz#83). The credential lives only in Netlify's
// env, never echoed; reads proxy through here too (5000/hour vs. 60).

import { createSign } from "node:crypto";

// 2026-09-25: repo moved hf7y/chezz -> hf7y-estate/chezz (realisateur#672).
// GitHub 301s REST requests for the old name, and `fetch` downgrades a
// redirected POST to GET per the WHATWG spec -- so every report submission
// (`method: "POST"` below) was silently turning into a GET that listed
// issues instead of filing one, while still returning `res.ok` true.
const REPO = "hf7y-estate/chezz";
const LABEL = "player-report";
const API = "https://api.github.com";

const MAX_DESCRIPTION = 4000;
const MAX_TITLE = 72;

// CORS: this same function is also embedded (absolute URL, hf7y/chezz#128)
// in classic.html served from hf7y.com/chezz/classic.html, a different
// origin than chezz.hf7y.com -- without this header the browser fetch
// there succeeds but the page can never read the response body.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

function gh(path, token, init = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "chezz-report-function",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

// The estate's GitHub App is the credential (hf7y-estate/realisateur#1365):
// the org refuses personal tokens that live longer than a year, which is what
// 403'd GITHUB_ISSUE_TOKEN after the move. The function mints a one-hour
// installation token that can only write issues on this repo, and reuses it
// until just before it expires.
let minted = { token: "", exp: 0 };

async function appToken(appId, key) {
  if (Date.now() < minted.exp) return minted.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key.replace(/\\n/g, "\n"), "base64url")}`;
  const inst = await gh(`/repos/${REPO}/installation`, jwt);
  if (!inst.ok) return "";
  const res = await gh(`/app/installations/${(await inst.json()).id}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({ repositories: [REPO.split("/")[1]], permissions: { issues: "write" } }),
  });
  if (!res.ok) return "";
  const { token, expires_at } = await res.json();
  minted = { token, exp: Date.parse(expires_at) - 300000 };
  return token;
}

function issueBody({ name, url, kind, description }) {
  return [
    description,
    "",
    "---",
    `- player: \`${name}\``,
    `- build: ${url}`,
    `- kind: ${kind}`,
    "",
    "_Filed from the in-game report box._",
  ].join("\n");
}

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
  const appId = Netlify.env.get("GITHUB_APP_ID");
  const appKey = Netlify.env.get("GITHUB_APP_KEY");
  const token = appId && appKey ? await appToken(appId, appKey) : Netlify.env.get("GITHUB_ISSUE_TOKEN");
  const scope = new URL(req.url).searchParams;

  if (!token) {
    return json({ ok: false, error: "no working GitHub credential on this site" }, 503);
  }

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

    // "feature" (not "idea") is the value both narrative's and classic's
    // report UI actually send from their kind radio/param -- treat it the
    // same as "idea" instead of silently mislabeling every idea "bug" and
    // relying on a later triage pass to notice and relabel it (see e.g.
    // hf7y/chezz#120, #123, #124, each needing a manual bug->idea comment).
    const kind = payload.kind === "idea" || payload.kind === "feature" ? "idea" : "bug";
    const name = /^[0-9a-f]{6}$/.test(String(payload.name || "")) ? payload.name : "unknown";
    const build = String(payload.url || "").startsWith("http")
      ? String(payload.url).slice(0, 300)
      : "(not supplied)";

    const firstLine = description.split("\n")[0];
    const title = firstLine.length > MAX_TITLE
      ? `${firstLine.slice(0, MAX_TITLE - 1)}…`
      : firstLine;

    const res = await gh(`/repos/${REPO}/issues`, token, {
      method: "POST",
      body: JSON.stringify({
        title,
        body: issueBody({ name, url: build, kind, description }),
        labels: [LABEL, kind],
      }),
    });

    if (!res.ok) {
      // Never surface GitHub's response verbatim; it can name the token.
      return json({ ok: false, error: `GitHub refused the report (${res.status})` }, 502);
    }
    const issue = await res.json();
    return json({ ok: true, issue: issue.number, url: issue.html_url });
  }

  if (req.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);

  if (scope.get("scope") === "sweep-status") {
    const res = await gh(
      `/repos/${REPO}/issues?state=closed&labels=${LABEL}&per_page=100&sort=updated`,
      token,
    );
    if (!res.ok) return json({ ok: false, error: `unreadable (${res.status})` }, 502);
    const closed = (await res.json()).filter(i => !i.pull_request);
    if (!closed.length) return json({});
    return json({ timestamp: closed[0].closed_at || closed[0].updated_at, fixed: closed.length });
  }

  if (scope.get("scope") === "bugs") {
    const want = scope.get("status") || "resolved";
    const type = scope.get("type") || "all";
    const limit = Math.min(Number(scope.get("limit")) || 20, 100);
    const state = want === "all" ? "all" : want === "resolved" ? "closed" : "open";

    const res = await gh(
      `/repos/${REPO}/issues?state=${state}&labels=${LABEL}&per_page=100&sort=updated`,
      token,
    );
    if (!res.ok) return json({ ok: false, error: `unreadable (${res.status})` }, 502);

    let entries = (await res.json()).filter(i => !i.pull_request).map(toEntry);
    if (type !== "all") entries = entries.filter(e => e.type === type);
    return json(entries.slice(0, limit));
  }

  return json({ ok: false, error: "unknown scope" }, 400);
};
