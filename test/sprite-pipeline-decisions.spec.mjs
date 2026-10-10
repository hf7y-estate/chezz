// Pins two sprite-pipeline decisions that lived as prose in DESIGN-NOTES.md
// (hf7y-estate/chezz#150): the pipeline adds no dependency, and the paid
// generator runs only when a person asks for it by name. The sibling
// decisions are pinned elsewhere: the palette snap in
// sprite-postprocess.spec.mjs, baked-in data URIs in piece-sprites.spec.mjs.
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const pkg = JSON.parse(read("package.json"));

test("the sprite pipeline rides on what was already installed: no new dependency", () => {
  expect(Object.keys(pkg.dependencies)).toEqual(["@netlify/blobs"]);
  expect(Object.keys(pkg.devDependencies)).toEqual(["@playwright/test"]);

  const tools = fs.readdirSync(path.join(root, "tools"));
  expect(tools.length).toBeGreaterThan(0);
  for (const file of tools) {
    const specifiers = [...read("tools", file).matchAll(/\bfrom\s+["']([^"']+)["']|\b(?:import|require)\(\s*["']([^"']+)["']/g)]
      .map(m => m[1] ?? m[2]);
    for (const s of specifiers) {
      expect(s, `${file} imports ${s}`).toMatch(/^(node:|\.{1,2}\/|@playwright\/test$)/);
    }
  }
});

test("the paid generator is reachable only by its own npm script, never from a check or hook", () => {
  const callers = Object.entries(pkg.scripts)
    .filter(([, cmd]) => cmd.includes("generate-pieces"))
    .map(([name]) => name);
  expect(callers).toEqual(["pieces:generate"]);

  const others = Object.entries(pkg.scripts).filter(([name]) => name !== "pieces:generate");
  for (const [name, cmd] of others) {
    expect(cmd, `npm run ${name}`).not.toContain("pieces:generate");
  }

  const automation = [".githooks", "bin", "scripts"];
  let scanned = 0;
  for (const dir of automation) {
    for (const file of fs.readdirSync(path.join(root, dir))) {
      scanned++;
      expect(read(dir, file), `${dir}/${file}`).not.toMatch(/generate-pieces|pieces:generate(?!-)/);
    }
  }
  expect(scanned).toBeGreaterThan(0);
});
