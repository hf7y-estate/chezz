---
description: Fetch open Chezz bug reports, fix the mechanical ones, leave notes on the rest, commit, and mark resolved reports on the tracker
---

Run one sweep of the live Chezz bug tracker. This command is designed to run
unattended — don't block on interactive confirmation; when something needs
a human call, leave it open with a note instead of guessing.

**This command has no runner of its own as of 2026-08-19.** Its Actions
workflow was deleted with `nightly-batch.yml`; `/nightly-batch` (run from
`.github/workflows/agent.yml` at 09:00 UTC daily, and also from monkey's
self-dev tick) now sweeps the bug queue itself and follows the steps below.
Run this by hand when you want a sweep between ticks.

## 1. Fetch open reports

The tracker is `netlify/functions/report.js` (hf7y/chezz#83, replacing the
Google Apps Script backend whose deployment had drifted out of sync with
git for weeks -- #82). Every report is a GitHub issue on this repo,
labelled `player-report` plus `bug` or `idea`, so the fastest path is
`gh` directly against the repo rather than the function's own read scope
(which exists for the in-game page, not for a sweep that already has repo
access):

```
gh issue list --repo hf7y-estate/chezz --label player-report --label bug --state open \
  --json number,title,body,createdAt,labels --limit 100
```

Each report's `body` ends with a machine-readable footer
(`netlify/functions/report.js`'s `issueBody`):

```
- player: `<6-hex name>`
- build: <the exact in-game position URL the reporter was looking at>
- kind: bug|idea
```

Open the `build` URL in context if the description text alone isn't
enough to understand the bug. Reporters pick "bug" vs. "feature" for
themselves when filing (two separate links in the game UI), so most
reports arrive already correctly labelled -- but read the description
anyway, since a reporter can still misjudge their own report.

`gh issue list --label player-report --label idea --state open` is the
feature backlog `/nightly-batch` step 3 works from; this fast sweep only
triages the `bug`-labelled queue (see step 2).

## 2. Triage every report into exactly one bucket

- **Mechanical fix** — a concrete, reproducible defect with an unambiguous
  correct behavior, verifiable by running this repo's own test suite (no
  real mobile device or external service needed to confirm it).
- **Actually a feature idea, not a bug** — balance/tuning judgments (e.g.
  piece pricing), AI move-quality/"weird trade" complaints, performance/UX
  work (e.g. search caching, loading indicators), or anything filed as a
  bug that's really a design question. Reclassify it (see step 5) rather
  than leaving it in the bug queue with a note — the feature backlog isn't
  held to "must eventually resolve," so it's the right place for open-ended
  ideas to sit.
- **Needs a human call, but is a real bug** — a genuine defect where the
  correct fix isn't obvious, or you can't verify it in this sandbox (e.g.
  real mobile-browser touch behavior, no WebKit available here). Stays in
  the bug queue, open, with a note — rare in practice; most non-mechanical
  reports turn out to be the previous bucket instead.
- **Real, unambiguous bug, but too big for this fast sweep** — a genuine
  defect (clear correct behavior, no human judgment call needed) that
  nonetheless needs more implementation depth than a quick sweep budget
  covers (e.g. touches move-generation/legality core logic, spans several
  functions, needs new test scaffolding beyond a one-off regression case).
  Punt it to the nightly run rather than leaving it as a
  vague "needs a human call" note — prefix the tracker note with
  `NIGHTLY:` (see step 5) so `/nightly-batch`'s backup-work pass picks it
  up and actually implements the fix, no human call required unless the
  fix itself turns out to be ambiguous.
- **Duplicate of an already-tracked issue** — matches something covered by
  an existing code comment/regression-test pin (check comments near
  relevant logic and `test/*.spec.mjs` first).

Don't resolve balance/design/feature-idea reports as "fixed" on your own
judgment, and don't implement a feature idea here in the fast sweep — that's
deliberately not this tier's job. Reclassifying into the feature backlog is
what hands it to the nightly run (`.claude/commands/nightly-batch.md`),
which is where feature implementation actually happens.

## 3. Implement each mechanical fix

- Locate the relevant code (this is a single-file game in `index1.html`;
  `netlify/functions/report.js` is the separate tracker backend, deployed
  by Netlify straight from `main` -- no separate push/deploy step exists
  for it the way Apps Script needed one).
- Write or extend a regression test in `test/*.spec.mjs` for the fix.
- **Verify the test actually catches the bug**: temporarily revert your
  fix, confirm the new test fails, then reapply the fix and confirm it
  passes. A test that passes both with and without the fix isn't proving
  anything — don't skip this step.
- Run `npm run check` (syntax + size + full Playwright suite). All tests
  must pass; the pre-commit hook will enforce this again anyway.

## 4. Commit, branch, PR

One commit for the sweep (or several if the fixes are unrelated enough to
tell apart in history — use judgment), following this repo's commit style:
short imperative summary line, a body explaining *why* each fix matters,
not just what changed.

Then push a uniquely named branch, open a PR into `main`, and run
`gh pr merge --auto --squash`.

**`main` is protected and requires the `gate` check** (ruleset "Chezz main
protection", 2026-08-15). A direct push is rejected, and auto-merge waits
for CI. Before that ruleset existed, `--auto` on an unprotected branch
merged *immediately and unreviewed* while printing nothing and leaving
`autoMergeRequest: null` — so a run could believe it had been refused when
it had in fact already landed. That is fixed, but don't reintroduce it:
never `--admin`, never push `main` directly.

## 5. Update the tracker

A report IS a GitHub issue now (`player-report` + `bug`/`idea` labels), so
resolving, reclassifying, and noting are ordinary issue operations against
this repo, not writes through the function.

For each report you fixed, close it referencing the commit hash:

```
gh issue close <N> --repo hf7y-estate/chezz --comment "Fixed in <hash>: <one-line summary>"
```

For a report that's actually a feature idea, reclassify it instead of
closing or noting it in place — this moves it out of the bug queue into
the feature backlog, open, so it doesn't need re-triaging on every future
sweep:

```
gh issue edit <N> --repo hf7y-estate/chezz --remove-label bug --add-label idea
gh issue comment <N> --repo hf7y-estate/chezz --body "<why this is an idea, not a defect>"
```

For a genuine bug that needs a human call on the fix itself, comment but
leave it in the bug queue, open:

```
gh issue comment <N> --repo hf7y-estate/chezz --body "Needs: <what a real fix/decision would require>"
```

For a genuine bug that's unambiguous but too big for this sweep, same
call, but prefix the comment with `NIGHTLY:` so `/nightly-batch`'s
backup-work pass recognizes it as a punted implementation task rather than
a stalled human-call item:

```
gh issue comment <N> --repo hf7y-estate/chezz --body "NIGHTLY: <what the real fix needs -- scope, affected functions>"
```

Confirm by re-fetching `gh issue list --label player-report --label bug
--state open` afterward and checking the report no longer appears (or
does, if you reopened one, or reclassified it out of the `bug` label).

## 6. Sweep status is automatic -- nothing to record

`?scope=sweep-status` on `netlify/functions/report.js` computes its answer
live from the most recently *closed* `player-report` issue -- there is no
separate status write to make, and nothing here can get out of sync with
what you actually closed in step 5. Optionally confirm the in-game "Bug
sweep last ran…" line will pick up this sweep:

```
curl -s "https://chezz.hf7y.com/.netlify/functions/report?scope=sweep-status"
```

## 7. Report a summary

Start with the exact heading `## Summary` (not a variant like "Sweep
summary" -- this run is logged alongside every other run, unattended, and a
consistent heading is what makes the log grep-able later) and one compact
result line directly under it:

```
Fetched: N (M new) · Fixed & pushed: F · Reclassified: R · Left open: L
```

Below that, in prose: what got fixed and committed, what got reclassified
as a feature (and why), what got a note-only bug left open, and how many
new reports came in since last sweep. Don't resolve or reclassify more than
a handful of reports in one sweep without flagging anything that felt like
a judgment call in the summary, even if you didn't block on it.

## 8. Flag a genuine judgment call as a GitHub issue (rare)

If the sweep surfaces something bigger than a routine tracker note — an
ambiguous policy question, a real tradeoff, a "which of these two
directions" fork — file it with:

```
SCHEDULER_ASK_VIA="bug-sweep" scheduler ask chezz "<the question, in full, one line>"
```

That opens a `question`-labelled issue on `hf7y-estate/chezz` and stamps the
id/date/provenance itself — pass the question text ONLY. Add context as a
follow-up comment if one line isn't enough. Most sweeps add nothing here —
don't manufacture a question. `hf7y-estate/chezz` is PUBLIC; nothing private.

GitHub issues are the question channel, and the backlog. There is no file
channel: the retired coordination files were deleted 2026-08-15, so a
reference to one in an old report or commit points at nothing.

Before filing, run `npm run check-answers` (fast, no browser). It confirms
the issues API is actually reachable — under the old file channel the
equivalent drifted twice, and a question filed into a copy Zach never sees
is worse than no question at all, because the tracker note will claim it's
awaiting him.

Answer processing is the **nightly's** job, not this sweep's. Zach answers
by commenting on the issue and LEAVING IT OPEN — no label, no close. An
unstamped `hf7y` comment IS the answer, whatever the issue's labels or
state. `/nightly-batch` reads those across all states, acts, and closes.
This fast sweep must NOT act on or close an answered issue itself.

That handoff is real as of 2026-08-15 and was not before: `/nightly-batch`
had no workflow running it, so this sweep was correctly declining answered
issues and passing them to a consumer that never ran. Four issues Zach had
greenlit sat unbuilt for four days. It is now scheduled
(`.github/workflows/agent.yml`, 09:00 UTC daily) and also dispatched from
monkey's self-dev tick. If you are tempted to relax this rule, check that a
runner still exists first — the rule is only safe while something on the
other side of it is running.
