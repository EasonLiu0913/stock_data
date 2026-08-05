#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
DEPENDENCY_SCANNER="$SCRIPT_DIR/scan_pages_dependencies.js"

scan_dependencies() {
  local root_dir="$1"
  if [[ ! -f "$DEPENDENCY_SCANNER" ]]; then
    echo "Missing canonical Pages dependency scanner: $DEPENDENCY_SCANNER" >&2
    exit 1
  fi
  node "$DEPENDENCY_SCANNER" "$root_dir"
}

resolve_target_date() {
  local site_root="$1"
  local requested_date="${2:-}"
  node - "$site_root" "$requested_date" <<'NODE'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const siteRoot = path.resolve(process.argv[2]);
const requested = String(process.argv[3] || '').replace(/[^0-9]/g, '');
if (requested) {
  if (!/^20\d{6}$/.test(requested)) throw new Error(`Invalid target date: ${requested}`);
  process.stdout.write(requested);
  process.exit(0);
}

const manifestFile = path.join(siteRoot, 'data_predictions', 'manifest.json');
if (!fs.existsSync(manifestFile)) throw new Error('Missing data_predictions/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const candidates = [
  manifest.forecast_date_compact,
  manifest.target_date,
  manifest.latest_date,
  manifest.forecast_date,
  Array.isArray(manifest.available_dates) ? manifest.available_dates.at(-1) : null,
  manifest.output_directory ? path.basename(String(manifest.output_directory)) : null,
];
for (const candidate of candidates) {
  const value = String(candidate || '').replace(/[^0-9]/g, '');
  if (/^20\d{6}$/.test(value)) {
    process.stdout.write(value);
    process.exit(0);
  }
}
throw new Error('Unable to resolve latest prediction date from data_predictions/manifest.json');
NODE
}

run_self_test() {
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' RETURN

  mkdir -p \
    "$temp_dir/source/public" \
    "$temp_dir/source/data_predictions/20260805" \
    "$temp_dir/source/data_used/history" \
    "$temp_dir/source/data_dynamic/history" \
    "$temp_dir/source/data_unused/history"

  cat > "$temp_dir/source/public/index.html" <<'HTML'
<!doctype html><a href="../data_used/history/value.json">used</a>
<script>
const DATA_DIR = 'data_dynamic';
fetch(`${window.location.origin}/${DATA_DIR}/files.json`);
</script>
HTML
  for page in prediction-dashboard prediction-replay-dashboard prediction-industry-dashboard prediction-groups; do
    cat > "$temp_dir/source/public/$page.html" <<'HTML'
<!doctype html><script>fetch('../data_predictions/manifest.json')</script>
HTML
  done
  cat > "$temp_dir/source/data_predictions/manifest.json" <<'JSON'
{"forecast_date_compact":"20260805"}
JSON
  cat > "$temp_dir/source/data_predictions/20260805/manifest.json" <<'JSON'
{"forecast_date_compact":"20260805","generated_reports":1}
JSON
  cat > "$temp_dir/source/data_predictions/20260805/summary.json" <<'JSON'
{"forecast_date":"2026-08-05"}
JSON
  cat > "$temp_dir/source/data_predictions/20260805/group-summary.json" <<'JSON'
{"groups":[]}
JSON
  printf '{}\n' > "$temp_dir/source/data_used/history/value.json"
  printf '["history/value.json"]\n' > "$temp_dir/source/data_dynamic/files.json"
  printf '{}\n' > "$temp_dir/source/data_dynamic/history/value.json"
  printf '{}\n' > "$temp_dir/source/data_unused/history/value.json"

  bash "$SCRIPT_PATH" "$temp_dir/source" "$temp_dir/site" 20260805 >/dev/null
  test -f "$temp_dir/site/data_used/history/value.json"
  test -f "$temp_dir/site/data_dynamic/files.json"
  test -f "$temp_dir/site/data_dynamic/history/value.json"
  test ! -e "$temp_dir/site/data_unused"
  test -f "$temp_dir/site/data_predictions/20260805/summary.json"
  echo 'prepare_pages_site self-test passed'
}

