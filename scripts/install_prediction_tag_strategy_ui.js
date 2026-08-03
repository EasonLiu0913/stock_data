#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TARGETS = Object.freeze({
  'prediction-dashboard.html': 'prediction-tag-strategy-enhancement.js?v=1',
  'prediction-replay-dashboard-view.html': 'prediction-replay-tag-strategy-enhancement.js?v=1',
});

function scriptPattern(script) {
  const base = script.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<script\\s+src=["']${base}(?:\\?[^"']*)?["']\\s*><\\/script>`, 'i');
}

function injectScript(html, script) {
  if (scriptPattern(script).test(html)) return html;
  const tag = `<script src="${script}"></script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`);
  return `${html.trimEnd()}\n${tag}\n`;
}

function install(publicDir = PUBLIC_DIR, options = {}) {
  const changed = [];
  const missing = [];
  for (const [filename, script] of Object.entries(TARGETS)) {
    const file = path.join(publicDir, filename);
    if (!fs.existsSync(file)) {
      missing.push(filename);
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    const updated = injectScript(source, script);
    if (updated === source) continue;
    changed.push(filename);
    if (!options.dryRun) fs.writeFileSync(file, updated, 'utf8');
  }
  return { changed, missing, targets: Object.keys(TARGETS) };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const result = install(PUBLIC_DIR, { dryRun });
  if (result.missing.length) throw new Error(`Missing target pages: ${result.missing.join(', ')}`);
  console.log(JSON.stringify({ ...result, dry_run: dryRun }, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  PUBLIC_DIR,
  TARGETS,
  scriptPattern,
  injectScript,
  install,
  main,
};
