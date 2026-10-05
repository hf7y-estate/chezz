// Terrain (priority queue item 4, DESIGN-NOTES.md "Terrain: walls +
// holes"): impassable squares. A hole (TERRAIN_HOLE) is permanent; a wall
// (TERRAIN_WALL) is boss-gated: it seals the exit row and drops once its
// scripted stage's boss piece is captured (see dropWallIfBossDefeated,
// wired into makeMove).
// Both are authored directly into NARRATIVE_STAGES row FEN strings.
import { test, expect } from "@playwright/test";
import { GAME_URL, fenRowsToBoard } from "./helpers.mjs";

function emptyBoard() {
  return Array.from({ length: 9 }, () => Array(8).fill(""));
}

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("a slide stops before a terrain square and never lands on or captures it", async ({ page }) => {
  const board = emptyBoard();
  board[4][4] = "R"; // White rook
  board[4][6] = "X"; // hole two squares to the right, same rank

  const moves = await page.evaluate(b => legalMovesForPiece(b, "R", 4, 4), board);
  const targets = moves.map(m => `${m.x},${m.y}`);

  expect(targets).toContain("5,4"); // can slide up to just before the hole
  expect(targets).not.toContain("6,4"); // can't land on the hole
  expect(targets).not.toContain("7,4"); // can't slide through it either
});

test("a King can't step onto a wall or hole square", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[7][4] = "#";
  board[7][3] = "X";

  const moves = await page.evaluate(b => legalMovesForPiece(b, "K", 4, 8), board);
  const targets = moves.map(m => `${m.x},${m.y}`);

  expect(targets).not.toContain("4,7");
  expect(targets).not.toContain("3,7");
  expect(targets).toContain("5,7"); // an ordinary empty neighbor stays legal
});

test("terrain is never treated as a Black attacker or a capturable enemy", async ({ page }) => {
  const board = emptyBoard();
  board[8][4] = "K";
  board[4][4] = "#"; // sits on the King's own file, well out of step range

  const attackers = await page.evaluate(b => attackersOf(b, 4, 8, false), board);
  expect(attackers).toEqual([]);
});

test("a board round-trips through FEN with terrain squares intact", async ({ page }) => {
  const board = emptyBoard();
  board[6][2] = "X";
  board[6][5] = "#";
  board[8][4] = "K";

  const roundTripped = await page.evaluate(b => {
    state.board = b;
    const fen = boardToFen();
    loadFen(fen + "_w");
    return state.board;
  }, board);

  expect(roundTripped[6][2]).toBe("X");
  expect(roundTripped[6][5]).toBe("#");
  expect(roundTripped[8][4]).toBe("K");
});

// The boss gate sits on the exit row with no gap (hf7y-estate/chezz#142,
// Zach 2026-10-01: "the gate is on the wrong rank. It should block the move
// from rank 8 to 9"). It replaces the old row-6 wall with a 2-square gap,
// which only separated White's army from the arena and never touched the
// exit -- and with it the old guardrail test that a gap-free row-6 wall
// would trap White on rows 7-8, which no longer describes any wall here.
function spawnBossStage(label) {
  state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
  state.board[8][4] = "K";
  for (let x = 0; x < BOARD_COLS; x++) { if (x !== 4) state.board[7][x] = "P"; }
  state.floor = NARRATIVE_STAGES.findIndex(s => s.label === label) + 1;
  state.diedOnce = false;
  state.lastSpawnBudget = 0;
  spawnBlackArmy();
}
// White moves that land on the exit row, from a White piece of every kind
// parked on row 1, right under the gate.
function exitMoves() {
  const board = state.board.map(row => [...row]);
  board[8][4] = "";
  ["K", "Q", "R", "B", "N", "P"].forEach((piece, x) => { board[1][x] = piece; });
  return board[1].flatMap((piece, x) => piece ? legalMovesForPiece(board, piece, x, 1).filter(m => m.y === EXIT_ROW) : []).length;
}

