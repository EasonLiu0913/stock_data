#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
OUTPUT_DIR="${2:-_site}"

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
if [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Keep the historical repository-root layout because pages under public/ load
# data with ../data_* paths. Exclude development-only content to reduce the
# Pages artifact while retaining every published data directory.
rsync -aL \
  --exclude='.git/' \
  --exclude='.github/' \
  --exclude='node_modules/' \
  --exclude='_site/' \
  --exclude='tests/' \
  --exclude='scripts/' \
  --exclude='docs/' \
  --exclude='output/' \
  --exclude='tmp/' \
  "$ROOT_DIR/" "$OUTPUT_DIR/"

touch "$OUTPUT_DIR/.nojekyll"

if [[ ! -f "$OUTPUT_DIR/public/index.html" ]]; then
  echo 'Missing public/index.html in Pages artifact' >&2
  exit 1
fi

# Preserve both URL styles:
#   /stock_data/public/prediction-dashboard.html  (historical and canonical)
#   /stock_data/prediction-dashboard.html         (temporary root-style links)
# Root aliases redirect into public/ so ../data_* continues to resolve to the
# repository-root data directories copied above.
for source_page in "$OUTPUT_DIR"/public/*.html; do
  [[ -e "$source_page" ]] || continue
  page_name="$(basename "$source_page")"
  cat > "$OUTPUT_DIR/$page_name" <<EOF
<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=public/$page_name">
  <title>重新導向</title>
  <script>
    (function () {
      var target = 'public/$page_name' + window.location.search + window.location.hash;
      window.location.replace(target);
    }());
  </script>
</head>
<body>
  <p><a href="public/$page_name">前往頁面</a></p>
</body>
</html>
EOF
done

node - "$OUTPUT_DIR" <<'NODE'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const siteRoot = path.resolve(process.argv[2]);
const publicRoot = path.join(siteRoot, 'public');
const criticalFiles = [
  'public/index.html',
  'public/prediction-dashboard.html',
  'public/prediction-replay-dashboard.html',
  'public/prediction-industry-dashboard.html',
  'public/prediction-groups.html',
  'data_predictions/manifest.json',
  'prediction-dashboard.html'
];

for (const relativePath of criticalFiles) {
  if (!fs.existsSync(path.join(siteRoot, relativePath))) {
    throw new Error(`Pages artifact missing ${relativePath}`);
  }
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(?:html|js|css)$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const referencedRoots = new Set();
for (const filePath of walk(publicRoot)) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const match of text.matchAll(/\.\.\/([A-Za-z0-9_.-]+)\//g)) {
    const rootName = match[1];
    if (/^(?:data|normalized)/.test(rootName)) referencedRoots.add(rootName);
  }
}

const missingRoots = [...referencedRoots].filter(
  (rootName) => !fs.existsSync(path.join(siteRoot, rootName))
);
if (missingRoots.length) {
  throw new Error(`Pages artifact missing referenced data roots: ${missingRoots.join(', ')}`);
}

const predictionHtml = fs.readFileSync(
  path.join(publicRoot, 'prediction-dashboard.html'),
  'utf8'
);
if (!predictionHtml.includes("../data_predictions/manifest.json")) {
  throw new Error('Prediction dashboard manifest dependency changed unexpectedly');
}

console.log(`Prepared Pages artifact: ${siteRoot}`);
console.log(`Validated ${referencedRoots.size} referenced data roots`);
NODE
