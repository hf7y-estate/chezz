// Boss stand-off (hf7y-estate/chezz#142). The boss gate never opens for a
// lone King, and a lone King can't force the boss's capture
// (research/balance/2026-09-23-knight-forced-capture-analytic.md), so the
// floor needs an ending the player doesn't have to resign into. Zach,
// 2026-10-01: "How about building me all the options so I can choose?" --
// ?loneking=draw (the default), ?loneking=reinforce, ?loneking=fifty. See
// resolveBossStandoff.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

// "The Knight" as the campaign really spawns it, White's King at (4,8) plus
// whatever `extra` pieces the test carries in.
async function knightFloor(page, query, extra = {}) {
  await page.goto(GAME_URL + query);
  await page.evaluate(extra => {
    state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
    state.board[8][4] = "K";
    for (const [sq, piece] of Object.entries(extra)) state.board[sq[1]][sq[0]] = piece;
    state.floor = NARRATIVE_STAGES.findIndex(s => s.label === "The Knight") + 1;
    state.diedOnce = false;
    state.spawned = false;
    state.captured = "";
    state.lastSpawnBudget = 0;
    state.turn = "w";
    spawnBlackArmy();
  }, extra);
}

const snapshot = () => ({
  floor: state.floor,
  diedOnce: state.diedOnce,
  gateClosed: state.board[EXIT_ROW].every(c => c === "#"),
  queens: state.board.flat().filter(c => c === "q").length,
  quietMoves: state.quietMoves,
  message: document.getElementById("floorMessage").textContent,
  search: location.search,
});

test("default (no parameter): a lone King under a closed gate is a draw by insufficient material, at once, and respawns from floor 1", async ({ page }) => {
  await knightFloor(page, "");
  const result = await page.evaluate(async snapshotSrc => {
    const gateClosedBefore = state.board[EXIT_ROW].every(c => c === "#");
    await makeMove(4, 8, 4, 7);
    return { gateClosedBefore, ...eval("(" + snapshotSrc + ")")() };
  }, snapshot.toString());

  expect(result.gateClosedBefore).toBe(true); // the gate did NOT open for the lone King
  expect(result.floor).toBe(1);
  expect(result.diedOnce).toBe(true);         // respawnFromFloorOne's own marker
  expect(result.message).toContain("insufficient material");
});

test("loneking=draw is the same rule, spelled out, and the parameter survives the URL rewrite", async ({ page }) => {
  await knightFloor(page, "?loneking=draw");
  const result = await page.evaluate(async snapshotSrc => {
    await makeMove(4, 8, 4, 7);
    return eval("(" + snapshotSrc + ")")();
  }, snapshot.toString());

  expect(result.floor).toBe(1);
  expect(result.message).toContain("insufficient material");
  expect(result.search).toContain("loneking=draw");
});

test("default: no draw while White still has a piece besides the King", async ({ page }) => {
  await knightFloor(page, "", { "07": "P" });
  const result = await page.evaluate(async snapshotSrc => {
    await makeMove(4, 8, 4, 7);
    return eval("(" + snapshotSrc + ")")();
  }, snapshot.toString());

  expect(result.floor).toBe(4);
  expect(result.gateClosed).toBe(true);
  expect(result.message).toBe("");
});

test("loneking=reinforce: nothing for 7 lone-King moves, then a Black queen arrives on the 8th, with a message, and the gate stays shut", async ({ page }) => {
  await knightFloor(page, "?loneking=reinforce");
  const result = await page.evaluate(async snapshotSrc => {
    const snapshot = eval("(" + snapshotSrc + ")");
    const step = async () => {
      const king = findWhiteKing(state.board);
      const m = legalMovesFrom(state.board, king.x, king.y)[0];
      await makeMove(king.x, king.y, m.x, m.y);
    };
    for (let i = 0; i < LONE_KING_REINFORCE_MOVES - 1; i++) await step();
    const after7 = snapshot();
    await step();
    return { limit: LONE_KING_REINFORCE_MOVES, after7, after8: snapshot() };
  }, snapshot.toString());

  expect(result.limit).toBe(8);
  expect(result.after7).toMatchObject({ floor: 4, diedOnce: false, queens: 0, gateClosed: true });
  expect(result.after8).toMatchObject({ floor: 4, diedOnce: false, queens: 1, gateClosed: true });
  expect(result.after8.message).toContain("reinforcements");
  expect(result.after8.search).toContain("loneking=reinforce");
});

