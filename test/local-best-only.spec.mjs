// Pins a decision that lived as prose in DESIGN-NOTES.md
// (hf7y-estate/chezz#150): the server-side score leaderboard was dropped
// in favor of a purely-local "Your best" (hf7y/chezz#15, "Option C",
// confirmed by Zach). No score ever leaves the page, and the report
// endpoint keeps no scores.
import { test, expect } from "@playwright/test";
import report, { useStore } from "../netlify/functions/report.js";
import { GAME_URL } from "./helpers.mjs";

test("the only leaderboard entry on the page is the player's own best", async ({ page }) => {
  await page.goto(GAME_URL);
  const entries = await page.$$eval("#leaderboard dt", els => els.map(e => e.textContent.trim()));
  expect(entries).toEqual(["Your best"]);
});

test("reaching a new best is kept in localStorage and sends nothing", async ({ page }) => {
  await page.goto(GAME_URL);
  const result = await page.evaluate(() => {
    const sent = [];
    const realFetch = window.fetch;
    window.fetch = (...args) => { sent.push(String(args[0])); return realFetch(...args).catch(() => {}); };
    localStorage.removeItem("chezzBestScore");
    state.maxRank = 33;
    updateUrl();
    renderMyBest();
    window.fetch = realFetch;
    return { sent, best: JSON.parse(localStorage.getItem("chezzBestScore")) };
  });
  expect(result.best.rank).toBe(33);
  expect(result.sent).toEqual([]);
});

test("the report endpoint stores no score and serves no leaderboard", async () => {
  const writes = [];
  const store = {
    list: async () => ({ blobs: [] }),
    setJSON: async (k, v) => { writes.push(v); },
    get: async () => null,
  };
  useStore(store, store);
  try {
    const post = await report(new Request("https://chezz.hf7y.com/.netlify/functions/report", {
      method: "POST",
      body: JSON.stringify({ name: "abc123", rank: 99, floor: 9, url: "https://chezz.hf7y.com/?floor=9" }),
    }));
    expect(post.status).toBe(400);
    expect(writes).toEqual([]);

    for (const scope of ["leaderboard", "scores", "daily", "top"]) {
      const res = await report(new Request(`https://chezz.hf7y.com/.netlify/functions/report?scope=${scope}`));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("unknown scope");
    }
  } finally {
    useStore(undefined);
  }
});
