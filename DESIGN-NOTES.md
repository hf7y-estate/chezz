# Chezz — design notes / vision

The durable "big picture" doc for this project, mirroring how the
`scheduler` project keeps its own `DESIGN-NOTES.md` at repo root, outside
`.claude/`. The open GitHub issues on `hf7y/chezz` are the short,
frequently-changing "what's in scope right now" queue nightly-batch reads
first; this file is the
longer-lived record of *why*, for a human or an autonomous run trying to
reconstruct the whole shape of the project without re-deriving it from
scratch. Update it when a real direction gets decided, not every night —
it should read as a slower-moving log of decisions, not a duplicate of
the tracker's day-to-day scope.

## What this game is

A daily-seeded roguelike built on chess rules: White starts as a lone
King, climbs floors fighting procedurally (or, in the narrative campaign's
opening floors, scripted) spawned Black material, and carries surviving
pieces forward floor to floor. `netlify/functions/report.js` backs a live
player-feedback tracker (bug + feature reports, fed by an in-game chat
box) as GitHub Issues on this repo, labelled `player-report` — it
replaced the Google Apps Script tracker (`leaderboard/Code.gs`, retired
#83) whose deployment had drifted out of sync with git for weeks (#82);
the server-side daily/all-time leaderboard it used to also back was
dropped (issue #15, "Option C", confirmed by Zach) in favor of a
purely-local "Your best" in the page itself. Live at
https://chezz.hf7y.com/ (Netlify, #83), the only host. GitHub Pages and
its hf7y.com/chezz redirect (#94) were dropped after the org transfer
unset the Pages custom domain (#145). Zach, 2026-10-01, asked whether to
drop Pages: "yes in favor of netlify right?"; and on keeping a redirect
from the old URLs: "we don't need the redirect then, nothing points to
the old stuff." Full deployment/CI shape in
[[project-chezz-automation]] (memory) — not repeated here.

## Decided direction (2026-07-20, human-directed)

Four vision questions, asked directly, answered directly — recording the
decision and reasoning so a later autonomous run doesn't have to re-derive
or re-ask:

1. **Auto-march — REFINED 2026-07-20, later same session.** The King does
   **not** start marching automatically on level clear. Current behaviour
   (drag-to-step, generalized to every piece, formation-follow as its
   emergent consequence) is a standing design rule, below.
2. **Terrain: build walls + holes together, not staged.** Full system in
   one pass — holes as impassable squares, boss-gated walls that drop
   when that floor's mini-boss is captured. Sequence after auto-march
   (shares the post-combat/floor-progression surface, wants that flow
   stable first) — not explicitly bundled into the same implementation
   pass, just ordered second.
   - The 2026-07-20 "narrow gate, only the King fits through" framing and
     its 2026-09-23 correction (hf7y/chezz#120 — the gate didn't actually
     block anything) are both superseded by hf7y-estate/chezz#142's
     2026-10-01 fix and now live only as history on that issue. Current
     behaviour is a standing design rule, below.
3. **Material sufficiency: strengthen the tuning proxy.** Pure
   engineering (deeper search, real king-safety/tactical eval instead of
   material-only), no playtesting asked of the user. This can run as
   backup/parallel work — doesn't block or get blocked by auto-march/
   terrain.
4. **King→Queen: worth exploring as its own project**, explicitly not
   bundled with the archbishop/bishop-pair numeric tweaks (those stay
   deferred, untouched — no new data justifies another guess at either).
   Given this changes the core tension of the game (the King's fragility
   *is* the game today), this needs a **design spec written and reviewed
   before any implementation starts** — same irreversibility instinct
   the standing redesign-defer criterion already applies to
   core-rule-touching work, now explicitly greenlit for exploration rather
   than indefinite deferral. Nightly-batch's job here is to draft the
   spec into this file (what changes, what stays, how it interacts with
   the King's exit-row win condition, spawn/threat balance, etc.) and
   surface it as a `question`-labelled issue for a checkpoint — not to start writing
   game code against a redesign this size without one. **That spec was
   drafted 2026-07-24 and is superseded on its central question** (the answer
   is royal progression, not a 1:1 replacement); it was deleted here rather
   than left as a trap. Live status and the answer: hf7y/chezz#32.

## Deep feature ideas (recorded 2026-07-20, NOT scoped for implementation)

User-originated ideas, deliberately captured here rather than left to
verbal memory, but explicitly not queued for nightly-batch yet — each
needs its own scoping pass before it's implementation-ready. Treat this
section as a seed list a future vision session picks from, not a to-do
list nightly-batch should start executing against.

- **Neutral evasive flavor piece + knight-upgrade-by-capture chain.** A
  neutral (half-white/half-black) horse-shaped piece that always tries to
  evade capture, appearing as flavor content on the pawn-fodder/terrain
  levels. Capturing it grants the capturing piece a permanent "+knight"
  upgrade — merges knight movement onto whatever piece took it:
  Bishop→Archbishop, Rook→Chancellor, Queen→Amazon. A piece that's already
  knight-combined (i.e. would become knight+knight) becomes a
  **Knightrider** instead — a fairy piece that repeats knight-move steps
  in a straight line — with a proposed graphic treatment of an
  upside-down knight glyph to visually distinguish it. Needs: capture
  logic for a non-aligned/neutral third side, an evasion AI for the
  neutral piece, upgrade-application logic per piece type, and a
  Knightrider move-generator (doesn't exist in the current fairy-piece
  set — Archbishop/Chancellor/Amazon are simple move-set unions, a
  knightrider's repeated-knight-step movement is a different shape of
  rule entirely). **Narrative-only** (ruled per #95): #89's core is what
  classic can afford, so this sits above it, in narrative.
- **Graphics pipeline — SIGN-OFF GRANTED 2026-07-27, track 1 built.** Zach
  answered the standing new-external-dependency gate in scheduler
  the then-current file channel: *"Yes, pursue the gemini path, safe bounded
  account balance exists for testing precisely this. Lift creds from
  vkv-inventory if possible pending the creation of chezz specific ones."*
  Track 1 is now implemented (see below for what was built and the one
  thing still missing); track 2 (the fairy-piece font) is untouched and
  still has no gate on it.

  **What shipped 2026-07-27 (nightly):**
  - `tools/generate-pieces.mjs` — prompts `gemini-2.5-flash-image` for all
    18 pieces (9 types × 2 sides) over plain `fetch`, no SDK.
  - `tools/sprite-postprocess.js` — chroma-keys the magenta field out,
    crops to content, fits-and-centers into 32×32, and snaps every pixel to
    the game's own monochrome ramp. Runs on a Playwright canvas.
  - `tools/wire-pieces.mjs` — bakes `assets/pieces/*.png` into
    `index1.html`'s `PIECE_SPRITES` as base64 data URIs.
  - `index1.html` — `pieceGlyphHtml` renders a sprite when one exists and
    the Unicode glyph when one doesn't, **per piece**.

  **Three decisions worth not re-litigating:**
  - *Zero new dependencies.* vkv-inventory's version needs Python +
    `google-genai` + Pillow + numpy. Chezz is a Node repo with no Python,
    and Playwright (already a devDependency, since `npm test` is Playwright)
    ships a browser whose `<canvas>` does every pixel operation Pillow was
    doing. So the port is a rewrite, not a copy — same pipeline shape, none
    of the install footprint.
  - *Monochrome is enforced by the pipeline, not by the prompt.* The palette
    snap means a sprite CANNOT come back off-palette even if the model
    ignores the instruction. The monochrome constraint is a standing human
    decision; leaving it to prompt compliance would have made it a
    coin-flip.
  - *Sprites are baked in, and `PIECE_SPRITES` ships empty.* Data URIs keep
    chezz a single self-contained HTML file (what makes the share links, the
    `file://` test harness and the Pages deploy work with no build step).
    Empty-by-default means the committed game is byte-for-byte the glyph
    game it was, and generation is a deliberate manual step — never a side
    effect of `npm run check` or a nightly run, since each run costs money
    and returns different art.

  **The partial sprite set is the designed, tested state, not a blocked
  pipeline** (corrected per #95; standing answer Zach, in #32: asked to
  lift a key from `vkv-inventory` or provision a chezz one,
  he chose **neither** — no `GEMINI_API_KEY` needed, one shipped sprite
  (`assets/pieces/b-pawn.png`) is the design, `pieceGlyphHtml` falls back
  to Unicode for the rest).

  The original two-track note, with one correction below (track 2's
  association with Classic did not survive #89/#95):
  1. **Autonomous AI-generated sprites**, extracting and adapting the
     pixel-art Gemini API workflow already built in the `vkv-inventory`
     project, made autonomous for chezz. **This is a NEW external service
     dependency** (an image-generation API call) — the standing gate
     already reserves this for explicit user sign-off, no autopilot
     exception (this is the same gate the tracker's existing
     `2026-07-17T07:25:16.315Z` sprite-replacement report is deferred
     behind). Cross-project too: would need coordinating with whatever
     `vkv-inventory`'s workflow actually looks like today, not something
     to build blind from a one-line description.
  2. **A custom font file with real typography for the fairy pieces**
     (Archbishop/Chancellor/Amazon/Knightrider etc., which today lean on
     Unicode knight-combo glyphs). No new external service dependency in
     the same sense — an asset-creation project, not an API integration.
     Was associated with "Chezz Classic" below; ruled out (2026-09-04,
     #95) — **classic's visual identity is Unicode glyphs, permanently**,
     its artifact budget (#89, #90) can't carry baked sprites, so this
     track is narrative-only if pursued at all.

  **Superseded 2026-09-07 (#97).** `assets/pieces/` ships a full 16x16 set
  from `tools/generate-glyph-sprites.mjs`, replacing `b-pawn.png`.

## "Chezz Classic" — all three questions resolved; work is #89

Raised 2026-07-20: the user wants an older version of chezz — at the time,
live at `hf7y.com/chezz.html`, which redirected to an OCF Berkeley-hosted
copy (note: **not** `hf7y.github.io/chezz/`, the current live site this
repo's automation deploys) — developed as **"its own production
stream."** The user confirmed directly: the code lived on `main`, and
narrative-campaign work eventually overwrote it there (file content, not
git history — the commits themselves were never destroyed).

**Resolved by git archaeology, not guesswork**: `readable-html` (an
already-existing branch, still pushed to `origin`) is the **exact
merge-base** between itself and current `main` — `git merge-base
readable-html main` returns `readable-html`'s own tip (`6815336`,
2026-07-16, "Merge simplify-and-polish: dedup pass, mobile touch-drag
fix, promotion dialog fix"), and `git log --oneline readable-html..main`
starts with `c13e228 Add a scripted narrative campaign` as the very first
commit past it. That's a clean, unambiguous boundary — no divergent
history to reconcile, no guessing between candidate branches. **Action
taken**: created and pushed a clearly-named `chezz-classic` branch
pointing at that same commit (`git branch chezz-classic readable-html`),
so it's a discoverable, purpose-named reference going forward instead of
an ambiguous old branch name — `readable-html` itself was left alone
(unchanged), `chezz-classic` is a second ref to the same commit.

**Questions 2 and 3 answered by Zach, 2026-09-04 (realisateur `/ideate`),
in hf7y/chezz#66:**

2. `hf7y.com`'s topology has since changed: Zach repointed it away from
   the OCF-Berkeley redirect, and it is now his GitHub Pages root
   (confirmed 2026-09-04: `dig +short hf7y.com` resolves to GitHub
   Pages' IPs, `hf7y/hf7y.github.io`'s Pages API reports `status:
   "built"`, `cname: "hf7y.com"`, and `https://hf7y.com/chezz/` answers
   200 — re-verified independently 2026-09-05, still 200). Publishing
   there unattended is a solved problem now; the earlier "sandbox cannot
   reach `hf7y.com`" note above was a stale artifact of the old topology,
   not a standing restriction.
3. Classic runs in the **same** stream as chezz narrative, not a second
   registered scheduler project — one repo, one backlog, one intake.
   That depends on the in-game report intake existing (#83) and on
   classic and narrative sharing one engine (#89, see below).

Both questions are closed out on #66 as of this write-up.

## Size policy — decided 2026-07-25 (human reply in that day's report)

The index1.html byte limit is **abandoned for chezz narrative** (the
build on `main`, hosted publicly). The 2026-07-24 "only ~2.5KB of
headroom, urgent" framing is retired: `scripts/check-size.mjs` now
prints the size on every run (creep stays visible) but never fails the
narrative build, and size must never again be the reason a feature is
pre-deferred — do the work, run the checks after, and if a real limit is
ever exceeded, be noisy about it (file an issue for Zach with
`scheduler ask chezz "..."` to raise the threshold before continuing)
rather than quietly deferring or trimming.

The limit stays **enforced on classic** — the elegance/efficiency track:
future dev passes there work to make the project *simpler*, with a
stated long-term aspiration of fitting on a Game Boy classic cartridge.
Caps on classic remain 50,000 soft / 100,000 hard.

Revised 2026-09-04 (#90): the cap is on the **published artifact**, not
`chezz-classic`'s own commented `index1.html`. `bin/build-site.sh` and
`scripts/check-size.mjs` both strip that source (`scripts/strip-html.mjs`)
before measuring or publishing it.

Revised again 2026-09-05 (#89): the artifact is now **built**, not just
stripped. `scripts/build-classic-artifact.mjs` splices narrative's
current pure-computation engine functions (move generation, legality,
search/eval, spawn) into classic's own shell (its HTML/CSS, the Apps
Script leaderboard, promotion UI, drag/click handling — everything that
isn't engine) — the one piece of #89's "one engine source" this repo can
land without also porting narrative-only features like terrain and
drag-step (real, separate follow-up work, not implied by this). Both
`bin/build-site.sh` and `scripts/check-size.mjs` run this build before
measuring or publishing, so a future engine fix on `main` reaches
classic's next build with no manual port — the artifact lands at 41,010
bytes, no branch-name gate needed.

This supersedes: the 2026-07-14 "stop and revisit rather than cut
comments" call (narrative side — moot now that nothing needs cutting),
and closes the 2026-07-24 size question (answered 2026-07-25).

## Stability milestone

**Current:** the autopilot loop is stable — players file ideas in-game,
unattended nightly runs ship or triage them, and anything needing Zach
reaches him as a `question`-labelled GitHub issue on `hf7y/chezz` instead
of stalling silently. Judge every new idea against this bar: required to
hold it → `active`; past it → `(parked)` (or `(waiting: <dep>)`) with one
line of why.

## Decided 2026-10-01 (Zach) -- the rulings live on the issues, quoted

- Dispatch, the Actions agent's retirement, the prose guard: #36.
- Every floor, every pawn: #139. Floor 7: #140. Boss gates and the draw: #142.
- This file becoming tests: #150.

## Standing design rules (migrated off the retired file channel, 2026-08-15)

Resolved human design calls that were living only in the coordination
files deleted in realisateur#293 (their history is in git). They are decisions, not backlog:

- **Death / respawn:** pinned by `test/death-respawn.spec.mjs` (provenance
  and reasoning in that file's header comment, issue #4).
- **Scripted bosses:** pinned by `test/spawn-safety.spec.mjs`'s "scripted
  lone-boss stages are never capturable on move 1 by a plausible carried
  army" (provenance and reasoning in that test's own comment).
- **Colour scheme is monochrome** — an explicit, repeated human ask. Do not
  reintroduce a saturated or hued palette without a fresh one. (No test
  pins this yet — it's a UI-wide property, not covered by the sprite-palette
  check in `test/sprite-postprocess.spec.mjs`.)
- **Move-into-check:** pinned by `test/move-into-check.spec.mjs` (provenance
  and reasoning in that file's header comment).
- **Audio + vibration:** pinned by `test/earcons.spec.mjs` (provenance and
  reasoning in that file's header comment, issue #5).
- **Boss gates:** pinned by `test/terrain.spec.mjs` (the gate seals the
  whole exit row and drops only once the floor's boss piece is captured)
  and `test/lone-king.spec.mjs` (a lone King that can never force that
  capture gets a toggleable ending instead of a soft-lock — fifty-move
  draw by default; provenance and reasoning in that file's header
  comment, issue #142).
- **Auto-march (drag-to-step):** pinned by `test/auto-march.spec.mjs`
  (provenance and reasoning in that file's header comment) — dragging any
  piece snaps to the nearest legal move to the drop point rather than
  requiring a precise destination drop, the mechanism generalizes to every
  piece including the Knight (`nearestLegalMove`, `1f51a1e`), and
  formation-follow (naive strongest-first rank-up once Black is cleared)
  is that same mechanism's emergent consequence, not a separate system.
  (No test pins an animated "step toward it" walk in place of the instant
  snap — it isn't built.)

## Difficulty theory: analytic material sufficiency (answered 2026-08-16, issue #6)

`research/balance/` (the scholarship lane, [[project-chezz-research]] if
that memory exists) is confirmed as the right home for the open "what
White material is actually needed to beat a given Black composition"
question — no separate theory/math branch. The method is constrained,
too: **analytic proofs, not playtesting or statistics.** AGENT
playtesting (an unattended run burning turns self-playing floors to
gather empirical data) is explicitly NOT in scope for this question, even
though it's a tool nightly runs otherwise have available — this is
theoretical work, not experimental. Full framing in
`research/balance/README.md`'s "Open, not yet studied" section.

Zach's answer also asked that an issue be filed with a project called
"bibliothecaire" to request research help. That repo isn't reachable from
this run's environment — no `hf7y/bibliothecaire` (or similarly-named)
repo exists under the `hf7y` GitHub account, and neither the `scheduler`
nor `discipline` CLIs are on PATH here to resolve an internal project
alias to a real remote (see the infra-gaps note this same run filed,
issue #9's pattern repeating in a plain runner environment this time, not
just on `monkey`). Filed as a `question` issue on `hf7y/chezz` instead of
guessing at a URL.
