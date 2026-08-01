'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SCRIPT_TAG = '<script src="prediction-back-to-top.js"></script>';
const REPLAY_WRAPPER_PAGES = new Set([
  'prediction-replay-dashboard.html',
  'prediction-replay-dashboard-embedded.html',
]);
const SCRIPT_PATTERN = /\s*<script\s+src=["']prediction-back-to-top\.js(?:\?[^"']*)?["']\s*><\/script>/gi;

function listPredictionPages(publicDir = PUBLIC_DIR) {
  return fs.readdirSync(publicDir)
    .filter(name => /^prediction.*\.html$/i.test(name))
    .sort();
}

function injectScript(html) {
  if (html.includes('prediction-back-to-top.js')) return html;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `  ${SCRIPT_TAG}\n</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${SCRIPT_TAG}\n</html>`);
  return `${html.trimEnd()}\n${SCRIPT_TAG}\n`;
}

function removeScript(html) {
  return html.replace(SCRIPT_PATTERN, '');
}

function install(publicDir = PUBLIC_DIR, options = {}) {
  const pages = listPredictionPages(publicDir);
  const changed = [];
  const installed = [];
  const removed = [];

  for (const name of pages) {
    const file = path.join(publicDir, name);
    const source = fs.readFileSync(file, 'utf8');
    const isReplayWrapper = REPLAY_WRAPPER_PAGES.has(name);
    const updated = isReplayWrapper ? removeScript(source) : injectScript(source);
    if (updated === source) continue;
    changed.push(name);
    (isReplayWrapper ? removed : installed).push(name);
    if (!options.dryRun) fs.writeFileSync(file, updated, 'utf8');
  }

  return { pages, changed, installed, removed };
}

if (require.main === module) {
  try {
    const dryRun = process.argv.includes('--dry-run');
    const result = install(PUBLIC_DIR, { dryRun });
    console.log(JSON.stringify({
      scanned_pages: result.pages.length,
      changed_pages: result.changed.length,
      installed: result.installed,
      removed_from_wrappers: result.removed,
      dry_run: dryRun,
    }, null, 2));
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  PUBLIC_DIR,
  SCRIPT_TAG,
  REPLAY_WRAPPER_PAGES,
  listPredictionPages,
  injectScript,
  removeScript,
  install,
};
