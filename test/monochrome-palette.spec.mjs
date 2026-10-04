// Pins the standing "monochrome palette" design rule (DESIGN-NOTES.md,
// human ask, reverted 2026-07-19 after a saturated reskin) by parsing
// index1.html's own <style> block rather than loading a page: every color
// literal there must be grayscale (R==G==B) unless it's one of the signal
// colors the stylesheet's own comments already call out as exempt --
// td[data-legal]'s green/amber/red threat-level dots and td[data-threat]'s
// red check glow (index1.html's comments at the --root block and above
// td[data-legal]::after: "Same signal-color exemption as the check-glow
// red -- not part of the monochrome decorative palette"), plus the
// white-move-hint star's gold (td[data-legal][data-hint]::after, #3) which
// rides the same always-on signal layer as the dot it overrides even
// though no comment named it until now.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, "index1.html"), "utf8");

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("index1.html has no <style> block to scan");
// Strip comments first -- they're full of bare issue-number references
// like "hf7y/chezz#118" that a hex-color regex would otherwise misread
// as a 3-digit color (#118).
const css = styleMatch[1].replace(/\/\*[\s\S]*?\*\//g, "");

// The documented signal-color exemptions -- an exhaustive allowlist, not a
// tolerance band, so a new hued decorative color still fails loudly.
const EXEMPT_RGB = new Set([
  "70,255,145", // legal-move dot: safe (green)
  "255,179,71", // legal-move dot: covered (amber)
  "255,56,96", // legal-move dot: hanging, and the check-glow red
  "255,215,0", // white-move-hint star (gold)
]);
const EXEMPT_HEX = new Set([
  "ff3860", // check-glow red, written as a hex literal in td[data-threat]
]);

function isGrayscale(r, g, b) {
  return r === g && g === b;
}

function* colorLiterals(source) {
  const hex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m;
  while ((m = hex.exec(source))) yield { kind: "hex", raw: m[0], value: m[1].toLowerCase() };
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/g;
  while ((m = rgb.exec(source))) {
    yield { kind: "rgb", raw: m[0], r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
}

function hexToRgb(hex) {
  const h = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

test("every color literal in index1.html's stylesheet is grayscale or an explicitly exempt signal color", () => {
  const offenders = [];
  for (const lit of colorLiterals(css)) {
    if (lit.kind === "hex") {
      const [r, g, b] = hexToRgb(lit.value);
      if (isGrayscale(r, g, b)) continue;
      if (EXEMPT_HEX.has(lit.value)) continue;
      offenders.push(lit.raw);
    } else {
      if (isGrayscale(lit.r, lit.g, lit.b)) continue;
      if (EXEMPT_RGB.has(`${lit.r},${lit.g},${lit.b}`)) continue;
      offenders.push(lit.raw);
    }
  }
  expect(offenders).toEqual([]);
});

test("the four decorative palette variables in :root are themselves grayscale", () => {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  expect(root).not.toBeNull();
  const vars = [...root[1].matchAll(/--(ink|felt|panel|cream|gold|pink):\s*#([0-9a-fA-F]{6})/g)];
  expect(vars.length).toBe(6);
  for (const [, name, hex] of vars) {
    const [r, g, b] = hexToRgb(hex);
    expect(isGrayscale(r, g, b), `--${name}: #${hex} is not grayscale`).toBe(true);
  }
});