for (const [label, boss] of [["The Knight", "n"], ["Two Bishops", "b"]]) {
  test(`${label}: the gate seals the whole exit row, leaves White's own start open, and drops once the boss is captured`, async ({ page }) => {
    const result = await page.evaluate(([spawnSrc, exitSrc, label, boss]) => {
      const spawnBossStage = eval("(" + spawnSrc + ")"), exitMoves = eval("(" + exitSrc + ")");
      spawnBossStage(label);
      const stage = NARRATIVE_STAGES[state.floor - 1];
      const before = {
        wallRow: stage.wallRow,
        bossPiece: stage.bossPiece,
        exitAllWall: state.board[EXIT_ROW].every(c => c === "#"),
        wallsElsewhere: state.board.slice(1).flat().filter(c => c === "#").length,
        exitMoves: exitMoves(),
        // The whole carried army can walk into the arena: every pawn on row 7 has a move.
        pawnsFree: state.board[7].every((c, x) => c !== "P" || legalMovesForPiece(state.board, "P", x, 7).length > 0),
      };

      // Simulate the captures directly (bypassing move legality/AI reply,
      // which aren't this test's concern) to isolate the wall-drop rule.
      const stillWallAfterEach = [];
      while (state.board.some(row => row.includes(boss))) {
        const y = state.board.findIndex(row => row.includes(boss));
        state.board[y][state.board[y].indexOf(boss)] = "";
        dropWallIfBossDefeated();
        stillWallAfterEach.push(state.board[EXIT_ROW].includes("#"));
      }
      return { before, stillWallAfterEach, afterAllOpen: state.board[EXIT_ROW].every(c => c === ""), afterExitMoves: exitMoves() };
    }, [spawnBossStage.toString(), exitMoves.toString(), label, boss]);

    expect(result.before.wallRow).toBe(0);
    expect(result.before.bossPiece).toBe(boss);
    expect(result.before.exitAllWall).toBe(true);   // no gap
    expect(result.before.wallsElsewhere).toBe(0);   // nothing left at row 6
    expect(result.before.exitMoves).toBe(0);        // no White piece can step onto the exit
    expect(result.before.pawnsFree).toBe(true);
    // Stays up until the LAST boss piece goes (both Bishops, not just one).
    expect(result.stillWallAfterEach).toEqual(boss === "b" ? [true, false] : [false]);
    expect(result.afterAllOpen).toBe(true);
    expect(result.afterExitMoves).toBeGreaterThan(0);
  });
}

test("the gate really gates: a King under it can't clear the floor until a real capture of the Knight opens it", async ({ page }) => {
  const result = await page.evaluate(async () => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[0].fill("#");
    state.board[1][0] = "K";
    state.board[5][7] = "R";
    state.board[5][3] = "n"; // on the Rook's rank
    state.floor = NARRATIVE_STAGES.findIndex(s => s.label === "The Knight") + 1;
    state.spawned = true;
    state.turn = "w";
    const kingExitsBefore = legalMovesFrom(state.board, 0, 1).filter(m => m.y === EXIT_ROW).length;
    checkFloorProgression();
    const floorBefore = state.floor;
    await makeMove(7, 5, 3, 5); // Rook takes the Knight
    const openAfter = state.board[EXIT_ROW].every(c => c === "");
    await makeMove(0, 1, 0, 0); // King steps through
    return { kingExitsBefore, floorBefore, openAfter, floorAfter: state.floor };
  });

  expect(result.kingExitsBefore).toBe(0);
  expect(result.floorBefore).toBe(4);
  expect(result.openAfter).toBe(true);
  expect(result.floorAfter).toBe(5);
});

test("terrain actually PAINTS differently from an empty square, on both checkerboard colors", async ({ page }) => {
  // Tracker 2026-07-28T14:47:56: "white pawns on f and g are blocked. is this
  // a failed rendering of the wall tile or genuine unable to move?" -- it was
  // both. The rules above all passed while every wall and hole rendered as an
  // ordinary empty square, because the checkerboard selector
  // (`tr:nth-child(...) td:nth-child(...)`, specificity 0,2,2) outranked a
  // bare `td[data-terrain=...]` (0,1,1). Every existing terrain test asserts
  // MOVEMENT or the data attribute, so none of them could see it.
  //
  // This probe FAILS against the pre-fix build: backgroundImage reads "none".
  // Both parities are checked because the bug was a specificity tie -- a fix
  // that only won on one square color would still be half broken.
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-%23%23%232%23%23%23-4PPP1-6K1_w&floor=4&spawned=1&budget=3&maxRank=24");

  const paint = await page.evaluate(() => {
    const walls = [...document.querySelectorAll('td[data-terrain="wall"]')];
    const plain = [...document.querySelectorAll("td:not([data-terrain])")];
    const img = el => getComputedStyle(el).backgroundImage;
    // nth-child parity within the row decides the checkerboard color; the
    // rank <th> makes the first <td> nth-child(2), hence the +1 offset.
    const parity = el => ([...el.parentElement.children].indexOf(el)) % 2;
    return {
      wallCount: walls.length,
      wallsPainted: walls.map(img).filter(v => v !== "none").length,
      paritiesCovered: new Set(walls.map(parity)).size,
      plainPainted: plain.map(img).filter(v => v !== "none").length,
    };
  });

  expect(paint.wallCount).toBe(6);
  expect(paint.wallsPainted).toBe(6);          // every wall, not just the lucky parity
  expect(paint.paritiesCovered).toBe(2);       // the probe really did span both colors
  expect(paint.plainPainted).toBe(0);          // and an empty square stays flat
});