test("loneking=reinforce: the hunt ends the run through the existing death path (checkDeath), not a new one", async ({ page }) => {
  test.setTimeout(120_000);
  await knightFloor(page, "?loneking=reinforce");
  const result = await page.evaluate(async snapshotSrc => {
    let deaths = 0;
    const realCheckDeath = checkDeath;
    window.checkDeath = () => { const died = realCheckDeath(); if (died) deaths++; return died; };
    let moves = 0;
    while (!state.diedOnce && moves < 200) {
      const king = findWhiteKing(state.board);
      const m = legalMovesFrom(state.board, king.x, king.y)[0];
      await makeMove(king.x, king.y, m.x, m.y);
      moves++;
    }
    return { moves, deaths, ...eval("(" + snapshotSrc + ")")() };
  }, snapshot.toString());

  expect(result.diedOnce).toBe(true);
  expect(result.deaths).toBe(1);
  expect(result.floor).toBe(1);
  expect(result.message).toContain("you fell"); // announceDeath's text, not a draw's
});

test("loneking=fifty: 50 moves without a capture on a boss floor is a draw, lone King or not", async ({ page }) => {
  // The same quiet opening move from the same position, one short of the
  // limit and then on it -- so the two halves differ only in the count.
  const quietMoveFrom = async already => {
    await knightFloor(page, "?loneking=fifty", { "07": "P" });
    return page.evaluate(async ([snapshotSrc, already]) => {
      state.quietMoves = FIFTY_MOVE_LIMIT - already;
      await makeMove(4, 8, 4, 7);
      return { limit: FIFTY_MOVE_LIMIT, ...eval("(" + snapshotSrc + ")")() };
    }, [snapshot.toString(), already]);
  };
  const at49 = await quietMoveFrom(2);
  const at50 = await quietMoveFrom(1);

  expect(at50.limit).toBe(50);
  expect(at49).toMatchObject({ floor: 4, quietMoves: 49, gateClosed: true, message: "" });
  expect(at50.floor).toBe(1);
  expect(at50.diedOnce).toBe(true);
  expect(at50.message).toContain("50 moves without a capture");
});

test("loneking=fifty: a capture restarts the count, and a lone King is not drawn early", async ({ page }) => {
  await knightFloor(page, "?loneking=fifty");
  const result = await page.evaluate(async snapshotSrc => {
    const snapshot = eval("(" + snapshotSrc + ")");
    await makeMove(4, 8, 4, 7);
    const loneKingAfterOne = snapshot();
    const king = findWhiteKing(state.board);
    state.board[king.y][king.x === 0 ? 1 : king.x - 1] = "p"; // a pawn beside the King: can't attack sideways
    state.quietMoves = FIFTY_MOVE_LIMIT - 1;
    await makeMove(king.x, king.y, king.x === 0 ? 1 : king.x - 1, king.y);
    return { loneKingAfterOne, afterCapture: snapshot() };
  }, snapshot.toString());

  expect(result.loneKingAfterOne).toMatchObject({ floor: 4, diedOnce: false, quietMoves: 1, gateClosed: true });
  expect(result.afterCapture).toMatchObject({ floor: 4, diedOnce: false, quietMoves: 0 });
});

test("off a boss floor none of this fires: a lone King with no gate just plays on", async ({ page }) => {
  await page.goto(GAME_URL); // floor 1, "First blood", lone King, no gate
  const result = await page.evaluate(async snapshotSrc => {
    await makeMove(4, 8, 4, 7);
    return eval("(" + snapshotSrc + ")")();
  }, snapshot.toString());

  expect(result.floor).toBe(1);
  expect(result.diedOnce).toBe(false);
  expect(result.gateClosed).toBe(false);
});
