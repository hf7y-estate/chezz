#!/usr/bin/env bash
# build-site.sh -- assemble _site/. Called by Netlify's build command.
# FAILS LOUDLY: a missing piece breaks the deploy rather than publishing a
# site quietly short of /classic/ or /nightly-builds/.
set -euo pipefail

OUT="${1:-_site}"
export CLASSIC_BRANCH="${CLASSIC_BRANCH:-chezz-classic}"

rm -rf "$OUT"
mkdir -p "$OUT"

# index1.html is the whole game; it is served AS index.html at the root.
cp index1.html "$OUT/index.html"
cp -r nightly-builds "$OUT/nightly-builds"

# Classic's shell (HTML/CSS, leaderboard, promotion UI, drag/click
# handling) ships from its own branch; its engine functions are narrative's
# current ones, spliced in at build time (hf7y/chezz#89) so a fix to the
# shared engine reaches classic without a manual port. The published copy
# is stripped; chezz-classic's own source keeps every comment (#90).
node scripts/build-classic-artifact.mjs | node scripts/strip-html.mjs > "$OUT/classic.html"
mkdir -p "$OUT/classic"
cp "$OUT/classic.html" "$OUT/classic/index.html"

test -s "$OUT/index.html"
test -f "$OUT/nightly-builds/index.html"
test -f "$OUT/nightly-builds/manifest.js"
test -s "$OUT/classic.html"
cmp "$OUT/classic.html" "$OUT/classic/index.html"

printf 'built %s: index.html %s bytes, classic.html %s bytes\n' \
  "$OUT" "$(wc -c < "$OUT/index.html")" "$(wc -c < "$OUT/classic.html")"
