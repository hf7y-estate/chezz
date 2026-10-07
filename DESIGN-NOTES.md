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
#83) whose deployment had drifted out of sync with git for weeks (#82).
The only leaderboard is a purely-local "Your best", pinned by
`test/local-best-only.spec.mjs` (#15). Live at
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

1. **Auto-march.** Resolved — see "Standing design rules" below
   (`test/auto-march.spec.mjs`).
2. **Terrain (walls + holes, boss gates).** Resolved — see "Standing
   design rules" below (`test/terrain.spec.mjs`, `test/lone-king.spec.mjs`);
   history on hf7y/chezz#120, hf7y-estate/chezz#142.
3. **Material sufficiency: strengthen the tuning proxy.** Resolved —
   see "Difficulty theory" below (#6, #37).
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

  **Three decisions worth not re-litigating**, each pinned by a test:
  - *Zero new dependencies*, and *generation is a deliberate manual step*:
    `test/sprite-pipeline-decisions.spec.mjs`.
  - *Monochrome is enforced by the pipeline, not by the prompt*:
    `test/sprite-postprocess.spec.mjs` ("every opaque pixel snaps to the
    game's monochrome ramp").
  - *Sprites are baked in as data URIs*: `test/piece-sprites.spec.mjs`
    ("every piece in PIECE_SPRITES is a real sprite").

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
     Narrative-only if pursued at all: classic draws Unicode glyphs,
     pinned by `test/classic-unicode-glyphs.spec.mjs` (#95).

  **Superseded 2026-09-07 (#97).** `assets/pieces/` ships a full 16x16 set
  from `tools/generate-glyph-sprites.mjs`, replacing `b-pawn.png`.

## "Chezz Classic" branch — archaeology on #66, engine sync on #89

Created 2026-09-04 pointing at `readable-html`'s tip, the exact
merge-base between `readable-html` and `main` (`6815336`), so the
pre-narrative version of chezz had a discoverable, purpose-named ref
instead of an ambiguous old branch name. Full archaeology and the two
follow-up questions Zach answered (hosting topology, one shared
backlog/engine): hf7y/chezz#66.

Not a frozen snapshot: `chezz-classic` has since taken its own
ported-engine commits ahead of `readable-html` (`git log --oneline
readable-html..chezz-classic`, e.g. #89, #104, #110, #130/#135, #144),
so `git merge-base chezz-classic main` now returns `readable-html`'s tip
rather than `chezz-classic`'s own — expected drift from ongoing engine
unification, not a sign the branch broke.

## Size policy

Pinned by `test/size-policy.spec.mjs` (`scripts/size-policy.mjs`): the
narrative build is never failed for its size, and classic's built,
stripped artifact warns past 50,000 bytes and fails past 100,000. Over
the hard cap, file an issue to raise it rather than trimming to fit.
Classic's long-term aspiration is to get *simpler*, toward fitting on a
Game Boy cartridge. How the artifact is built: hf7y/chezz#89, #90.

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
  reintroduce a saturated or hued palette without a fresh one. Pinned by
  `test/monochrome-palette.spec.mjs`: every color literal in index1.html's
  `<style>` block must be grayscale except the documented signal colors
  (the green/amber/red legal-move threat dots, the red check glow, and the
  white-move-hint star's gold — all already called out as exempt by the
  stylesheet's own comments, except the star, which the test is the first
  thing to name explicitly).
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
- **Neutral piece + knight-upgrade-by-capture chain:** specced #98,
  shipped #111, pinned by `test/neutral-piece.spec.mjs` (capture,
  reactive evasion, the per-piece-type upgrade, no upgrade for a
  King/Knight/Pawn capturer) and `test/knightrider.spec.mjs` (an
  already knight-combined capturer produces a Knightrider instead of
  double-stacking). **Narrative-only** (ruled per #95): classic's build
  excises the spawn (`scripts/build-classic-artifact.mjs`'s
  `transformSpecialCases`).

## Difficulty theory: analytic material sufficiency

Resolved, both closed: hf7y-estate/chezz#6 (`research/balance/` is the
analytic-proofs home for "what White material beats a given Black
composition" — no playtesting/statistics for this question; full framing
in `research/balance/README.md`'s "Open, not yet studied" section) and
hf7y-estate/chezz#37 (the bibliothecaire-access gap that answer also
raised).
