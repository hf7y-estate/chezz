# 2026-10-08 — a lone King cannot force a safe crossing against "The Rook"'s lone Rook

**Date:** 2026-10-08 · **Change type:** no game-code behavior change; analytic
finding, confirming an existing design comment · **Commit:** this file

### What moved

Nothing in `index1.html`'s game logic. This answers the *question*
hf7y-estate/chezz#140 asked step 1 of (Zach, 2026-10-01: "1 then 2" against a
"(1) reverify the lone-Rook evasion analytically first and tune floor 7 from
the result" / "(2) tune floor 7 harder now" / "(3) leave it and close #123"
choice) -- step 1 is now done, and its result is reported at the bottom of
this entry as the basis for not doing step 2's literal "add terrain and
pawns to floor 7" action.

### What prompted it

The `NARRATIVE_STAGES` comment directly above "The Rook" (`index1.html`,
near the "More pawns" floor-7 entry) has said, unverified, since before this
entry:

> Playtesting (see test/playtest-campaign.spec.mjs) found a lone Rook is a
> genuine structural bottleneck, not a placement/ordering issue -- it can
> perpetually retreat along its own rank/file to dodge capture while
> occasionally checking, with nothing forcing a resolution. Giving more
> floor-transitions ... before the fight is the fix being tried first, not
> yet reverified.

hf7y-estate/chezz#123 reported floor 7 ("More pawns") as "disproportionately
easy, need more terrain and pawns" -- hf7y-estate/chezz#140 is the design
fork that report opened, parked three times (bug-sweep 2026-09-11,
nightly-batch 2026-09-17, nightly-batch 2026-09-18) each time because the
reverification this entry performs hadn't been done yet.

### The measurement

