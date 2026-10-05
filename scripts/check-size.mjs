// Narrative (main) is tracking-only, unbounded. Classic is capped on the
// PUBLISHED ARTIFACT (stripped, same as bin/build-site.sh), never on its
// own commented source -- hf7y/chezz#90. The verdict itself lives in
// size-policy.mjs, pinned by test/size-policy.spec.mjs.
//
// The artifact itself is BUILT, not just fetched -- hf7y/chezz#89:
// build-classic-artifact.mjs splices narrative's current engine functions
// into classic's own shell, so this measures the artifact the same way a
// fix to the shared engine would actually reach it, not a stale branch
// snapshot.
import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripHtml } from "./strip-html.mjs";
import { buildClassicArtifact, fetchClassicSource } from "./build-classic-artifact.mjs";
import { sizeVerdict } from "./size-policy.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { size: narrativeBytes } = statSync(path.join(root, "index1.html"));
const narrativeHtml = readFileSync(path.join(root, "index1.html"), "utf8");
const classicHtml = fetchClassicSource();
const classicArtifact = stripHtml(buildClassicArtifact({ narrativeHtml, classicHtml }));
const classicArtifactBytes = Buffer.byteLength(classicArtifact);

const verdict = sizeVerdict({ narrativeBytes, classicArtifactBytes });
for (const line of verdict.log) console.log(line);
for (const line of verdict.warnings) console.warn(line);
for (const line of verdict.errors) console.error(line);
if (!verdict.ok) process.exit(1);
