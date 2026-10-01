// netlify/functions/report.js stores reports and holds no credential;
// scripts/drain-reports.mjs files them. Both halves, against fakes.
import { test, expect } from "@playwright/test";
import report, { useStore } from "../netlify/functions/report.js";
import { issueFor, drain } from "../scripts/drain-reports.mjs";

function fakeStore() {
  const m = new Map();
  return {
    m,
    list: async () => ({ blobs: [...m.keys()].map(key => ({ key })) }),
    setJSON: async (k, v) => { m.set(k, v); },
    get: async k => m.get(k) ?? null,
    delete: async k => { m.delete(k); },
  };
}

// Every GitHub call the function makes is a read with no authorization header.
async function withGithub(issues, run) {
  const store = fakeStore();
  useStore(store);
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", auth: init.headers?.authorization });
    return new Response(JSON.stringify(issues), { status: 200 });
  };
  try {
    return { res: await run(store), store, calls };
  } finally {
    globalThis.fetch = realFetch;
    useStore(undefined);
  }
}

const postReq = kind => new Request("https://chezz.hf7y.com/.netlify/functions/report", {
  method: "POST",
  body: JSON.stringify({ type: "bug", kind, name: "abc123", url: "https://x", description: "test report" }),
});
const getReq = scope => new Request(`https://chezz.hf7y.com/.netlify/functions/report?scope=${scope}`);

test("every response carries a permissive CORS header", async () => {
  const { res } = await withGithub([], () => report(getReq("sweep-status")));
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});

test("a report is stored, answered ok, and GitHub is never called", async () => {
  const { res, store, calls } = await withGithub([], () => report(postReq("feature")));
  const data = await res.json();
  expect(data.ok).toBe(true);
  expect(calls).toHaveLength(0);
  const [stored] = [...store.m.values()];
  expect(stored).toMatchObject({ id: data.queued, kind: "idea", name: "abc123", description: "test report" });
});

test("kind: bug is stored as bug, and anything unrecognised too (hf7y/chezz#120)", async () => {
  const { store } = await withGithub([], async () => { await report(postReq("bug")); return report(postReq("nonsense")); });
  expect([...store.m.values()].map(r => r.kind)).toEqual(["bug", "bug"]);
});

test("pending serves what is stored, with no authorization sent to GitHub", async () => {
  const { res, calls } = await withGithub([], async () => { await report(postReq("bug")); return report(getReq("pending")); });
  expect(await res.json()).toHaveLength(1);
  expect(calls.every(c => c.method === "GET" && c.auth === undefined)).toBe(true);
});

test("a report whose id is already in an issue body leaves the queue", async () => {
  const store = fakeStore();
  await store.setJSON("id-filed", { id: "id-filed", description: "old" });
  await store.setJSON("id-new", { id: "id-new", description: "new" });
  useStore(store);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{ body: "x\n- report: id-filed\n" }]), { status: 200 });
  try {
    const res = await report(getReq("pending"));
    expect((await res.json()).map(r => r.id)).toEqual(["id-new"]);
    expect([...store.m.keys()]).toEqual(["id-new"]);
  } finally {
    globalThis.fetch = realFetch;
    useStore(undefined);
  }
});

const sample = { id: "id-1", at: "2026-10-01T00:00:00Z", kind: "idea", name: "abc123", build: "https://x", description: "a long first line ".repeat(10) + "\nsecond" };

test("issueFor: the estate's body grammar, the report id, and both labels", () => {
  const { title, body, labels } = issueFor(sample);
  expect(title.length).toBeLessThanOrEqual(72);
  expect(body.split("\n")[0]).toMatch(/^NO-DECISION: /);
  expect(body).toContain("- report: id-1");
  expect(body).toContain("- player: `abc123`");
  expect(body).toContain("<!-- /DELIVERS -->");
  expect(labels).toEqual(["player-report", "idea"]);
});

test("drain files what is new and skips what an issue already carries", async () => {
  const pending = [sample, { ...sample, id: "id-2" }];
  const ran = [];
  const run = (...args) => {
    ran.push(args);
    if (args[1] === "list") return JSON.stringify(args.includes("id-2 in:body") ? [{ number: 9 }] : []);
    return "";
  };
  const out = await drain(async () => new Response(JSON.stringify(pending), { status: 200 }), run);
  expect(out).toEqual({ filed: 1, skipped: 1 });
  expect(ran.filter(a => a[1] === "create")).toHaveLength(1);
});

test("drain says BLIND-worthy things loudly: an unreadable queue throws", async () => {
  await expect(drain(async () => new Response("no", { status: 502 }), () => "[]")).rejects.toThrow("HTTP 502");
});
