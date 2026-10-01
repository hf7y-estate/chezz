// The answer channel is the load-bearing half of autopilot: automation asks a
// question, Zach replies, and the next unattended run reads the reply and acts
// on it. That loop only works if the place Zach writes is the SAME place the
// run reads.
//
// Twice under the FILE channel it wasn't, and both times the loss was silent:
//   2026-07-25 (`7beef04`) — Zach's 10:00 edit landed in a header-only stub at
//     the stale `.claude/` path; the real questions were elsewhere.
//   2026-07-27 — the scheduler's `questions/chezz.md` symlink pointed at a
//     checkout 6 commits behind origin/main, so the three questions filed that
//     day were invisible to him and the four he COULD see were stale.
//
// 2026-07-28: QUESTIONS MOVED TO GITHUB ISSUES (human-directed, "move the full
// chezz over to test the github issues pipeline"). The failure above was never
// really about symlink hygiene — it was about keeping a COPY of question state
// on disk at all. The replacement keeps none: `scheduler -q chezz` renders the
// open `question`-labelled issues fresh from the API into a throwaway buffer
// and deletes it on exit. There is nothing left to drift.
//
// So the invariant this file asserts has changed shape, but not purpose. It is
// no longer "two files match"; it is **"this run can actually reach the place
// Zach's answers live."** That still has to fail LOUD, for exactly the old
// reason: an unreachable API and a genuinely quiet night both look like zero
// answers, and a reply never seen is indistinguishable from one never written.
//
// 2026-08-15: THE FILE CHANNEL IS GONE ENTIRELY (realisateur#293). FOCUS.md
// was the last half still on it, compared byte-for-byte against a symlinked
// scheduler checkout. Both copies are deleted; scope now lives in the same
// GitHub issues the questions do, so there is one channel here, not two.
//
// 2026-08-14: A THIRD silent loss, this one on the issues channel and caused
// by this very file. It counted an answer as `labels.includes("answered")`,
// a label nothing has ever applied, so it printed "N open question(s), 0 of
// them answered" and exited OK while #3/#4/#5/#6 held real direction in
// their comments — #3's since 2026-07-29, sixteen days. A check that passes
// on the exact failure it exists to catch is worse than no check. The
// predicate now lives in `answered-issues.mjs` and reads COMMENTS, not
// labels, across ALL issue states.
//
// EXIT CODES — a pass that reached nothing is not a clean pass:
//   0  reached GitHub, everything readable
//   2  BLIND: could not look at all (gh missing, network, auth, no issues
//      came back). Distinct from 0 on purpose — "no answers tonight" and
//      "could not look" are the two things this file exists to tell apart.
//
// Deliberately NOT part of `npm run check`: `check` runs in the pre-commit
// hook, and a network blip or an expired token must not block the very commit
// that fixes it. It is wired into the two standing run modes instead
// (`.claude/commands/nightly-batch.md`, `bug-sweep.md`), which is where acting
// on a missed answer actually matters.
import { execFileSync } from "node:child_process";
import { isAnswered } from "./answered-issues.mjs";

// One source for the repo whose issues carry chezz's questions. Derived from
// the same conf field `scheduler` itself derives it from, so the two cannot
// disagree; the literal below is only the fallback for a checkout with no
// scheduler beside it.
//
// 2026-09-25: the estate moved every repo from the `hf7y` user account to
// the `hf7y-estate` org (realisateur#672). Direct REST/GraphQL object
// lookups (and plain `gh issue list`) follow GitHub's rename redirect fine,
// but `gh issue list --label` compiles to a GraphQL *search* query with a
// literal `repo:hf7y/chezz` string -- search does not follow rename
// redirects, so every label-filtered query against the old name silently
// returned zero rows. That is exactly the failure mode this file exists to
// catch, and it was the one actually live tonight.
const ISSUES_REPO = process.env.CHEZZ_ISSUES_REPO || "hf7y-estate/chezz";
// The account whose unstamped comments ARE the answers -- Zach's own user
// account, which does NOT move when the repo does. Deriving this from
// ISSUES_REPO's owner segment was safe only as long as the repo's owner and
// Zach's account happened to be the same string; the 2026-09-25 org move
// (hf7y user -> hf7y-estate org, realisateur#672) broke that coincidence.
// Comments are still authored by the user `hf7y`, never by the org, so this
// must stay pinned to the user account regardless of which account now owns
// the repo -- getting this wrong silently turns real answers invisible
// again, the exact failure class this file exists to catch.
const OWNER = process.env.CHEZZ_ANSWER_OWNER || "hf7y";

const blind = [];

// --- the issues channel, the only channel -------------------------------
//
// Three things have to hold, and each is checked separately so the message
// names which one broke rather than a generic "gh failed".
function checkIssuesChannel() {
  let out;
  try {
    out = execFileSync(
      "gh",
      // ALL states. `--state open` would miss an answer left on an issue a
      // previous run already closed; `--state closed` would miss the four
      // open ones Zach answered in place. Both have dropped answers.
      ["issue", "list", "--repo", ISSUES_REPO, "--label", "question",
       "--state", "all", "--limit", "200",
       "--json", "number,state,labels,comments,title"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
    );
  } catch (err) {
    const detail = (err.stderr || err.message || "").toString().trim();
    blind.push(
      `cannot reach the GitHub issues for ${ISSUES_REPO}, where Zach's answers live.\n` +
      `      This run CANNOT tell "no answers tonight" from "could not look".\n` +
      `      gh said: ${detail || "(no output)"}\n` +
      `      Check: gh auth status   (note it can show one FAILING account\n` +
      `      alongside a working one — read the whole output before concluding\n` +
      `      the credential is dead; that misreading cost two days in 07/2026).`
    );
    return;
  }

  let issues;
  try {
    issues = JSON.parse(out);
  } catch {
    blind.push(`gh returned output that is not JSON for ${ISSUES_REPO}. Raw: ${out.slice(0, 200)}`);
    return;
  }

  if (issues.length === 0) {
    blind.push(
      `zero \`question\`-labelled issues came back from ${ISSUES_REPO}.\n` +
      `      That is not "a quiet night" — chezz's questions have never been\n` +
      `      empty since the channel moved to issues on 2026-07-28. Either the\n` +
      `      label was renamed, the repo is wrong, or the token can read the\n` +
      `      repo but not its issues. This run CANNOT tell "no answers" from\n` +
      `      "could not look", so it refuses to report OK.`
    );
    return;
  }

  const answered = issues.filter((i) => isAnswered(i, OWNER));
  const openAnswered = answered.filter((i) => i.state === "OPEN");
  console.log(
    `check-answer-channel: questions channel OK — ${ISSUES_REPO} reachable, ` +
    `${issues.length} question issue(s) across all states, ` +
    `${answered.length} carrying an answer from ${OWNER}` +
    (answered.length ? ` (#${answered.map((i) => i.number).join(", #")})` : "") +
    `; ${openAnswered.length} still OPEN and awaiting this run` +
    (openAnswered.length
      ? `: #${openAnswered.map((i) => i.number).join(", #")}`
      : ".")
  );
}

checkIssuesChannel();

if (blind.length) {
  console.error("\ncheck-answer-channel: BLIND — THIS RUN COULD NOT LOOK\n");
  for (const b of blind) console.error(`  - ${b}\n`);
}

process.exit(blind.length ? 2 : 0);
