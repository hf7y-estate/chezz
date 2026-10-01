/* Covers scripts/check-live-deploy.mjs -- the domain-serving check: does a
 * player actually reach the game on the live domain right now.
 *
 * Only checkDomain() is pinned here, via a fake fetch -- it's the part with
 * no side effects and a clear contract (status code in, ok/detail out). The
 * gh-issue filing/closing halves shell out to `gh` against a real repo and
 * aren't exercised here; check-answer-channel.spec.mjs's UNREACHABLE_REPO
 * pattern doesn't apply cleanly because this script also WRITES (creates/
 * closes issues), and a test fixture that actually opened issues against
 * hf7y/chezz would leave debris behind rather than clean up after itself.
 * Known limit, not an oversight.
 */
import { test, expect } from "@playwright/test";
import {
  checkDomain,
  checkClassicReportUrl,
  closeComment,
  DOMAINS,
  GAME_PATHS,
  REPORT_ENDPOINT,
  CLASSIC_PAGES,
  REPO,
} from "../scripts/check-live-deploy.mjs";

test("a 200 response is reported ok", async () => {
  const fakeFetch = async () => ({ status: 200 });
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(true);
});

test("a non-200 response is reported not-ok, with the status in the detail", async () => {
  const fakeFetch = async () => ({ status: 404 });
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("404");
});

test("a network error (fetch throws) is reported not-ok, not an uncaught exception", async () => {
  const fakeFetch = async () => { throw new Error("getaddrinfo ENOTFOUND example.test"); };
  const result = await checkDomain({ name: "example", url: "https://example.test/" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("ENOTFOUND");
});

test("every route checked is on the Netlify domain -- Pages is gone (#145)", () => {
  const urls = [...DOMAINS, ...GAME_PATHS, ...CLASSIC_PAGES, REPORT_ENDPOINT].map((d) => d.url);
  expect(urls).toContain("https://chezz.hf7y.com/");
  expect(urls).toContain("https://chezz.hf7y.com/nightly-builds/");
  expect(urls).toContain("https://chezz.hf7y.com/classic.html");
  for (const url of urls) expect(url.startsWith("https://chezz.hf7y.com/")).toBe(true);
});

// hf7y/chezz#128: the report box posts to a relative /.netlify/functions/report,
// which 404s anywhere but the canonical Netlify domain.
test("the report endpoint is checked against the canonical Netlify domain", () => {
  expect(REPORT_ENDPOINT.url).toBe(
    "https://chezz.hf7y.com/.netlify/functions/report?scope=sweep-status"
  );
});

test("checkClassicReportUrl: a page naming the Netlify function is ok", async () => {
  const fakeFetch = async () => ({
    status: 200,
    text: async () => "<script>const LEADERBOARD_URL = \"https://chezz.hf7y.com/.netlify/functions/report\";</script>",
  });
  const result = await checkClassicReportUrl({ name: "example", url: "https://example.test/classic.html" }, fakeFetch);
  expect(result.ok).toBe(true);
});

test("checkClassicReportUrl: a page still naming the retired Google Apps Script URL fails, even at HTTP 200 (hf7y/chezz#82)", async () => {
  const fakeFetch = async () => ({
    status: 200,
    text: async () => "<script>const LEADERBOARD_URL = \"https://script.google.com/macros/s/abc/exec\";</script>",
  });
  const result = await checkClassicReportUrl({ name: "example", url: "https://example.test/classic.html" }, fakeFetch);
  expect(result.ok).toBe(false);
  expect(result.detail).toContain("retired Google Apps Script URL");
});

test("checkClassicReportUrl: a page naming neither URL fails loud instead of passing silently", async () => {
  const fakeFetch = async () => ({ status: 200, text: async () => "<script>const LEADERBOARD_URL = \"\";</script>" });
  const result = await checkClassicReportUrl({ name: "example", url: "https://example.test/classic.html" }, fakeFetch);
  expect(result.ok).toBe(false);
});

// The close comment's "repo:<name>" landing ref is gh-sign's only way to
// find what a close is actually about (grammar_landing_ref) -- it has to
// name the repo this script is actually running against, not a hardcoded
// org/name pair that can drift out from under it the way "repo:hf7y/chezz"
// did across both the 2026-09-25 org transfer (#146 fixed the `--repo` flag
// but missed this inline string) and the 2026-10-01 Netlify-only rewrite
// (#147, which carried the same stale string forward unchanged).
test("the stale-issue close comment's landing ref names the live REPO, not a hardcoded org/name", () => {
  expect(closeComment()).toContain(`repo:${REPO}`);
  expect(closeComment()).not.toContain("hf7y/chezz");
});
