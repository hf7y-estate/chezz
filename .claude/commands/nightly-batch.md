---
description: Nightly thorough pass -- feature work, redesigns, refactors too big for the bug sweeper, scoped by the open GitHub issues
---

Read the open GitHub issues on `hf7y-estate/chezz` first (`gh issue list --repo
hf7y-estate/chezz --state open`). Everything below is scoped BY that list --
if an accumulated idea in the tracker or backlog is not in service of the
current focus, write it up in the report as deferred; do not implement it
just because it is easy or already sitting there.

This command is designed to run unattended overnight, with no human
review step until the morning. When something needs a human call, defer
it with a clear note in the report AND file it as a `question`-labelled
GitHub issue on `hf7y-estate/chezz` (see step 1 and step 5) rather than guessing.
There is no file channel; the issue tracker is the only one.

## 1. Orient

`git log --oneline -10`, current branch state, `README.md` if one exists,
and the open issue list. If the previous nightly run left work in progress
(check the last report under `~/reports/chezz/`), pick up from there
rather than starting over. Also fetch the full tracker backlog --

```
gh issue list --repo hf7y-estate/chezz --label player-report --state all \
  --json number,state,title,labels,createdAt --limit 200
```

(see `netlify/functions/report.js`) so nothing already resolved gets
re-investigated.

**First run `npm run check-answers`.** This verifies the issues API is
actually reachable -- an unreachable API and a genuinely quiet night both
look like zero answers. Under the old file channel this drifted silently
twice (a header-only stub 2026-07-25; a 6-commits-behind checkout
2026-07-27), both times reading an empty-looking file as "no answers
tonight." If this check fails, fix the channel first; a reply you never
saw is indistinguishable from one he never wrote.

**Read the answered questions from GitHub issues and process them.**
Chezz's questions are `question`-labelled issues on `hf7y-estate/chezz`. There is
no file channel and no on-disk copy of question state — that is the point,
since every copy this project kept went stale. Zach answers by
commenting on the issue and LEAVING IT OPEN. There is no `answered` label —
nothing applies one, and he does not want to. **An issue is answered iff it
carries a comment from `hf7y` that is not agent-stamped**, whatever its
labels and whatever its state. Read them across ALL states:

```
gh issue list --repo hf7y-estate/chezz --label question --state all --limit 200 \
  --json number,state,title,body,labels,comments
```

then filter with `isAnswered` from `scripts/answered-issues.mjs` (the same
predicate `npm run check-answers` reports, so the two cannot disagree). Do
NOT filter by `--label answered` or by `--state open`: each of those has
already dropped Zach's answers on the floor — the label gate ate four of
them for up to 16 days, which is why this section was rewritten 2026-08-14.
`npm run check-answers` above names the open answered issues by number;
that list is what you act on.

For every issue that comes back, treat the human's comment as authoritative
direction, the highest standing there is: act on it as part of tonight's
work, and if it's a standing scope/policy decision, also fold it into
`DESIGN-NOTES.md` so it persists. **Once you have acted on it, close the issue**
with a comment saying what you did — that is the same "removes the block
once it has acted" contract the file channel had, and closing is what stops
it being re-served to the next run. Never edit an issue's BODY; the ask
must survive verbatim. Leave issues with NO unstamped `hf7y` comment
untouched; never re-ask or duplicate one.

**Also check `decision-rot` for answers outside the `question` label.** The
`--label question` query above is the channel `scheduler ask chezz` files
into, but the same "unstamped `hf7y` comment IS the answer" rule applies
estate-wide to issues carrying other labels too (`durable`, `decayable`,
`needs-human`, ...) — 2026-08-28 found four (#11, #30, #32, #15) that had
been genuinely answered 4-5 days earlier and never acted on, because
nothing was checking outside the `question` label. `decision-rot` is the
estate's own tool for exactly this and already gets it right (including
the `<!-- decision-by: ... -->` relay marker, which `answered-issues.mjs`
does not read) — reimplementing its logic here would be the vendored-copy
mistake #35 named. Run it if present, act on anything it lists under
`ROTTING` the same as an answered question, and don't treat its absence as
a failure — it lives in `realisateur`'s verb build, which the GitHub
Actions runner's fresh checkout won't have:

```
command -v decision-rot >/dev/null 2>&1 && decision-rot hf7y-estate/chezz \
  || /usr/local/libexec/selfdev/decision-rot.sh hf7y-estate/chezz 2>/dev/null \
  || echo "decision-rot: not available in this environment, skipping"
```

## 2. Re-verify anything a previous run touched, from scratch

Do not trust a prior run's own claims about what works -- run `npm run
check` (syntax + size + full Playwright suite) and confirm independently
before building further on top of it.

## 3. Work the feature backlog first, then backup work

Per autopilot mode (confirmed 2026-07-17): fetch the feature backlog,
oldest first --

```
gh issue list --repo hf7y-estate/chezz --label player-report --label idea --state open \
  --json number,title,body,createdAt --limit 100
