#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const MARKER = '# schedule-timing-summary:v1';

const JOB = `

  schedule-timing-summary:
    ${MARKER}
    name: 排程時間摘要
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository for schedule summary
        uses: actions/checkout@v7
        with:
          fetch-depth: 1
      - name: Write schedule timing summary
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node scripts/write_workflow_schedule_summary.js
`;

function migrateFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  if (original.includes(MARKER)) return false;
  if (!/^jobs:\s*$/m.test(original)) return false;
  const updated = `${original.replace(/\s+$/, '')}${JOB}\n`;
  fs.writeFileSync(file, updated, 'utf8');
  return true;
}

function main() {
  const files = fs.readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  const changed = [];
  const skipped = [];
  for (const name of files) {
    const file = path.join(WORKFLOW_DIR, name);
    if (migrateFile(file)) changed.push(name);
    else skipped.push(name);
  }
  console.log(JSON.stringify({
    workflow_count: files.length,
    changed_count: changed.length,
    skipped_count: skipped.length,
    changed,
    skipped,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { migrateFile, MARKER };
