// resolveBossStandoff's FIFTY_MOVE_LIMIT safety net (hf7y/chezz#142/#143,
// research/balance/README.md's 2026-09-23 entry: a lone King can never
// force "The Knight" boss's capture, so a quiet-move counter ends the
// standoff instead) only works if the counter survives a reload. Before
// this fix, quietMoves/loneKingMoves lived only in the in-memory `state`
// object -- absent from updateUrl's params, so loadFromUrl (run on every
// boot, including a reload mid-standoff) left them at their initial 0
// forever, silently re-arming the fifty-move countdown every time a player
// closed the tab and came back to a stuck boss fight. hf7y-estate/chezz#167
// is a player stuck exactly here.
import { test, expect } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

test("quietMoves/loneKingMoves persist through the URL across a reload of an already-spawned floor", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-4K3_w&floor=1&spawned=1&budget=1&maxRank=0&quietMoves=37&loneKingMoves=5");
  const result = await page.evaluate(() => ({ quietMoves: state.quietMoves, loneKingMoves: state.loneKingMoves }));
  expect(result.quietMoves).toBe(37);
  expect(result.loneKingMoves).toBe(5);
});

test("a fresh boot (no quietMoves/loneKingMoves in the URL) starts both at 0", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-5PPP-4K3_w&floor=1&spawned=1&budget=1&maxRank=0");
  const result = await page.evaluate(() => ({ quietMoves: state.quietMoves, loneKingMoves: state.loneKingMoves }));
  expect(result.quietMoves).toBe(0);
  expect(result.loneKingMoves).toBe(0);
});

test("updateUrl round-trips a non-zero quietMoves/loneKingMoves back through loadFromUrl", async ({ page }) => {
  await page.goto(GAME_URL);
  const after = await page.evaluate(() => {
    state.quietMoves = 42;
    state.loneKingMoves = 6;
    updateUrl();
    loadFromUrl();
    return { quietMoves: state.quietMoves, loneKingMoves: state.loneKingMoves };
  });
  expect(after.quietMoves).toBe(42);
  expect(after.loneKingMoves).toBe(6);
});

test("a new floor (spawned=0) still resets both to 0 even if the URL carries stale values", async ({ page }) => {
  await page.goto(GAME_URL + "?fen=8-8-8-8-8-8-8-8-4K3_w&floor=2&spawned=0&budget=1&maxRank=0&quietMoves=49&loneKingMoves=7");
  const result = await page.evaluate(() => ({ quietMoves: state.quietMoves, loneKingMoves: state.loneKingMoves }));
  expect(result.quietMoves).toBe(0);
  expect(result.loneKingMoves).toBe(0);
});