```

Backlog size varies night to night -- work through it until the turn/time
budget runs low, then move to step 5; don't rush every report just to
reach zero. For each report: implement
it, fix it directly if it's actually a mis-filed bug, defer it with a
real reason, or skip it as a duplicate/too-vague -- see `DESIGN-NOTES.md`
for exactly what distinguishes those four outcomes. For anything
implemented or bug-fixed: extend `test/*.spec.mjs`, commit referencing
what was built, then close it the same way `/bug-sweep` resolves bug
reports (a report is a GitHub issue now, `player-report` + `bug`/`idea`
labels -- see that file's step 5 for the full set):

```
gh issue close <N> --repo hf7y-estate/chezz --comment "Shipped in <hash>: <one-line summary>"
```

For anything deferred, `gh issue comment <N> --repo hf7y-estate/chezz --body
"<why deferred>"` and leave it open -- or leave it as-is and just explain
why in the report (skipped as duplicate/mis-filed). Commit as you
complete each feature, not all in one giant commit at the end. Once the
backlog is empty or everything in it this round was
resolved/deferred/skipped, move to whatever backup work `DESIGN-NOTES.md`
currently names as open (its milestone and standing-questions sections),
or bug reports Tier 1 left open needing a human call.

**Park-by-default triage for new vision-scale ideas** (scaffold
convention, vault:realisateur/STABILITY-MILESTONES.md, adopted 2026-07-25):
when something new arrives that is bigger than a scoped feature — a
`scheduler -i` entry, or a tracker report
that is really a direction rather than a change — judge it against
`DESIGN-NOTES.md`'s `## Stability milestone` bar. Required for the current bar →
it's `active`, work it. Past the bar → tag it `(parked)` (or
`(waiting: <dep>)`) with one line of why, and move on. **Never quietly
decline a `scheduler -i` from Zach** (human-directed 2026-07-25): do the
in-scope part, and anything you genuinely can't do from this repo gets a
loud `question`-labelled issue via `scheduler ask chezz` stating what you
need widened
or decided — a decline that only lives in a report is a decline he never
agreed to.

**Sweep the WHOLE open bug queue, first, before the feature backlog.** #41
retired the original two dead Actions runners for monkey's tick alone; #57
later restored a second, uncoordinated one (`.github/workflows/agent.yml`,
daily 09:00 UTC). Check for an open PR or recent branch first. Either way,
nothing else reads the player-report tracker -- unfetched here is unseen.

Fetch `gh issue list --repo hf7y-estate/chezz --label player-report --label bug
--state open --json number,title,body,comments --limit 100` and triage
every report through `/bug-sweep`'s step 2 buckets, then implement, note,
or reclassify it by that command's steps 3 and 5 -- it is still the
procedure, there just isn't a separate Apps-Script-dispatched sweep runner.
A report's `comments` carry any prior sweep's notes now (there is no
separate tracker note field); check the last comment for a `NIGHTLY:`
prefix -- those are the same tier, not a lower one: unambiguous defects a
past sweep punted here.

## 4. Stress-test what you built

Look for the scenarios a first pass typically misses -- edge cases, empty
states, deeper nesting/scale than the happy-path case. Fix what breaks;
note what's genuinely out of scope for tonight.

## 5. Write the report, and flag anything needing a human call

`~/reports/chezz/$(date +%Y-%m-%d).md`, and update `~/reports/chezz/LATEST.md`
to match it. Cover exactly: which feature-backlog reports got
implemented tonight (with commit references) vs. deferred (with the
blocking reason) vs. skipped (with why), what broke and got fixed, any
backup work done once the backlog was clear, and any open questions that
need a human decision. This is read once, quickly, the next time this
machine boots up -- write for that, not for completeness's own sake.

For anything that genuinely needs the user to decide — an ambiguous
policy question, a real tradeoff, a "which of these two directions" fork,
a feature you deferred pending direction — **file it with `scheduler ask`**,
not just the report:

```
SCHEDULER_ASK_VIA="nightly" scheduler ask chezz "<the question, in full, one line>"
```

That opens a `question`-labelled GitHub issue on `hf7y-estate/chezz` and stamps the
id/date/provenance for you. Pass the question text ONLY — putting the date
or provenance first is what made ten different questions render as ten
near-identical stubs, which is why the stamping is done by the tool and not
by you. Add context as a follow-up comment on the issue if one line isn't
enough. The report should point at the issue number, not duplicate its full text.
Don't manufacture a question just to have an entry — a quiet night adds
nothing here.

Note `hf7y-estate/chezz` is a PUBLIC repo, so questions and answers are
world-readable. Don't put anything private in one.

## 6. Before finishing

Confirm every meaningful change has a real commit, landed on `origin/main`
via a branch + PR merged on green (CLAUDE.md's "Landing work"; this
account can't `git push origin main` directly). An overnight run not
actually merged didn't happen. `sweep-status` is computed live from the
most recently closed `player-report` issue (`netlify/functions/report.js`)
-- nothing to POST; closing a report tonight already updates the live
page's readout, `/bug-sweep` step 6's `curl` is just an optional check.
