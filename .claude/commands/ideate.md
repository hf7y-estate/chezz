---
description: Interactive vision/triage pass -- pull live state, surface blockers and regressions, ask direct design questions, schedule decisions for nightly-batch. Does not implement game code unless explicitly told to inline.
---

This is the interactive counterpart to `/bug-sweep` and `/nightly-batch`
(both unattended). Where those two implement, `/ideate` triages,
prioritizes, and schedules -- it exists because an ordinary interactive
session tends to drift into implementing whatever's asked, which is right
for a concrete bug/feature request but wrong for open-ended
prioritization or a genuine design fork. Default posture here: surface,
ask, record, queue -- not build. The user can always say "just fix that
now" to override this for any one item; that's a normal request, not a
violation of this command.

**This posture holds for the rest of THIS conversation, not just the
first response.** `/ideate` is a one-shot slash command with no harness-
enforced "mode" -- nothing stops drift into build-mode on a later prompt
in the same session unless the model itself keeps holding the line. If a
follow-up prompt later in this same conversation asks for something
build-shaped, treat it the same as if it arrived in the first message:
name it explicitly ("that's a nightly-batch job -- queue it, or fix it
inline now?") rather than quietly switching into building because enough
turns have passed that the original `/ideate` framing feels distant.
(Adopted 2026-07-25 from realisateur's revised ideate.md.)

## 1. Orient

Pull real, current state before saying anything about status:
- `git log --oneline -10`, `git status`, and diff local `main` against
  `origin/main` -- sync first if behind, same as any other run.
- The live tracker -- `gh issue list --repo hf7y-estate/chezz --label
  player-report --state all --json number,state,title,labels --limit
  200` (see `netlify/functions/report.js`) -- don't trust a stale count
  from a prior report.
- `DESIGN-NOTES.md` and the open GitHub issues on `hf7y-estate/chezz` (`gh issue
  list --repo hf7y-estate/chezz --state open`) -- the existing priority queue and
  any already-decided direction. Don't re-ask a settled decision.
- Cross-project state, read-only: whether the account-wide usage/spend
  picture (see prior reports/sweep.log `WARNING`/`spend limit` lines)
  explains anything that looks stalled.
  Never edit another project's files directly from here -- see step 5.

## 2. Find what's actually worth surfacing

Not everything open needs a question. Sort what you find into:
- **Urgent, small, low-ambiguity** (a likely regression, a broken
  reporting/tooling path, a stranded commit) -- flag clearly, propose the
  fix, but don't implement unless told to. These are usually not worth an
  `AskUserQuestion` -- there's only one sensible answer, just say so.
- **Real design forks** -- multiple plausible, conflicting directions, or
  a big unbuilt system several reports assume exists. These are what
  `AskUserQuestion` is for. Ground each question in real counts/quotes
  from the tracker, not vibes -- cite which reports, how many, since when.
- **Already-settled** -- matches something already in `DESIGN-NOTES.md` or
  an existing issue. Don't re-litigate; note it's unchanged and move on.

## 3. Ask, don't guess

For genuine forks, ask directly (`AskUserQuestion`, up to 4 per call,
options with real tradeoffs). Don't implement speculatively while waiting
-- the answer changes the shape of the work, not just its priority.

## 4. Record and queue, don't build

**Park-by-default triage (do this for every idea before recording it).**
Against DESIGN-NOTES.md's current `## Stability milestone` bar, judge each idea:
required to reach that bar? If yes it's `active`; if no, tag it
`(parked)` (or `(waiting: <dep>)` if blocked externally rather than by
choice) with one line of why it's past the bar. Parking is the default
for anything beyond the current milestone -- the metric that matters is
the active set draining, not the parked reservoir shrinking (a free-fed
reservoir is supposed to grow; settled by this project's own 2026-07-20
session, now ecosystem law -- vault:realisateur/STABILITY-MILESTONES.md).
Promoting a parked idea into the active set is a deliberate, stated
decision, never a silent reorder.

**Standard entry shape -- vision, then milestones, then blockers.** When
a session records a real direction (not just a one-line decision), shape
the DESIGN-NOTES.md entry as: (1) **Vision** -- the goal in
plain terms, naming what is NOT decided yet rather than letting silence
imply it is; (2) **Milestone chain** -- numbered, working backward from
the vision, each step concrete enough that "is this idea required for
the current step" is answerable; (3) **Blockers** -- what blocks the
CURRENT step specifically, tagged by who can clear it (human-only vs.
buildable-now). (Zach's repeated ask, 2026-07-24.)

For each decision (from this session or already-settled and just being
re-confirmed):
- Write the decision **and its rationale** into `DESIGN-NOTES.md` --
  future sessions and nightly-batch need the "why," not just the "what."
  If a decision corrects or refines an earlier entry, say so explicitly
  and mark what changed rather than silently overwriting it.
- Open or update a GitHub issue on `hf7y-estate/chezz` for each queued item,
  pointing back at `DESIGN-NOTES.md` for detail -- the open issues ARE the
  priority queue; keep each issue itself short.
- If a decision needs a follow-up the user (not nightly-batch) must
  answer -- scope, credentials, something outside this repo -- file a real
  `question`-labelled issue with `scheduler ask chezz "<question>"`, not
  just a mention in this session's chat output.
- **Do not write feature/game code in this step.** Implementation is
  `/nightly-batch`'s job, working the priority queue on its own schedule.
  Exception: something explicitly urgent and small the user asks you to
  just fix right now -- that's a normal request, treat it normally.

## 4.5. Watch for "vision debt" — the queue growing faster than it drains

Named 2026-07-20 (cross-project pattern, via scheduler's own repo): the
user generates ideas faster than any implementation cadence can stabilize
them, so a priority queue that only ever grows is not a sign this command
is failing — it's the expected shape of the problem. What *would* be a
failure: letting that gap stay invisible. When updating the PRIORITY
the open issue list, if it's been growing for a while without much draining,
**say so explicitly** in this session's summary (step 6) — oldest
un-started item's age, rough queue depth trend — rather than silently
folding another item in. The user's own call whether that's fine (a
backlog is often healthy) or a sign to re-scope; this command's job is
just to make the gap visible, not to solve it unilaterally.

**Oldest-first is a signal, not a binding rule -- but overriding it must
be said out loud.** When a newer idea deserves to jump ahead of an older
one (it unblocks something active, or the older item aged specifically
because it's a bigger/vaguer dream -- see 4.6), state explicitly in the
issue which older item got passed over and why. A silent
reorder is indistinguishable from forgetting the older item existed.

## 4.6. Stable build vs. bigger dream -- the distinction that drives pacing

When triaging any idea, judge which it is: **close to a working, stable
core** (defined near-term shape; building now is unlikely to be
discarded by the idea itself changing -- fine for nightly-batch to keep
iterating unattended) vs. **part of a bigger, still-forming dream**
(likely to morph before anything built against today's shape survives --
e.g. the King->Queen fork before its question issue is answered). For the
second kind, slower-paced iteration is the right lever, not "don't build
at all." Chezz can't edit scheduler's `_paced.conf` weight itself from
here -- if a session concludes the whole project should pace differently,
route that via `scheduler -i scheduler` (step 5); within this repo the
lever is the `(parked)`/`(waiting:)` tags and queue order.

## 5. Cross-project proposals go through the front door

If something learned here is really about the `scheduler` project itself
(a pattern worth generalizing, an engine bug, a template other projects
should get) -- propose it, don't hand-edit `scheduler`'s files directly
from a chezz session (it may have concurrent work in flight, and this
repo isn't the owner of that one). Use its own intake mechanism:
`scheduler -i scheduler "<the proposal>"` -- same front door any project
in this ecosystem uses to suggest something to another.

## 6. Commit, push, and stop

Commit `DESIGN-NOTES.md` changes (expect the
pre-commit hook's full test suite to take a few minutes -- run `git
commit` with a long timeout, not `--no-verify`). Push. End with a short
summary: what's now queued and in what order, which `question`-labelled
issues are still open for the user's own ritual, and explicitly confirm no game
code was touched (or, if the user asked for an inline fix along the way,
what that was and that it's separate from the scheduled queue).
