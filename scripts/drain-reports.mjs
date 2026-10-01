// drain-reports.mjs -- file each stored player report as a GitHub issue.
//
// netlify/functions/report.js holds no credential: it stores what players send
// and serves it at ?scope=pending. Whatever runs this already has `gh`
// authenticated (the nightly pass, or a clock on dexter with a token minted
// for this repo alone), so the credential never leaves that host (#145).
//
// Safe to run twice: a report whose id is already in an issue body is skipped,
// and the function drops it from the queue the next time pending is read.
import { execFileSync } from "node:child_process";

const REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y-estate/chezz";
const PENDING = process.env.CHEZZ_PENDING_URL || "https://chezz.hf7y.com/.netlify/functions/report?scope=pending";
const MAX_TITLE = 72;

// Line 1 and the two closing blocks are the estate's body grammar; an issue
// without them is refused by gh-sign and read as UNDECLARED by etiquette,
// which is what every report filed before this was (#120, #123, #124).
export function issueFor(r) {
  const first = r.description.split("\n")[0];
  return {
    title: first.length > MAX_TITLE ? `${first.slice(0, MAX_TITLE - 1)}…` : first,
    labels: ["player-report", r.kind],
    body: [
      "NO-DECISION: a player report from the in-game box; triage decides what it is.",
      "",
      r.description,
      "",
      "---",
      `- player: \`${r.name}\``,
      `- build: ${r.build}`,
      `- kind: ${r.kind}`,
      `- report: ${r.id}`,
      `- sent: ${r.at}`,
      "",
      "<!-- DEFERRED -->",
      "- none",
      "<!-- /DEFERRED -->",
      "",
      "<!-- DELIVERS -->",
      "- none",
      "<!-- /DELIVERS -->",
    ].join("\n"),
  };
}

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", timeout: 60000 });

export async function drain(fetchImpl = fetch, run = gh) {
  const res = await fetchImpl(PENDING);
  if (!res.ok) throw new Error(`pending is unreadable: HTTP ${res.status}`);
  const pending = await res.json();
  if (!pending.length) return { filed: 0, skipped: 0 };
  // The issue LIST, not search: search had not indexed an issue filed seconds
  // earlier, so a second run filed it again (#159 and #160, 2026-10-01).
  const already = run("issue", "list", "--repo", REPO, "--state", "all", "--label", "player-report", "--limit", "200", "--json", "body");
  let filed = 0, skipped = 0;
  for (const r of pending) {
    if (already.includes(r.id)) { skipped++; continue; }
    const claim = await fetchImpl(PENDING.replace("scope=pending", "scope=claim"), { method: "POST", body: JSON.stringify({ id: r.id }) });
    if (!claim.ok || !(await claim.json()).claimed) { skipped++; continue; } // another drain has it
    const { title, body, labels } = issueFor(r);
    run("issue", "create", "--repo", REPO, "--title", title, "--body", body, ...labels.flatMap(l => ["--label", l]));
    filed++;
  }
  return { filed, skipped };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  drain().then(
    ({ filed, skipped }) => console.log(`drain-reports: filed ${filed}, already filed ${skipped}`),
    err => { console.error(`drain-reports: BLIND -- ${err.message}`); process.exit(6); },
  );
}
