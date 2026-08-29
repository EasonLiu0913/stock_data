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

function normalizeTrailingWhitespace(text) {
  return `${String(text).replace(/\s+$/, '')}\n`;
}

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
  // A one-vs-two newline difference at EOF is not a workflow normalization issue.
  // Keep the audit focused on the managed job content and structure.
  if (normalizeTrailingWhitespace(updated) === normalizeTrailingWhitespace(original)) return false;
  fs.writeFileSync(file, updated, 'utf8');
  return true;
}

function selfTest() {
  const tempDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'workflow-summary-migrate-'));
  const file = path.join(tempDir, 'sample.yml');
  const base = 'name: sample\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n';
  fs.writeFileSync(file, `${base.replace(/\s+$/, '')}${JOB}`, 'utf8');
  if (migrateFile(file)) throw new Error('EOF newline-only difference must not trigger migration');

  const broken = fs.readFileSync(file, 'utf8').replace('name: 排程時間摘要', 'name: wrong');
  fs.writeFileSync(file, broken, 'utf8');
  if (!migrateFile(file)) throw new Error('Managed job content drift must trigger migration');
  if (!fs.readFileSync(file, 'utf8').includes('name: 排程時間摘要')) throw new Error('Managed job was not restored');
  console.log('migrate_workflow_schedule_summary self-test passed');
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
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

module.exports = { migrateFile, MARKER, normalizeTrailingWhitespace };