if [[ "${1:-}" == "--print-dependencies" ]]; then
  ROOT_DIR="${2:-.}"
  ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
  scan_dependencies "$ROOT_DIR"
  exit 0
fi

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit 0
fi

ROOT_DIR="${1:-.}"
OUTPUT_DIR="${2:-_site}"
TARGET_DATE="${3:-}"

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
if [[ "$OUTPUT_DIR" != /* ]]; then
  OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/public"

rsync -aL "$ROOT_DIR/public/" "$OUTPUT_DIR/public/"

mapfile -t dependencies < <(scan_dependencies "$ROOT_DIR")
for dependency in "${dependencies[@]}"; do
  [[ -n "$dependency" ]] || continue
  source_path="$ROOT_DIR/$dependency"
  destination_path="$OUTPUT_DIR/$dependency"
  if [[ -d "$source_path" ]]; then
    mkdir -p "$destination_path"
    rsync -aL "$source_path/" "$destination_path/"
  elif [[ -f "$source_path" ]]; then
    mkdir -p "$(dirname "$destination_path")"
    cp -L "$source_path" "$destination_path"
  else
    echo "Missing published dependency referenced by public assets: $dependency" >&2
    exit 1
  fi
done

for root_file in CNAME favicon.ico; do
  if [[ -f "$ROOT_DIR/$root_file" ]]; then cp -L "$ROOT_DIR/$root_file" "$OUTPUT_DIR/$root_file"; fi
done

touch "$OUTPUT_DIR/.nojekyll"

if [[ ! -f "$OUTPUT_DIR/public/index.html" ]]; then
  echo 'Missing public/index.html in Pages artifact' >&2
  exit 1
fi

for source_page in "$OUTPUT_DIR"/public/*.html; do
  [[ -e "$source_page" ]] || continue
  page_name="$(basename "$source_page")"
  cat > "$OUTPUT_DIR/$page_name" <<EOF_ALIAS
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
EOF_ALIAS
done

resolved_target_date="$(resolve_target_date "$OUTPUT_DIR" "$TARGET_DATE")"

node - "$OUTPUT_DIR" "$resolved_target_date" "${dependencies[@]}" <<'NODE'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const siteRoot = path.resolve(process.argv[2]);
const targetDate = process.argv[3];
const dependencies = process.argv.slice(4);
const publicRoot = path.join(siteRoot, 'public');
const criticalFiles = [
  'public/index.html',
  'public/prediction-dashboard.html',
  'public/prediction-replay-dashboard.html',
  'public/prediction-industry-dashboard.html',
  'public/prediction-groups.html',
  'data_predictions/manifest.json',
  'prediction-dashboard.html',
  `data_predictions/${targetDate}/manifest.json`,
  `data_predictions/${targetDate}/summary.json`,
  `data_predictions/${targetDate}/group-summary.json`,
];

for (const relativePath of criticalFiles) {
  if (!fs.existsSync(path.join(siteRoot, relativePath))) {
    throw new Error(`Pages artifact missing ${relativePath}`);
  }
}

for (const dependency of dependencies) {
  if (!fs.existsSync(path.join(siteRoot, dependency))) {
    throw new Error(`Pages artifact missing published dependency: ${dependency}`);
  }
}

const predictionHtml = fs.readFileSync(path.join(publicRoot, 'prediction-dashboard.html'), 'utf8');
if (!predictionHtml.includes('../data_predictions/manifest.json')) {
  throw new Error('Prediction dashboard manifest dependency changed unexpectedly');
}

for (const relativePath of [
  `data_predictions/${targetDate}/manifest.json`,
  `data_predictions/${targetDate}/summary.json`,
  `data_predictions/${targetDate}/group-summary.json`,
]) {
  JSON.parse(fs.readFileSync(path.join(siteRoot, relativePath), 'utf8'));
}

console.log(`Prepared selective Pages artifact: ${siteRoot}`);
console.log(`Validated target date only: ${targetDate}`);
console.log(`Published ${dependencies.length} referenced root dependencies`);
NODE
