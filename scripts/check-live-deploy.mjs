// Asserts, on every deploy, that a player can actually reach nightly-builds/
// through each live domain right now -- "a real check, not a note nobody
// reads". It also checks the two public game routes so a Pages artifact that
// omits either mode fails loud.
//
// The OCF/zach.audio domain-move park this check was born from is CLOSED
// (Zach, chezz#19, 2026-08-14): "it is hf7y.com/ now. no ocf no zach.audio".
// zach.audio was serving a permanent 404 and filing a nightly issue for it.
//
// Deliberately NOT part of `npm run check`: like check-answer-channel.mjs,
// this hits live network, and a transient blip must not block the commit
// that would fix it. Wired into the deploy workflow instead, which is where
// "can a player actually reach a build" is the thing that matters, and which
// already runs on every push to main -- so this is the "recurring" half of
// "recurring assertion" for free, no separate cron needed.
import { execFileSync } from "node:child_process";
import { stamped } from "./answered-issues.mjs";

// 2026-09-25: repo moved hf7y/chezz -> hf7y-estate/chezz (realisateur#672);
// the old name still resolves for direct API calls but not for the
// --label search this file's dedup issue-list relies on (see
// check-answer-channel.mjs for the full explanation).
const REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y-estate/chezz";
const LABEL = "nightly-builds-domain-down";
// Provenance stamp job id (hf7y/chezz#21). Without it, everything this script
// posts under the shared `hf7y` token is indistinguishable from a reply Zach
// wrote by hand -- which is what `isAnswered` in answered-issues.mjs keys on.
const JOB = "check-live-deploy";

// hf7y.com is the public domain; hf7y.github.io is this repo's own Pages
// deploy, kept as the canary that separates "Pages build broke" from "the
// domain in front of it broke".
export const DOMAINS = [
  { name: "hf7y.com", url: "https://hf7y.com/chezz/nightly-builds/" },
  { name: "hf7y.github.io", url: "https://hf7y.github.io/chezz/nightly-builds/" },
];

export const GAME_PATHS = [
  { name: "hf7y.com narrative", url: "https://hf7y.com/chezz/" },
  { name: "hf7y.com classic", url: "https://hf7y.com/chezz/classic.html" },
];

// hf7y/chezz#128: the in-game report box posts to a RELATIVE
// /.netlify/functions/report, which only exists on the Netlify domain.
// Narrative's non-canonical Pages routes (#94) must stay a redirect stub to
// that domain -- if one of them ever serves the real game page instead, a
// player there gets a report box that silently 404s.
export const NETLIFY_CANONICAL_URL = "https://chezz.hf7y.com/";
export const NARRATIVE_REDIRECT_PATHS = [
  { name: "hf7y.com narrative redirect", url: "https://hf7y.com/chezz/" },
  { name: "hf7y.github.io narrative redirect", url: "https://hf7y.github.io/chezz/" },
];

// Proves the function actually answers a real request on the canonical
// domain, not just that it exists (a bad scope also 4xxs).
export const REPORT_ENDPOINT = {
  name: "chezz.hf7y.com report function",
  url: `${NETLIFY_CANONICAL_URL}.netlify/functions/report?scope=sweep-status`,
};

// classic.html serves in full (not a redirect) from BOTH hf7y.com/chezz/
// and chezz.hf7y.com, so unlike narrative's root it can't rely on a
// redirect-to-canonical check -- its report channel has to work from either
// origin via one absolute URL (hf7y/chezz#128, #130), checked by page
// CONTENT rather than just status, since the retired Google Apps Script URL
// it replaced also returned 200 while going nowhere real (hf7y/chezz#82).
export const CLASSIC_PAGES = [
  { name: "hf7y.com classic", url: "https://hf7y.com/chezz/classic.html" },
  { name: "chezz.hf7y.com classic", url: "https://chezz.hf7y.com/classic.html" },
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

export async function checkRedirectsToCanonical({ name, url }, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { redirect: "follow" });
    if (res.status !== 200) {
      return { name, url, ok: false, detail: `HTTP ${res.status}` };
    }
    const body = await res.text();
    if (!body.includes(NETLIFY_CANONICAL_URL)) {
      return {
        name,
        url,
        ok: false,
        detail: `page does not redirect to ${NETLIFY_CANONICAL_URL} -- it may be serving the live game with a broken relative report endpoint`,
      };
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
    "Automated check (scripts/check-live-deploy.mjs, run from the Pages deploy",
    "workflow) found a live route that isn't serving:",
    "",
    ...failures.map((f) => `- ${f.name} (${f.url}): ${f.detail}`),
    "",
    "If hf7y.github.io is serving but hf7y.com is not, the Pages build is fine",
    "and the domain in front of it is the fault.",
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

function closeStaleIssue(number) {
  // "repo:hf7y/chezz" gives gh-sign's close_check a landing ref to find
  // (grammar_landing_ref) -- a close naming nothing checkable is REFUSED.
  execFileSync(
    "gh",
    ["issue", "close", String(number), "--repo", REPO,
     "--comment", stamped("check-live-deploy: every domain is serving nightly-builds/ again as of this deploy (repo:hf7y/chezz).", JOB)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
}

async function main() {
  const results = await Promise.all([
    ...[...DOMAINS, ...GAME_PATHS].map((d) => checkDomain(d)),
    checkDomain(REPORT_ENDPOINT),
    ...NARRATIVE_REDIRECT_PATHS.map((d) => checkRedirectsToCanonical(d)),
    ...CLASSIC_PAGES.map((d) => checkClassicReportUrl(d)),
  ]);
  const failures = results.filter((r) => !r.ok);

  if (failures.length === 0) {
    console.log(
      "check-live-deploy: OK — " + DOMAINS.map((d) => d.name).join(", ") +
      " all serving nightly-builds/, the report endpoint answers, Narrative's non-canonical routes still redirect to Netlify, and classic's report channel names no retired URL."
    );
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

  console.error("\ncheck-live-deploy: A LIVE PAGES ROUTE IS NOT SERVING\n");
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
