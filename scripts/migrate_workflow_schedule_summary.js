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
      - name: Write schedule timing summary
        shell: bash
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          curl -fsSL https://raw.githubusercontent.com/EasonLiu0913/stock_data/main/scripts/write_workflow_schedule_summary.js | node
`;

function migrateFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  if (!/^jobs:\s*$/m.test(original)) return false;

  const jobStart = original.indexOf('\n  schedule-timing-summary:\n');
  let base = original.replace(/\s+$/, '');
  if (jobStart >= 0) {
    if (!original.slice(jobStart).includes(MARKER)) {
      throw new Error(`schedule-timing-summary exists without managed marker: ${file}`);
    }
    const afterManagedJob = original.slice(jobStart).replace(/^\n/, '');
    if (!afterManagedJob.startsWith('  schedule-timing-summary:')) {
      throw new Error(`Unexpected managed summary location: ${file}`);
    }
    base = original.slice(0, jobStart).replace(/\s+$/, '');
  }

  const updated = `${base}${JOB}\n`;
  if (updated === original) return false;
  fs.writeFileSync(file, updated, 'utf8');
  return true;
}

function main() {
  const files = fs.readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  const changed = [];
  const unchanged = [];
  for (const name of files) {
    const file = path.join(WORKFLOW_DIR, name);
    if (migrateFile(file)) changed.push(name);
    else unchanged.push(name);
  }
  console.log(JSON.stringify({
    workflow_count: files.length,
    changed_count: changed.length,
    unchanged_count: unchanged.length,
    changed,
    unchanged,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { migrateFile, MARKER };
