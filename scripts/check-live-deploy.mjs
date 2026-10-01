// Asserts that a player can actually reach the game, classic, nightly-builds/
// and the report function on the one live domain right now -- "a real check,
// not a note nobody reads".
//
// Netlify (chezz.hf7y.com) is the only host: GitHub Pages was dropped
// 2026-10-01 after the org transfer left hf7y.com/chezz/ a 404 (#145).
//
// Deliberately NOT part of `npm run check`: like check-answer-channel.mjs,
// this hits live network, and a transient blip must not block the commit
// that would fix it. Runs from test.yml's daily schedule instead.
import { execFileSync } from "node:child_process";
import { stamped } from "./answered-issues.mjs";

// 2026-09-25: repo moved hf7y/chezz -> hf7y-estate/chezz (realisateur#672);
// the old name still resolves for direct API calls but not for the
// --label search this file's dedup issue-list relies on (see
// check-answer-channel.mjs for the full explanation).
export const REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y-estate/chezz";
const LABEL = "nightly-builds-domain-down";
// Provenance stamp job id (hf7y/chezz#21). Without it, everything this script
// posts under the shared `hf7y` token is indistinguishable from a reply Zach
// wrote by hand -- which is what `isAnswered` in answered-issues.mjs keys on.
const JOB = "check-live-deploy";

export const NETLIFY_CANONICAL_URL = "https://chezz.hf7y.com/";

export const DOMAINS = [
  { name: "chezz.hf7y.com", url: `${NETLIFY_CANONICAL_URL}nightly-builds/` },
];

export const GAME_PATHS = [
  { name: "chezz.hf7y.com narrative", url: NETLIFY_CANONICAL_URL },
];

// Proves the function actually answers a real request, not just that it
// exists (a bad scope also 4xxs).
export const REPORT_ENDPOINT = {
  name: "chezz.hf7y.com report function",
  url: `${NETLIFY_CANONICAL_URL}.netlify/functions/report?scope=sweep-status`,
};

// Checked by page CONTENT rather than just status, since the retired Google
// Apps Script URL also returned 200 while going nowhere real (hf7y/chezz#82).
export const CLASSIC_PAGES = [
  { name: "chezz.hf7y.com classic", url: `${NETLIFY_CANONICAL_URL}classic.html` },
];

export async function checkDomain({ name, url }, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { redirect: "follow" });
    if (res.status !== 200) {
      return { name, url, ok: false, detail: `HTTP ${res.status}` };
    }
    return { name, url, ok: true };
  } catch (err) {
    return { name, url, ok: false, detail: err.message || String(err) };
  }
}

export async function checkClassicReportUrl({ name, url }, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { redirect: "follow" });
    if (res.status !== 200) {
      return { name, url, ok: false, detail: `HTTP ${res.status}` };
    }
    const body = await res.text();
    if (body.includes("script.google.com")) {
      return { name, url, ok: false, detail: "still names the retired Google Apps Script URL (hf7y/chezz#82)" };
    }
    if (!body.includes("/.netlify/functions/report")) {
      return { name, url, ok: false, detail: "does not name the Netlify report function" };
    }
    return { name, url, ok: true };
  } catch (err) {
    return { name, url, ok: false, detail: err.message || String(err) };
  }
}

function findOpenIssue() {
  const out = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--label", LABEL, "--state", "open",
     "--limit", "5", "--json", "number"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
  const issues = JSON.parse(out);
  return issues[0]?.number ?? null;
}

function fileBlocker(failures) {
  // Grammar-compliant (gh-sign, realisateur#680/#752): a first line
  // declaring NO-DECISION (this is a defect report, not a call for Zach to
  // make), plus DEFERRED/DELIVERS blocks. Discovered broken 2026-09-17 --
  // this path had never actually filed an issue against the real grammar
  // gate before that (hf7y/chezz#130 was the first live fire of it).
  const body = [
    "NO-DECISION: automated live-route check found a route not serving; no ruling needed, just a fix.",
    "",
    "Automated check (scripts/check-live-deploy.mjs, run from test.yml's daily",
    "schedule) found a live route that isn't serving:",
    "",
    ...failures.map((f) => `- ${f.name} (${f.url}): ${f.detail}`),
    "",
    "<!-- DEFERRED -->",
    "- none",
    "<!-- /DEFERRED -->",
    "",
    "<!-- DELIVERS -->",
    "- none",
    "<!-- /DELIVERS -->",
  ].join("\n");
  execFileSync(
    "gh",
    ["issue", "create", "--repo", REPO, "--label", LABEL,
     "--title", "nightly-builds domain check failed",
     "--body", stamped(body, JOB)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

// "repo:<REPO>" gives gh-sign's close_check a landing ref to find
// (grammar_landing_ref) -- a close naming nothing checkable is REFUSED.
// Must track REPO, not a hardcoded literal: a stale "repo:hf7y/chezz" here
// survived both the 2026-09-25 org-transfer fallout fix (#146) and the
// 2026-10-01 Netlify-only rewrite (#147) because it was an inline string,
// not the REPO constant every other `gh` call already used -- same drift
// class CLAUDE.md names for `--label` search queries, just in a landing-ref
// string instead of a query. Exported (unstamped) so a test can pin it
// without shelling out to the real `gh issue close`.
export function closeComment() {
  return `check-live-deploy: every route is serving again as of this run (repo:${REPO}).`;
}

function closeStaleIssue(number) {
  execFileSync(
    "gh",
    ["issue", "close", String(number), "--repo", REPO,
     "--comment", stamped(closeComment(), JOB)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

async function main() {
  const results = await Promise.all([
    ...[...DOMAINS, ...GAME_PATHS].map((d) => checkDomain(d)),
    checkDomain(REPORT_ENDPOINT),
    ...CLASSIC_PAGES.map((d) => checkClassicReportUrl(d)),
  ]);
  const failures = results.filter((r) => !r.ok);

  if (failures.length === 0) {
    console.log("check-live-deploy: OK -- game, classic, nightly-builds/ and the report endpoint all answer on chezz.hf7y.com.");
    try {
      const existing = findOpenIssue();
      if (existing) closeStaleIssue(existing);
    } catch (err) {
      // Best-effort: not being able to close a stale issue is not a reason
      // to fail a deploy that itself succeeded.
      console.log(`check-live-deploy: could not check/close a stale ${LABEL} issue: ${err.message || err}`);
    }
    process.exit(0);
  }

  console.error("\ncheck-live-deploy: A LIVE ROUTE IS NOT SERVING\n");
  for (const f of failures) console.error(`  - ${f.name} (${f.url}): ${f.detail}`);
  console.error("");

  try {
    if (!findOpenIssue()) fileBlocker(failures);
    else console.error(`check-live-deploy: an open ${LABEL} issue already exists, not filing a duplicate.`);
  } catch (err) {
    console.error(`check-live-deploy: also could not file/check a ${LABEL} issue: ${err.message || err}`);
  }

  process.exit(1);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