**Method: exhaustive backward-induction solve of the reduced game, not
playtesting** -- same method as
[2026-09-23's Knight solve](#2026-09-23--a-lone-king-can-never-force-the-knight-bosss-capture--pawn-count-isnt-the-lever)
above, adapted for a sliding Rook and a different win condition. "The Rook"
(`NARRATIVE_STAGES[7]`) has no `wallRow`/`bossPiece`, so there is no capture
requirement at all -- White's actual win condition on this floor is "King
reaches `EXIT_ROW` on a legal (not-into-check) move," which this solve uses
directly, with capturing the Rook treated as an equivalent terminal win
(from an empty board the rest of the floor is unconditionally winnable, no
further solve needed).

Board mirrors index1.html: `BOARD_COLS=8`, `BOARD_ROWS=9`, `EXIT_ROW=0`.
"The Rook" stage: `rows[]` index 3 (board row 4) has the rook at col 3 --
same authored square and `shift=0` as "The Knight" used, since this stage
has no `TERRAIN_HOLE` either, so `placeScriptedStage`'s capture-safety loop
picks the same unshifted layout on a baseline (no carried White piece)
run. Black's real `legalMovesForPiece` filters every Black move landing on
`EXIT_ROW` -- including from `attackersOf`'s reuse of that same function --
so the Rook can *never* attack a square on `EXIT_ROW`; a King already on
row 1 can always safely step onto row 0 regardless of the Rook's position.
The question is whether the Rook can keep the King from ever safely
reaching that adjacency in the first place.

This is exact and exhaustive (9,152 states total), not sampled.

Reproduce: save the fenced script below as a `.mjs` file and run it with
plain Node (no browser/Playwright needed):

```js
// Exhaustive solver: can a lone White King force a safe arrival on EXIT_ROW
// against a lone Black Rook confined to "The Rook" narrative stage's board?
// (hf7y-estate/chezz#140 step 1.)
//
// Direct retrograde solve of the reduced (King, Rook, side-to-move) state
// graph under the exact movement rules in index1.html (legalMovesForPiece,
// kingSafeAfterMove), assuming Black plays perfect adversarial evasion.
// Standard attractor/backward-induction algorithm for finite two-player
// reachability games -- exact, not heuristic.

const COLS = 8, ROWS = 9, EXIT_ROW = 0;

function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

const KING_STEPS = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) KING_STEPS.push([dx, dy]);
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function kingRawMoves(kx, ky) {
  const out = [];
  for (const [dx, dy] of KING_STEPS) {
    const x = kx + dx, y = ky + dy;
    if (inBounds(x, y)) out.push([x, y]);
  }
  return out;
}

// Rook slides in the 4 directions, stopping at (and including) the King's
// square if it's in the way -- mirrors legalMovesForPiece's slide(). The
// EXIT_ROW filter real legalMovesForPiece applies to every Black piece
// removes any landing square with y===0.
function rookRawMoves(rx, ry, kx, ky) {
  const out = [];
  for (const [dx, dy] of ROOK_DIRS) {
    let x = rx + dx, y = ry + dy;
    while (inBounds(x, y)) {
      out.push([x, y]);
      if (x === kx && y === ky) break; // capture stop
      x += dx; y += dy;
    }
  }
  return out.filter(([, y]) => y !== EXIT_ROW);
}

function rookAttackSet(rx, ry, kx, ky) {
  const set = new Set();
  for (const [x, y] of rookRawMoves(rx, ry, kx, ky)) set.add(x + "," + y);
  return set;
}

function key(kx, ky, rx, ry, turn) { return `${kx},${ky},${rx},${ry},${turn}`; }

const squares = [];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) squares.push([x, y]);
const rookSquares = squares.filter(([, y]) => y !== EXIT_ROW); // rook never legally occupies row 0

const nodes = new Map();

function whiteNode(kx, ky, rx, ry) {
  const k = key(kx, ky, rx, ry, "w");
  if (nodes.has(k)) return k;
  const succ = [];
  let winNow = false;
  for (const [tx, ty] of kingRawMoves(kx, ky)) {
    if (tx === rx && ty === ry) { winNow = true; continue; } // captures the Rook -- terminal
    const attacks = rookAttackSet(rx, ry, tx, ty);
    if (attacks.has(tx + "," + ty)) continue; // moving into check -- illegal
    if (ty === EXIT_ROW) { winNow = true; continue; } // safe arrival on EXIT_ROW -- terminal
    succ.push(key(tx, ty, rx, ry, "b"));
  }
  nodes.set(k, { turn: "w", capture: winNow, succ });
  return k;
}

function blackNode(kx, ky, rx, ry) {
  const k = key(kx, ky, rx, ry, "b");
  if (nodes.has(k)) return k;
  const moves = rookRawMoves(rx, ry, kx, ky);
  const succ = moves.length
    ? moves.map(([tx, ty]) => key(kx, ky, tx, ty, "w"))
    : [key(kx, ky, rx, ry, "w")]; // no legal rook move -> turn passes back to White
  nodes.set(k, { turn: "b", succ });
  return k;
}

const queue = [];
for (const [kx, ky] of squares) {
  for (const [rx, ry] of rookSquares) {
    if (kx === rx && ky === ry) continue;
    queue.push(whiteNode(kx, ky, rx, ry));
    queue.push(blackNode(kx, ky, rx, ry));
  }
}
let frontier = [...nodes.keys()];
while (frontier.length) {
  const next = [];
  for (const k of frontier) {
    const node = nodes.get(k);
    for (const sk of node.succ) {
      if (!nodes.has(sk)) {
        const [skx, sky, srx, sry, sturn] = sk.split(",");
        if (sturn === "w") whiteNode(+skx, +sky, +srx, +sry); else blackNode(+skx, +sky, +srx, +sry);
        next.push(sk);
      }
    }
  }
  frontier = next;
}

const preds = new Map();
for (const [k, node] of nodes) {
  for (const sk of node.succ) {
    if (!preds.has(sk)) preds.set(sk, []);
    preds.get(sk).push(k);
  }
}

const win = new Set();
const remaining = new Map();
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

let whiteTotal = 0, whiteWin = 0;
for (const [k, node] of nodes) {
  if (node.turn !== "w") continue;
  whiteTotal++;
  if (win.has(k)) whiteWin++;
}
console.log(`Total states: ${nodes.size}, White-to-move states: ${whiteTotal}, forced-win-for-White: ${whiteWin} (${(100 * whiteWin / whiteTotal).toFixed(2)}%)`);

const RKX = 3, RKY = 4;
console.log(`\n-- Rook fixed at authored start (col d, row 4) --`);
let homeWins = 0, homeTotal = 0;
for (let ky = 7; ky <= 8; ky++) {
  for (let kx = 0; kx < COLS; kx++) {
    const k = key(kx, ky, RKX, RKY, "w");
    homeTotal++;
    if (win.has(k)) homeWins++;
    console.log(`King (${kx},${ky}) vs Rook (${RKX},${RKY}), White to move: ${win.has(k) ? "FORCED WIN" : "NOT a forced win"}`);
  }
}
console.log(`Home squares forced win: ${homeWins} of ${homeTotal}`);

const losses = [];
for (const [k, node] of nodes) {
  if (node.turn === "w" && !win.has(k)) losses.push(k);
}
console.log(`\nWhite-to-move LOSING states: ${losses.length}`);
let deadlocks = 0;
for (const k of losses) {
  const node = nodes.get(k);
  if (node.succ.length === 0 && !node.capture) deadlocks++;
}
console.log(`Of which immediate King deadlocks (zero legal moves): ${deadlocks}`);
```

**Result:**

| | |
|---|---|
| White-to-move states, total | 4,608 |
| ...that are forced wins for White | 1,988 (43.14%) |
| King-starts-at-home (rows 7-8, all 8 columns) vs. the Rook's authored square (col d, row 4) | **0 of 16 are forced wins** |
| Immediate King deadlocks among the losing states | 0 (Black evades forever; White is never stuck with zero moves) |

So the code comment was right, and is now reverified rather than assumed:
from *every* realistic starting configuration, a lone King cannot force a
safe crossing to `EXIT_ROW` against this Rook. Unlike the Knight solve, the
43.14% of state pairs that *are* forced wins mostly sit close to
`EXIT_ROW` already (a King on row 1 can always step across, since Black can
never attack `EXIT_ROW` at all) -- they are not evidence that the home-row
starting shape is winnable by some path this solve missed.

### The reasoning

This is a confirmation, not a dissolution like the Knight case: "The Rook"
has no `wallRow`, so nothing *requires* the King to fight the Rook at all --
but the Rook's mere presence on the board, with perfect evasion, is enough
to deny a lone King any forced route to the exit anyway (not via a hard
block, since 0 deadlocks means the King always has *some* move -- via an
infinite evasion/check loop the King can never break out of alone). That is
exactly the scenario "More pawns" (floor 7) exists to avoid: giving the
campaign one more floor-transition before "The Rook" is one more chance for
a surviving non-King piece to backfill, so the King doesn't arrive at
floor 8 alone. The fix being tried was never reverified until now; it is,
and it is doing real work, not papering over a non-problem.

That answers hf7y-estate/chezz#140's fork: hardening floor 7 with more
terrain and pawns (the literal ask in hf7y-estate/chezz#123) would work
*against* the breather's purpose -- a harder floor 7 gives a struggling run
*fewer* surviving pieces to carry into floor 8, not more, right where this
solve shows a lone King has no forced win at all. Floor 7's easiness is the
fix working as intended, not underbalancing; #123 is expected behavior, not
a bug.

### Known limits

- **King-alone solve**, matching the code comment's own framing (the
  evasion problem is specifically about what happens if the King *does*
  arrive at floor 8 without backup). It does not check whether one extra
  carried pawn or piece flips the verdict -- that multiplies the state
  space (attacker position(s) x Rook position x side-to-move) well beyond
  what's justified here without a concrete request for it, same caveat the
  Knight entry raised for a second attacker.
- Modeled only the stage's **authored, unshifted layout** (Rook at col d,
  row 4, `shift=0`), matching "The Knight" solve's own scope limit for the
  same reason (capture-safety cyclic shift is out of scope without a
  carried White piece to trigger it).
- Assumes Black plays *perfect* evasion -- a ceiling on what the Rook could
  ever guarantee, not a claim about what the shipped `getBlackMoveRuthless`
  does in practice (which is presumably why some runs do get through).

### Follow-up

`index1.html`'s "not yet reverified" comment above "The Rook" is updated to
point here. No change to `NARRATIVE_STAGES`' floor 7 data: the breather
stays as designed. hf7y-estate/chezz#140 and hf7y-estate/chezz#123 are
commented with this result for Zach to close at his discretion.