test("wall and hole render as visually distinct terrain -- brick barrier vs. circular pit", async ({ page }) => {
  // Tracker 2026-07-29T04:39:12: "holes design should look different than
  // walls. holes are pixel circles. walls are brick barrier on tile edge."
  // A wall paints its own backgroundImage (the brick course, asserted
  // generically above); a hole instead paints an inset ::before circle and
  // leaves the <td>'s own background alone so the checkerboard square still
  // shows around the pit. This probe pins that split rather than just
  // "terrain paints something".
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-%23X6-4PPP1-6K1_w&floor=4&spawned=1&budget=3&maxRank=24");

  const shapes = await page.evaluate(() => {
    const wall = document.querySelector('td[data-terrain="wall"]');
    const hole = document.querySelector('td[data-terrain="hole"]');
    const before = el => getComputedStyle(el, "::before");
    return {
      wallOwnBg: getComputedStyle(wall).backgroundImage,
      holeOwnBg: getComputedStyle(hole).backgroundImage,
      holeBeforeContent: before(hole).content,
      holeBeforeRadius: before(hole).borderRadius,
      wallBeforeContent: before(wall).content,
    };
  });

  expect(shapes.wallOwnBg).not.toBe("none");     // the brick course is the wall's own background
  expect(shapes.holeOwnBg).toBe("none");         // a hole leaves its own square unpainted...
  expect(shapes.holeBeforeContent).not.toBe("none"); // ...and instead draws an inset circle via ::before
  expect(shapes.holeBeforeRadius).toBe("50%");
  expect(shapes.wallBeforeContent).toBe("none"); // a wall has no ::before circle of its own
});

test("terrain on the board doesn't blind the AI's search (tracker 2026-07-30T06:18:44, 'black bishop hung')", async ({ page }) => {
  // pieceValues has no entry for '#'/'X', so evaluateBoard's material sum
  // went to NaN on ANY board with terrain -- not just this one position.
  // NaN's always-false comparisons collapsed every root candidate to the
  // same -Infinity sentinel, so the search picked among Black's legal moves
  // with zero regard for material safety on every terrain floor, not just
  // misjudging one tactic. Reconstructed directly from the report's own
  // FEN (undoing the one reported move, bh48-g47): a Black bishop sits at
  // c42, adjacent to and undefended against the White King at d42 -- the
  // other Black bishop, at h48, has a fully safe retreat available.
  const fen = "8-7b-8-8-8-4P3-###P1###-2bK4-8";
  const board = fenRowsToBoard(fen);

  const mv = await page.evaluate(([board, captured, floor]) => {
    const chosen = getBlackMoveRuthless(board, captured, floor);
    const next = board.map(r => r.slice());
    next[chosen.toY][chosen.toX] = chosen.piece;
    next[chosen.fromY][chosen.fromX] = "";
    const hangsUndefended = (x, y) =>
      attackersOf(next, x, y, true).length > 0 && attackersOf(next, x, y, false).length === 0;
    return { chosen, cBishopHangs: hangsUndefended(2, 7) };
  }, [board, "p", 6]);

  expect(Number.isFinite(mv.chosen.score)).toBe(true); // not the NaN-collapsed -Infinity sentinel
  expect(mv.cBishopHangs).toBe(false); // must not leave the OTHER bishop (c42) hanging either
});

// hf7y-estate/chezz#139 (Zach 2026-10-01): every carried pawn needs a route
// to the far rank under correct play; a route may need a capture, but a
// pawn with no route at all under any play is the defect. "Two to take" is
// the only stage that ever authors a TERRAIN_HOLE, and its two holes sit at
// the board edges with no diagonal capture on offer there (that's the whole
// point -- they're off the scripted pawns' own files) -- so a carried pawn
// landing in a hole's file on arrival would be a dead end, not friction.
// placeScriptedStage's existing cyclic-shift search now also requires a
// shift that keeps every carried pawn's file hole-free. "Two to take" is a
// fixed floor 2, and a never-died run reaches it with at most one carried
// pawn (floor 1, "First blood", has exactly one capturable Black piece) --
// swept over every file that one pawn could be on.
test("a carried pawn is never left facing a hole with no way around it", async ({ page }) => {
  const stranded = await page.evaluate(() => {
    const bad = [];
    const stageIdx = NARRATIVE_STAGES.findIndex(s => s.label === "Two to take");
    for (let col = 0; col < BOARD_COLS; col++) {
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.board[7][col] = "P"; // the one pawn a fresh run could carry this far
      state.floor = stageIdx + 1;
      state.spawned = false;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();
      for (let y = 1; y <= 6; y++) {
        if (state.board[y][col] === "X") bad.push({ col, y });
      }
    }
    return bad;
  });

  expect(stranded).toEqual([]);
});
