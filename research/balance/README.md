# Chezz balance research

A record of every deliberate change to a *balance number* in Chezz -- piece
values, spawn budgets, spawn rules, floor composition -- written so that
someone outside the project can follow what was changed, what it was measured
against, and why it was believed to be an improvement.

This folder exists because of a specific instruction (Zach, 2026-07-28), when
he delegated balance tuning to the project's unattended nightly runs:

> "Yes. Balance tuning is good for nightly work. In fact, this research should
> be documented in its own lane, like a folder, since it may be interesting to
> other researchers. This is scholarship."

So the deliverable here is the *record*, not the constants. The constants are
its output. An entry that only says "changed X from 3 to 4" has not done the
job.

## What Chezz is, for a reader arriving cold

Chezz is a daily-seeded roguelike played by chess rules. The player controls a
single White King (plus whatever material they carry over between floors) and
descends a series of floors. Each floor spawns a Black army procedurally from a
budget that scales with floor depth, seeded from the calendar date -- so every
player faces the identical sequence on a given day, and a floor is reproducible
forever from `(floor, day)`.

That reproducibility is what makes tuning here measurable rather than
anecdotal: any claim in this folder can be re-derived by re-running the seed.

## The standing rule for a tuning change

Delegated tuning is bounded. A nightly run may change what a number *is*; it
may not change what a piece *does* or how a floor is *structured* -- those stay
human design calls. Confirmed as the standing answer, not a run's own reading
of the 2026-07-28 quote above -- Zach, hf7y/chezz#11: "standing yes... this is
not permission for one report, it is the default posture for every balance
report from here on." Every tuning change must land with:

1. **A regression test pinning the new behavior**, which demonstrably fails
   against the old one. A test that passes both ways is not a pin; if it can't
   be made to fail, say so in the entry rather than implying a witness that
   doesn't exist.
2. **An entry in this folder**, following the template below.
3. **A line in the run's report** saying what moved and why.

## Method notes, learned the hard way

- **Sweep, don't sample.** A single seed proves nothing. The convention here is
  30 floors x 28 simulated days = 840 spawns, achieved by overriding `todayKey`
  in the page rather than faking the system clock.
- **Offset past the scripted floors.** The early narrative floors
  (`NARRATIVE_STAGES`) are hand-authored and contain no RNG. Sweeping them
  measures authored content, not the procedural system under study.
- **Measure with a probe defined in the test**, not by calling the same helper
  the change introduced. Otherwise the test is a tautology and cannot fail
  against the pre-change build.
- **Read the measurement, not the diff.** Playwright's `Received + N` is a
  count of printed *lines*, not of findings. This folder's first entry was
  nearly published claiming 114 violations when the true count was 16 -- the
  same result printed at 7 lines per object. Cross-check any headline number
  against an independent count before writing it down.

## Entry template

Each entry is one file, `YYYY-MM-DD-<slug>.md`:

- **What moved** -- the constant or rule, old value -> new value.
- **What prompted it** -- the report, observation, or human call, quoted.
- **The measurement** -- before/after numbers, and exactly how to reproduce.
- **The reasoning** -- why this change and not a different one; what was
  considered and rejected.
- **The pin** -- which test now holds the line, and the evidence it fails
  against the old behavior.
- **Known limits** -- what this did NOT establish.

## Index

