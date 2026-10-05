// Pins the size policy that lived as prose in DESIGN-NOTES.md
// (hf7y-estate/chezz#150): the narrative build is never failed for its
// size, and classic's published artifact has a 50,000-byte soft target
// that only warns and a 100,000-byte hard cap that fails the check.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { sizeVerdict, SOFT_TARGET_BYTES, HARD_CAP_BYTES } from "../scripts/size-policy.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const small = 40_000;

test("the narrative build is never failed for its size, however large", () => {
  for (const narrativeBytes of [0, HARD_CAP_BYTES + 1, 50_000_000]) {
    const v = sizeVerdict({ narrativeBytes, classicArtifactBytes: small });
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
  }
});

test("classic's caps are 50,000 soft and 100,000 hard", () => {
  expect(SOFT_TARGET_BYTES).toBe(50_000);
  expect(HARD_CAP_BYTES).toBe(100_000);
});

test("classic over the soft target warns but passes; over the hard cap fails", () => {
  expect(sizeVerdict({ narrativeBytes: 0, classicArtifactBytes: SOFT_TARGET_BYTES })).toMatchObject({ ok: true, warnings: [] });

  const soft = sizeVerdict({ narrativeBytes: 0, classicArtifactBytes: SOFT_TARGET_BYTES + 1 });
  expect(soft.ok).toBe(true);
  expect(soft.warnings).toHaveLength(1);

  expect(sizeVerdict({ narrativeBytes: 0, classicArtifactBytes: HARD_CAP_BYTES }).ok).toBe(true);

  const hard = sizeVerdict({ narrativeBytes: 0, classicArtifactBytes: HARD_CAP_BYTES + 1 });
  expect(hard.ok).toBe(false);
  expect(hard.errors[0]).toMatch(/Do NOT trim to fit/);
});

test("check-size measures the built, stripped artifact through this verdict", () => {
  const src = fs.readFileSync(path.join(root, "scripts", "check-size.mjs"), "utf8");
  expect(src).toMatch(/stripHtml\(buildClassicArtifact\(/);
  expect(src).toMatch(/sizeVerdict\(/);
  expect(src).not.toMatch(/\b\d{2,3}_000\b/);
});
