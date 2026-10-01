# Chezz

A daily-seeded roguelike built on chess rules. Live at
https://hf7y.com/chezz/ (GitHub Pages custom domain -- **broken as of
2026-09-25**, see the note below; `https://hf7y-estate.github.io/chezz/`
and `https://chezz.hf7y.com/` both still serve the current build
meanwhile). Full context lives in a few specific files, not here -- read
them, don't duplicate them:

- **Open GitHub issues on `hf7y-estate/chezz`** -- what's in scope right now.
  They are the backlog and the priority queue; there is no file channel.
- `DESIGN-NOTES.md` -- the durable vision/decision record.
- **GitHub issues on `hf7y-estate/chezz`, label `question`** -- open questions
  awaiting a human answer. File one with `scheduler ask chezz "<question>"`;
  Zach answers by **commenting and leaving the issue OPEN** — no label, no
  close. Nothing applies an `answered` label and he does not want to; state
  and labels carry NO information about whether he answered. An issue is
  answered iff it has a comment from `hf7y` that is not agent-stamped
  (`scripts/answered-issues.mjs`, checked across ALL states). The label
  gate that used to be documented here was never real and silently ate
  four of his answers for up to 16 days. The repo is
  PUBLIC -- nothing private in a question. Moved here 2026-07-28 because
  the old on-disk question file was read through a symlinked checkout that
  went stale on every push and silently ate two of Zach's replies. The
  retired coordination files were deleted 2026-08-15 (realisateur#293);
  their history is in git, not on disk.
- **The repo moved from the `hf7y` user account to the `hf7y-estate` org**
  2026-09-25 (realisateur#672, estate-wide). Direct API/CLI object lookups
  (`gh api repos/hf7y/chezz/...`, plain `gh issue list --repo hf7y/chezz`)
  still follow GitHub's rename redirect, but `gh issue list --label ...`
  compiles to a GraphQL *search* query with a literal `repo:` string that
  does **not** follow rename redirects -- every label-filtered query
  against the old name silently returned zero rows, which is what made
  `npm run check-answers` blind tonight. It also wiped this repo's GitHub
  Pages custom domain (`hf7y.com`), breaking the live URL above -- see
  #145, filed with the diagnosis and why it needs a human (org-admin
  Pages scope this account's token doesn't have). References below now
  use `hf7y-estate/chezz`; historical `hf7y/chezz#N` issue citations were
  left as-is since GitHub still resolves them.
- `.claude/commands/bug-sweep.md`, `nightly-batch.md`, `ideate.md` -- the
  three standing modes this project runs in (fast mechanical fixes,
  unattended feature implementation, interactive triage/vision).

## When to suggest `/ideate` instead of just implementing

If an interactive request looks like open-ended prioritization, "what
should we build next," a genuine design fork with no single obviously
correct shape, or a broad "check in on the project" ask -- suggest
running `/ideate` instead of diving straight into implementation. This is
a suggestion, not a gate: if the user says to just build/fix something
specific, do that normally, in the same session, no detour required.
`/ideate`'s own job is pulling live state, asking direct questions on
real forks, and recording/queuing decisions for `/nightly-batch` to
implement -- not something to silently emulate inline without actually
invoking it, since part of its value is the durable record it leaves in
`DESIGN-NOTES.md` and the issue tracker.

## Landing work

Open a branch and a PR, then merge on green — do not push to
`origin/main` directly. An earlier grant here said Claude could push
straight to `origin/main` for ordinary work; this account's own permission
provisioner (`selfdev-permissions-provision.sh` in hf7y/realisateur) denies
`git push origin main` and `git push origin HEAD:main` outright, so the
grant described a route the harness already refuses
(hf7y/realisateur#801). Land by branch + PR instead, matching how work has
actually been landing here. Flag every merge in the next report/summary
(what shipped, why, and how to revert it — `git revert <sha>`). This
does not license skipping review of what goes into a commit, only the
push/merge step. Read it:

```
gh api repos/hf7y-estate/chezz/branches/main/protection \
  --jq '{admins: .enforce_admins.enabled, checks: .required_status_checks.contexts}'
```

That call 403s for this account ("Resource not accessible by integration") --
this account can't read branch protection directly. What the repo's own
ruleset (`gh api repos/hf7y-estate/chezz/rulesets/<id>`, readable) shows as required
is just `gate`; a `mergePullRequest` GraphQL attempt against an actually-blocked
PR reports the real count, e.g. "2 of 3 required status checks are expected" --
the other two (at least `prose / prose`, estate-wide per #68) live in an
org-level ruleset this account can't list either. Found 2026-09-19: every PR
opened by this account gets its `pull_request`-triggered `Test` and `prose`
workflow runs stuck at `action_required` (queued for approval, never
completing) -- a repo/org Actions setting outside this account's reach, not
a code problem. A `workflow_dispatch` run on the same branch can go green
independently, but it does NOT satisfy the stuck check -- branch protection
is still waiting on that specific `pull_request`-triggered run. The fix is
`gh api -X POST repos/hf7y-estate/chezz/actions/runs/<the stuck pull_request-event run's id>/rerun`
(find it with `gh run list --branch <branch> --json databaseId,name,event,conclusion`,
the one with `"event":"pull_request"` and `"conclusion":"action_required"`) --
that reruns in place and reports against the ref auto-merge is actually
watching. Do this for both `Test` and `prose` before assuming a stalled
auto-merge needs anything else.

## Ecosystem protocols

When a change reaches outside this repo, three verbs are the interface. Each
prints its own contract; none of it is restated here, and none of it is a
checklist to recite from memory.

- `notify-senechal <door> <field>=<value>` — file a crontab, device or
  footprint change on senechal's registry. Standing policy for any change to
  crontabs, dotfiles, systemd units or WM config. `--doors` lists the doors.
- `check-project-busy <project>` — before writing DIRECTLY into another
  project's files. Front-door writes carry their own regulator.
- `consulte` — read the estate's own prose.

`discipline` and `BUILD-DISCIPLINE.md` were deleted by hf7y/realisateur#687:
the rows a mechanism already enforced are enforced by that mechanism, and the
rest were unenforced prose. Do not reinstate either here.
