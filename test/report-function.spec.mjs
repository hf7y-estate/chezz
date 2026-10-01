import { test, expect } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";
import report from "../netlify/functions/report.js";

async function withMockGithub(run) {
  let posted = null;
  globalThis.Netlify = { env: { get: k => (k === "GITHUB_ISSUE_TOKEN" ? "test-token" : undefined) } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes("api.github.com")) return realFetch(url, init);
    if (init.method === "POST") {
      posted = JSON.parse(init.body);
      return new Response(JSON.stringify({ number: 1, html_url: "https://x" }), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };
  try {
    const res = await run();
    return { res, posted };
  } finally {
    delete globalThis.Netlify;
    globalThis.fetch = realFetch;
  }
}

test("every response carries a permissive CORS header", async () => {
  const req = new Request("https://chezz.hf7y.com/.netlify/functions/report?scope=sweep-status");
  const { res } = await withMockGithub(() => report(req));
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});

function postReq(kind) {
  return new Request("https://chezz.hf7y.com/.netlify/functions/report", {
    method: "POST",
    body: JSON.stringify({ type: "bug", kind, name: "abc123", url: "https://x", description: "test report" }),
  });
}

test("kind: feature is filed with the idea label, not bug (hf7y/chezz#120/#123/#124)", async () => {
  const { posted } = await withMockGithub(() => report(postReq("feature")));
  expect(posted.labels).toContain("idea");
  expect(posted.labels).not.toContain("bug");
});

test("kind: bug is still filed with the bug label", async () => {
  const { posted } = await withMockGithub(() => report(postReq("bug")));
  expect(posted.labels).toContain("bug");
  expect(posted.labels).not.toContain("idea");
});

test("with the App's id and key set, the issue is filed on a minted installation token scoped to this repo's issues", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = { GITHUB_APP_ID: "42", GITHUB_APP_KEY: privateKey.export({ type: "pkcs1", format: "pem" }) };
  globalThis.Netlify = { env: { get: k => env[k] } };
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url: String(url), auth: init.headers.authorization, body: init.body });
    if (String(url).endsWith("/installation")) return new Response(JSON.stringify({ id: 7 }), { status: 200 });
    if (String(url).endsWith("/app/installations/7/access_tokens")) {
      return new Response(JSON.stringify({ token: "minted", expires_at: new Date(Date.now() + 3600e3).toISOString() }), { status: 201 });
    }
    return new Response(JSON.stringify({ number: 1, html_url: "https://x" }), { status: 201 });
  };
  try {
    const res = await report(postReq("bug"));
    expect((await res.json()).ok).toBe(true);
    await report(postReq("bug"));
  } finally {
    delete globalThis.Netlify;
    globalThis.fetch = realFetch;
  }
  expect(JSON.parse(seen[1].body)).toEqual({ repositories: ["chezz"], permissions: { issues: "write" } });
  const issuePosts = seen.filter(c => c.url.endsWith("/issues"));
  expect(issuePosts.map(c => c.auth)).toEqual(["Bearer minted", "Bearer minted"]);
  expect(seen.filter(c => c.url.endsWith("/access_tokens"))).toHaveLength(1); // second report reuses the token
});
