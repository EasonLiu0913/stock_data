#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_ROOTS = [path.join(ROOT, 'scripts'), path.join(ROOT, '.github', 'workflows')];
const ALLOWED = new Set([
  'scripts/generate_public_index.js',
  // Temporary compatibility exception: this script may rewrite only const predictions = [...].
  'scripts/generate_all_stock_predictions.js',
]);
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function suspiciousReasons(source) {
  const reasons = [];
  const mentionsIndex = /public[\\/]index\.html|INDEX_FILE|indexPath\s*=\s*['"]public[\\/]index\.html['"]/.test(source);
  if (!mentionsIndex) return reasons;

  if (/const\s+tools\s*=\s*\[/.test(source)) reasons.push('constructs a const tools array');
  if (/file:\s*['"][^'"]+\.html['"]/.test(source) && /replace|writeFile|appendFile|inject/i.test(source)) {
    reasons.push('contains HTML tool-entry literals together with index mutation logic');
  }
  if (/eps-valuation-lab\.html/.test(source) && /replace\s*\(/.test(source)) {
    reasons.push('contains legacy EPS targeted homepage replacement');
  }
  return reasons;
}

function validate() {
  const violations = [];
  for (const file of SEARCH_ROOTS.flatMap((root) => walk(root))) {
    const rel = relative(file);
    if (ALLOWED.has(rel)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const reasons = suspiciousReasons(source);
    if (reasons.length) violations.push({ file: rel, reasons });
  }

  if (violations.length) {
    const detail = violations
      .map(({ file, reasons }) => `${file}: ${reasons.join('; ')}`)
      .join('\n');
    throw new Error(
      `Detected non-canonical public/index.html tool writer(s):\n${detail}\n` +
      'Register homepage-visible pages in config/public-page-registry.json and regenerate with scripts/generate_public_index.js.'
    );
  }
  return { ok: true, scanned_roots: SEARCH_ROOTS.map(relative), allowed_direct_writers: [...ALLOWED] };
}

function main() {
  console.log(JSON.stringify(validate(), null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { suspiciousReasons, validate };
