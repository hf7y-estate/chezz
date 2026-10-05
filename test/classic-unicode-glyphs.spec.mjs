// Pins a decision that lived as prose in DESIGN-NOTES.md
// (hf7y-estate/chezz#150): classic's visual identity is Unicode glyphs,
// permanently -- its artifact budget can't carry baked sprites, so the
// sprite pipeline is narrative-only (hf7y/chezz#95, #89, #90).
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { buildClassicArtifact, fetchClassicSource, CORE_SWAP, CORE_ADD } from "../scripts/build-classic-artifact.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("the shared engine never carries the sprite table or its renderer into classic", () => {
  for (const name of ["PIECE_SPRITES", "pieceGlyphHtml"]) {
    expect(CORE_SWAP).not.toContain(name);
    expect(CORE_ADD).not.toContain(name);
  }
});

test("the built classic artifact draws every piece as a Unicode glyph, with no image data", () => {
  const narrativeHtml = fs.readFileSync(path.join(root, "index1.html"), "utf8");
  const artifact = buildClassicArtifact({ narrativeHtml, classicHtml: fetchClassicSource() });
  expect(artifact).not.toMatch(/data:image/);
  expect(artifact).not.toMatch(/<img\b/i);
  expect(artifact).not.toContain("PIECE_SPRITES");
  for (const glyph of "♔♕♖♗♘♙♚♛♜♝♞♟") expect(artifact).toContain(glyph);
});