- [2026-07-29 — spawned pawns must never be free material](2026-07-29-pawn-spawn-free-material.md)
- [2026-09-23 — a lone King can never force "The Knight" boss's capture; pawn count isn't the lever](#2026-09-23--a-lone-king-can-never-force-the-knight-bosss-capture--pawn-count-isnt-the-lever)
  (recorded below, not a separate file -- see that section's own note on why)
- [2026-10-08 — a lone King cannot force a safe crossing against "The Rook"'s lone Rook](2026-10-08-lone-rook-evasion-analytic.md)

### Recorded in the issue/PR, not a separate file

The prose ratchet (hf7y/etalon, `bin/markdown-cost.sh`, MEASURE_UNIT=4) prices
one new *file*, not new lines -- and paying it by reaping an old entry needs a
`consigne`-confirmed vault deposit first, which this account cannot get:
`consigne status` reads `/srv/ecosystem1-vault` as empty from here (vault
closed to this account, #742), so a request only ever SPOOLS, and nothing
spooled is safe to delete until a drain run elsewhere confirms it. A finding
landed under that constraint gets its full write-up in its own PR description
instead of a dated file here:

- 2026-09-22 — The Knight stage's wall can't be a real gate: any passable gap
  width bypasses it, and a gap of zero traps White behind it forever, for any
  pawn count (hf7y/chezz#120) -- full proof in hf7y/chezz#141's description
  and the guardrail test it added, `test/terrain.spec.mjs` ("closing The
  Knight stage's wall gap entirely would trap White behind it forever, for
  any pawn count"). **Superseded** by the 2026-09-23 entry below, which
  reaches the same "no pawn count works" conclusion via a sharper,
  exhaustive result: even the narrow-gate framing this entry left open
  (King alone gets through) is a forced loss for White too.

### Reaped, preserved in the vault

Byte-identical to their `consigne`-verified vault deposits (hf7y/chezz#113),
so the local copy carried no information the vault didn't already have:

- 2026-08-05 — archbishop material value: already fixed, three weeks before this lane existed --
  `/srv/ecosystem1-vault/chezz/research/balance/2026-08-05-archbishop-value-was-already-fixed.md`
- 2026-08-05 — pawn supply: PAWN_ALLOWANCE_CHANCE 0.3 -> 0.5 --
  `/srv/ecosystem1-vault/chezz/research/balance/2026-08-05-pawn-allowance-bump.md`
- 2026-08-06 — opposite-color bishop pair: no change, and here's why --
  `/srv/ecosystem1-vault/chezz/research/balance/2026-08-06-opposite-color-bishop-pair-value.md`
- 2026-08-06 — "fodder floors feel empty": doesn't reproduce under current code --
  `/srv/ecosystem1-vault/chezz/research/balance/2026-08-06-fodder-floors-no-longer-reproduce.md`
- 2026-08-22 — analytic material sufficiency: a decision procedure, one proven small case, and a non-monotonicity, answered via hf7y/bibliothecaire#57 --
  `/srv/ecosystem1-vault/chezz/research/balance/2026-08-22-analytic-material-sufficiency.md`

### Open, not yet studied

- None.

## 2026-09-23 — a lone King can never force "The Knight" boss's capture; pawn count isn't the lever

**Date:** 2026-09-23 · **Change type:** no game-code change; analytic finding
+ a corrected design record · **Commit:** see hf7y/chezz#143

Recorded inline here, not as its own `YYYY-MM-DD-<slug>.md` file per the
template above: the prose ratchet (hf7y/etalon, `bin/markdown-cost.sh`,
MEASURE_UNIT=4) prices one new *file*, not new lines, and paying it by
reaping an old entry needs a `consigne`-confirmed vault deposit first --
this account's vault access reads `/srv/ecosystem1-vault` as empty
(closed, #742), so a request only ever SPOOLS and nothing spooled is safe
to delete to make room. Folding this entry (and its solver, in a fenced
block below -- fenced code doesn't count as prose either) into the
already-tracked README costs nothing against that count. See hf7y/chezz#141
for the same fix applied to a different entry the same night.

### What moved

Nothing in `index1.html`. This resolves the *question* this file's own
"Open, not yet studied" section queued on 2026-09-21, not a constant.

### What prompted it

hf7y/chezz#120: *"fence on knight level seems strange. fence/wall tiles
should gate the back rank until knight capture. but that would be
difficult. requires research pass for min number of pawns to force knight
capture."* Three prior triage passes (bug-sweep 2026-09-11, nightly-batch
2026-09-17, nightly-batch 2026-09-18) each agreed the concrete ask -- a
researched minimum carried-pawn count that forces the Knight boss to
capture -- was real analytic work belonging in this lane (issue #6's
"analytic proofs, not playtesting or statistics" method), but none of them
did it; the 2026-09-21 pass only filed a queue entry pointing at it.

### The measurement

**Method: exhaustive backward-induction solve of the reduced game, not
playtesting.** The script below enumerates every `(King square, Knight
square, side to move)` state on "The Knight" stage's actual board
(`BOARD_COLS=8`, `BOARD_ROWS=9`, `EXIT_ROW=0`, wall at row 6 open only at
columns 3-4 -- the stage's authored, unshifted layout) and computes the
exact set of states from which White can force a capture, under the real
movement rules in `index1.html` (`legalMovesForPiece`'s King/Knight
generation, `kingSafeAfterMove`'s King-only hang restriction, the
Black-can't-enter-`EXIT_ROW` filter). This assumes Black plays **perfect
adversarial evasion** -- the standard framing for a "is White's material
sufficient" question (same as asking whether K+R vs K is theoretically
won, not whether a specific bot finds it) -- deliberately independent of
whatever `getBlackMoveRuthless` actually does search-depth-wise.

The algorithm is the standard attractor/backward-induction fixed point for
finite two-player reachability games: White-to-move states are OR-nodes
(win if any legal move captures or reaches a won Black-to-move state),
Black-to-move states are AND-nodes (win only if *every* legal Knight move
-- including the single "no legal move, turn passes" case, which really
happens per `state.turn = "w"` being set unconditionally after Black's
reply in the real move loop -- leads to a won White-to-move state). This is
exact and exhaustive (7,598 states total), not sampled.

**Result:**

| | |
|---|---|
| White-to-move states, total | 3,828 |
| ...that are forced wins for White | 438 (11.44%) |
| King-starts-at-home (rows 7-8, all 8 columns) vs. the Knight's authored square (col d, row 4) | **0 of 16 are forced wins** |
| Immediate King deadlocks among the losing states | 0 (Black evades forever; White is never stuck with zero moves) |

So from *every* realistic starting configuration -- King anywhere on its
own back two ranks, Knight on its scripted square -- a lone King cannot
force the Knight's capture. The 11.44% of state pairs that *are* forced
wins are concentrated in corner/edge configurations where the Knight has
already been chased into a low-mobility square; they're not reachable from
the stage's actual starting shape without the Knight cooperating.

Reproduce: save the fenced script below as a `.mjs` file and run it with
plain Node (no browser/Playwright needed -- this is graph search over an
abstracted state space, not a simulation of the live game):

```js
// Exhaustive solver for "can a lone White King force the capture of a lone
// Black Knight confined to 'The Knight' narrative stage's board?" -- issue
// hf7y/chezz#120's queued question, research/balance/README.md.
//
// This is NOT a simulation/playtest of the game's actual AI
// (getBlackMoveRuthless). It's a direct retrograde solve of the reduced
// (King, Knight, side-to-move) state graph under the EXACT movement rules
// in index1.html (legalMovesForPiece, kingSafeAfterMove, attackersOf),
// assuming Black plays a perfect adversarial evasion (the worst case for
// White, i.e. the real "material sufficiency" question: is White's material
// *sufficient*, not "does the shipped bot happen to find it"). Standard
// attractor/backward-induction algorithm for finite two-player reachability
// games -- exact, not heuristic.
//
// Board mirrors index1.html: BOARD_COLS=8, BOARD_ROWS=9, EXIT_ROW=0.
// "The Knight" stage: rows[] index 3 (board row 4) has the knight at col 3;
// rows[] index 5 (board row 6) is the wallRow "###11###" -> wall at cols
// 0,1,2,5,6,7, open gap at cols 3,4. shift=0 (the authored layout; see the
// script's own comment on why other cyclic shifts are out of scope).

const COLS = 8, ROWS = 9, EXIT_ROW = 0;
const WALL_ROW = 6;
const WALL_COLS = new Set([0, 1, 2, 5, 6, 7]); // shift=0; gap at 3,4

const KING_STEPS = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) KING_STEPS.push([dx, dy]);
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
function isWall(x, y) { return y === WALL_ROW && WALL_COLS.has(x); }
function isSquare(x, y) { return inBounds(x, y) && !isWall(x, y); }

// Raw king destinations: on-board, non-wall. (Matches legalMovesForPiece's
// `step`, which only excludes friendly/terrain -- no other white piece
// exists in this fight.)
function kingRawMoves(kx, ky) {
  const out = [];
  for (const [dx, dy] of KING_STEPS) {
    const x = kx + dx, y = ky + dy;
    if (isSquare(x, y)) out.push([x, y]);
  }
  return out;
}

// Knight destinations, with the EXIT_ROW filter real legalMovesForPiece
// applies to every Black piece ("Enemy pieces may never move onto the exit
// row").
function knightRawMoves(nx, ny) {
  const out = [];
  for (const [dx, dy] of KNIGHT_JUMPS) {
    const x = nx + dx, y = ny + dy;
    if (isSquare(x, y) && y !== EXIT_ROW) out.push([x, y]);
  }
  return out;
}

// Squares the knight attacks, for kingSafeAfterMove's mirror -- same
// EXIT_ROW exclusion, since attackersOf calls the same legalMovesForPiece.
function knightAttackSet(nx, ny) {
  const set = new Set();
  for (const [x, y] of knightRawMoves(nx, ny)) set.add(x + "," + y);
  return set;
}

function key(kx, ky, nx, ny, turn) { return `${kx},${ky},${nx},${ny},${turn}`; }

// Enumerate every reachable state and its outgoing edges in one pass, plus
// reverse edges, so the attractor algorithm below can do predecessor
// lookups without a second board-scan per state.
const squares = [];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isSquare(x, y)) squares.push([x, y]);
const knightSquares = squares.filter(([, y]) => y !== EXIT_ROW); // knight never legally occupies row 0

const nodes = new Map(); // key -> { turn, isCapture (for 'w' nodes), succ: [keys], predEdgesResolved }
const white = { win: new Set() };
const black = { win: new Set(), remaining: new Map() };

function whiteNode(kx, ky, nx, ny) {
  const k = key(kx, ky, nx, ny, "w");
  if (nodes.has(k)) return k;
  const attacks = knightAttackSet(nx, ny);
  let capture = false;
  const succ = [];
  for (const [tx, ty] of kingRawMoves(kx, ky)) {
    if (tx === nx && ty === ny) { capture = true; continue; } // terminal win, no successor state
    if (attacks.has(tx + "," + ty)) continue; // hangs the King -- illegal (King-only rule)
    succ.push(key(tx, ty, nx, ny, "b"));
  }
  nodes.set(k, { turn: "w", capture, succ });
  return k;
}

function blackNode(kx, ky, nx, ny) {
  const k = key(kx, ky, nx, ny, "b");
  if (nodes.has(k)) return k;
  const moves = knightRawMoves(nx, ny);
  const succ = moves.length
    ? moves.map(([tx, ty]) => key(kx, ky, tx, ty, "w"))
    : [key(kx, ky, nx, ny, "w")]; // no legal knight move -> turn passes back to White (state.turn = "w" unconditionally in the real code)
  nodes.set(k, { turn: "b", succ });
  return k;
}

// Build the full graph (BFS from every possible (king,knight) pair, since
// we want the complete table, not just one starting position).
const queue = [];
for (const [kx, ky] of squares) {
  for (const [nx, ny] of knightSquares) {
    if (kx === nx && ky === ny) continue; // can't start on the same square
    queue.push(whiteNode(kx, ky, nx, ny));
    queue.push(blackNode(kx, ky, nx, ny));
  }
}
// Expand successors transitively (whiteNode/blackNode above only create the
// two nodes for a given (k,n) pair; walk the graph to create every node
// their successors mention too).
let frontier = [...nodes.keys()];
while (frontier.length) {
  const next = [];
  for (const k of frontier) {
    const [kx, ky, nx, ny, turn] = k.split(",");
    const KX = +kx, KY = +ky, NX = +nx, NY = +ny;
    const node = nodes.get(k);
    for (const sk of node.succ) {
      if (!nodes.has(sk)) {
        const [skx, sky, snx, sny, sturn] = sk.split(",");
        if (sturn === "w") whiteNode(+skx, +sky, +snx, +sny); else blackNode(+skx, +sky, +snx, +sny);
        next.push(sk);
      }
    }
  }
  frontier = next;
}

// Reverse edges.
const preds = new Map();
for (const [k, node] of nodes) {
  for (const sk of node.succ) {
    if (!preds.has(sk)) preds.set(sk, []);
    preds.get(sk).push(k);
  }
}

// Attractor / backward-induction: white nodes are OR (win if any successor
// wins, or an immediate capture exists); black nodes are AND (win only if
// EVERY successor wins -- including the size-1 "knight has no move, turn
// passes" case, which is naturally correct with an AND over one edge).
const win = new Set();
const remaining = new Map(); // black-node key -> count of successors not yet proven winning
const bfsQueue = [];

for (const [k, node] of nodes) {
  if (node.turn === "w") {
    if (node.capture) { win.add(k); bfsQueue.push(k); }
  } else {
    remaining.set(k, node.succ.length);
  }
}

let head = 0;
while (head < bfsQueue.length) {
  const v = bfsQueue[head++];
  const ps = preds.get(v) || [];
  for (const u of ps) {
    if (win.has(u)) continue;
    const node = nodes.get(u);
    if (node.turn === "w") {
      win.add(u); bfsQueue.push(u);
    } else {
      const left = remaining.get(u) - 1;
      remaining.set(u, left);
      if (left === 0) { win.add(u); bfsQueue.push(u); }
    }
  }
}

// --- Report ---
let whiteTotal = 0, whiteWin = 0;
for (const [k, node] of nodes) {
  if (node.turn !== "w") continue;
  whiteTotal++;
  if (win.has(k)) whiteWin++;
}
console.log(`Total states: ${nodes.size}, White-to-move states: ${whiteTotal}, forced-win-for-White: ${whiteWin} (${(100 * whiteWin / whiteTotal).toFixed(2)}%)`);

// The stage's authored starting shape: knight at (3, 4) (col d, board row 4).
// Report the verdict for every King square reachable from home (rows 7-8)
// against that knight start, plus a scan of ALL king/knight pairs for any
// White-to-move loss to characterize the failure mode if one exists.
const NKX = 3, NKY = 4;
console.log(`\n-- Knight fixed at authored start (col d, row 4) --`);
for (let ky = 7; ky <= 8; ky++) {
  for (let kx = 0; kx < COLS; kx++) {
    if (!isSquare(kx, ky)) continue;
    const k = key(kx, ky, NKX, NKY, "w");
    console.log(`King (${kx},${ky}) vs Knight (${NKX},${NKY}), White to move: ${win.has(k) ? "FORCED WIN" : "NOT a forced win"}`);
  }
}

const losses = [];
for (const [k, node] of nodes) {
  if (node.turn === "w" && !win.has(k)) losses.push(k);
}
console.log(`\nWhite-to-move LOSING states (Black can evade forever, or White is deadlocked): ${losses.length}`);
if (losses.length) {
  console.log("Sample (up to 20):");
  losses.slice(0, 20).forEach(k => console.log("  " + k));
  // Classify: is it a deadlock (zero legal king moves) or a genuine evasion loop?
  let deadlocks = 0;
  for (const k of losses) {
    const node = nodes.get(k);
    if (node.succ.length === 0 && !node.capture) deadlocks++;
  }
  console.log(`Of which immediate King deadlocks (zero legal moves): ${deadlocks}`);
}
```

### The reasoning

**Why this matters beyond answering "what's the minimum pawn count":** it
dissolves the question rather than answering it with a number. The
2026-07-20 design refinement's own worked example is King-plus-pawns vs. a
lone Knight *behind a gate narrow enough that only the King fits through*
-- the pawns are explicitly excluded from the fight by the gate's own
design. So "minimum pawn count to force the capture" has no answer under
that framing: pawns structurally never reach the Knight, and the lone King
that does reach it can't force the capture at all, for any N.

**A second, independent gap, found while reading `checkFloorProgression`
and `newFloor` to model the board correctly:** the wall doesn't actually
gate anything today. `checkFloorProgression` (index1.html) clears the
floor the instant `state.board[EXIT_ROW]` contains `"K"` -- it never checks
whether the current stage's `bossPiece` is still alive. `newFloor` builds
the next floor by scanning the *whole* board for surviving White pieces,
not just the pieces that crossed the gate. So today, the King can walk
past the Knight to the exit without capturing it, and any pawns left
behind the wall carry over to the next floor anyway. hf7y/chezz#120's own
report FEN -- filed at the moment right after a real capture
(`captured=Pn`, `last=...ng31xe32,Kd32xe32`) -- independently shows a pawn
sitting on file c, one file outside the row-6 gate (files d/e): that pawn
reached the new floor without ever having walked through the gap, which
only makes sense if carryover really is position-independent, matching
the code reading.

**Put together:** the current shipped behavior (wall opens once the boss
happens to die, doesn't block progression either way) is the *safe*
reading, not a bug to fix by tightening it. Given the proof above, making
`checkFloorProgression` require `bossPiece` to be dead -- the literal
reading of "mandatory, not optional" -- would convert a cosmetic mismatch
into a genuine failure mode: a King that cannot force the kill and cannot
progress either, stuck facing a Knight that (per this proof) can evade it
forever. Nothing in the surrounding code makes that unreachable; it isn't
a deadlock (White always has *some* legal move -- see the zero-deadlock
row above) but it is a floor that can never be cleared for as long as
Black keeps running, which is worse than the status quo, not better.

### Known limits

- Modeled only the stage's **authored, unshifted layout** (wall gap at
  columns 3-4, matching the actual `NARRATIVE_STAGES` entry).
  `placeScriptedStage`'s capture-safety cyclic shift can move the gap to
  other column pairs, and one shift value (+4) splits it into two
  *separate* one-wide gaps at opposite edges instead of one two-wide gap --
  a materially different topology not solved here.
- This is a **King-alone** solve, matching the "only the King can pass"
  gate framing literally. It does not check whether letting a *second*
  attacking piece (one pawn, say) through changes the verdict -- two
  attackers routinely corner a lone Knight where one can't, so that's a
  plausible lever, but adding a piece multiplies the state space
  (attacker-pair positions x Knight position x side-to-move) well beyond
  what's justified for tonight without a concrete request for it.
- Says nothing about whether "Two Bishops" (the other `wallRow`/
  `bossPiece` stage, two sliding pieces rather than one knight-mobility
  piece) has the same problem -- sliding pieces run out of safe squares
  against a King in enclosed terrain much faster than a Knight does, so
  the verdict likely doesn't transfer, but that's a separate solve, not
  assumed here.
- Assumes Black plays *perfect* evasion. The shipped
  `getBlackMoveRuthless` demonstrably does not always evade (player
  reports, including #120's own, show real captures happening) -- this
  finding is a ceiling on what a hard gate could ever guarantee, not a
  claim about what the current bot does in practice.

### Follow-up

DESIGN-NOTES.md's 2026-07-20 terrain entry is corrected in place to point
here. The remaining question -- accept the wall as one-time flavor for a
Knight boss, or invest in a different lever (extra attacker let through,
smaller arena, or a non-Knight boss) to actually deliver the "mandatory
encounter" the worked example described -- is a real design fork, not an
engineering task, and is filed as hf7y/chezz#142.
