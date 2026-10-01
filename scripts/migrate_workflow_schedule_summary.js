#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const JOB_MARKER = '# schedule-timing-summary:v1';
const STEP_MARKER = '# schedule-timing-summary:v2';

const LEGACY_UNMARKED_EXCEPTIONS = new Set([
  // Frozen Round 2 / self-trigger or self-auditing workflows. Round 1 must not
  // normalize these YAML files because editing them can launch their own
  // production/research/CI workflow or expand the bounded migration scope.
  'materialize-institutional-accumulation-catalyst-outcome-association-execution.yml',
  'repair-trading-calendar-freshness.yml',
  'test-institutional-accumulation-catalyst-outcome-association-protocol.yml',
  'test-scheduled-workflow-registry.yml',
  'verify-institutional-accumulation-catalyst-outcome-association-execution.yml',
]);

const EMBEDDED_TARGETS = new Map([
  ['calculate-twse-margin-maintenance.yml', 'calculate'],
  ['crawl-twse-institutional-investors.yml', 'crawl-twse-institutional-investors'],
  ['crawl-twse-margin-balance.yml', 'crawl-twse-margin-balance'],
  ['crawl-twse-quarterly-financial-quality.yml', 'crawl'],
  ['retry-institutional.yml', 'retry-institutional'],
  ['crawl-rankings.yml', 'crawl-rankings'],
  ['crawl-market-news.yml', 'crawl'],
  ['crawl-fubon-brokers-trade.yml', 'crawl'],
  ['crawl-twse-institutional-summaries.yml', 'crawl'],
  ['crawl-cnn-fear-and-greed.yml', 'crawl'],
  ['crawl-taifex-major-institutional-traders-futures-options.yml', 'crawl-taifex-futures-options'],
  ['crawl-tpex-daily-market-data.yml', 'crawl'],
  ['analyze-daily-gainers-margin-flow-2200.yml', 'prepare-ai-facts'],
  ['publish-daily-gainers-ai-analysis.yml', 'validate-and-publish'],
  ['crawl-eia-crude-spot.yml', 'collect'],
  ['crawl-tdcc-shareholding-snapshot.yml', 'archive'],
  ['update-twse-industry.yml', 'update-twse-industry'],
  ['crawl-external-market-indicators.yml', 'crawl'],
  ['crawl-institutional.yml', 'crawl-institutional'],
  ['crawl-mops-monthly-revenue.yml', 'crawl'],
  ['crawl-pocket-00981a.yml', 'crawl-pocket-00981a'],
  ['crawl-refined-product-tightness.yml', 'collect'],
  ['crawl-taifex-major-institutional-traders-futures-contracts.yml', 'crawl-taifex-futures-contracts'],
]);

const JOB = `

  schedule-timing-summary:
    ${JOB_MARKER}
    name: 排程時間摘要
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository for schedule summary
        uses: actions/checkout@v7
        with:
          ref: \${{ github.sha }}
          fetch-depth: 1
      - name: Write schedule timing summary
        shell: bash
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node scripts/write_workflow_schedule_summary.js
`;

const STEP = `
      ${STEP_MARKER}
      - name: Write schedule timing summary
        if: always() && github.event_name == 'schedule'
        shell: bash
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node scripts/write_workflow_schedule_summary.js`;

function normalizeTrailingWhitespace(text) {
  return `${String(text).replace(/\s+$/, '')}\n`;
}

function removeManagedJob(text) {
  const jobStart = text.indexOf('\n  schedule-timing-summary:\n');
  if (jobStart < 0) return text.replace(/\s+$/, '');
  if (!text.slice(jobStart).includes(JOB_MARKER)) {
    throw new Error('schedule-timing-summary exists without managed marker');
  }
  return text.slice(0, jobStart).replace(/\s+$/, '');
}

function jobRange(text, jobName) {
  const start = text.indexOf(`\n  ${jobName}:\n`);
  if (start < 0) throw new Error(`Target job not found: ${jobName}`);
  const next = [...text.matchAll(/\n  ([A-Za-z0-9_-]+):\n/g)]
    .map((match) => ({ index: match.index, name: match[1] }))
    .filter((entry) => entry.index > start)
    .sort((a, b) => a.index - b.index)[0];
  return { start, end: next ? next.index : text.length };
}

function removeManagedStepFromBlock(block) {
  if (!block.includes(STEP_MARKER)) return block.replace(/\s+$/, '');
  const markerIndex = block.indexOf(`      ${STEP_MARKER}\n`);
  if (markerIndex < 0) throw new Error('Managed schedule summary step has unexpected indentation');
  const before = block.slice(0, markerIndex).replace(/\s+$/, '');
  return before;
}

function migrateEmbedded(original, jobName) {
  let base = removeManagedJob(original);
  const range = jobRange(base, jobName);
  let block = base.slice(range.start, range.end);
  if (!/^\s{4}steps:\s*$/m.test(block)) throw new Error(`Target job has no steps: ${jobName}`);
  block = removeManagedStepFromBlock(block);
  const updatedBlock = `${block}${STEP}\n`;
  return `${base.slice(0, range.start)}${updatedBlock}${base.slice(range.end).replace(/^\n/, '')}`
    .replace(/\s+$/, '') + '\n';
}

function migrateStandalone(original) {
  const jobStart = original.indexOf('\n  schedule-timing-summary:\n');
  let base = original.replace(/\s+$/, '');
  if (jobStart >= 0) {
    if (!original.slice(jobStart).includes(JOB_MARKER)) {
      throw new Error('schedule-timing-summary exists without managed marker');
    }
    base = original.slice(0, jobStart).replace(/\s+$/, '');
  }
  return `${base}${JOB}\n`;
}

function migrateFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  if (!/^jobs:\s*$/m.test(original)) return false;

  const name = path.basename(file);
  if (LEGACY_UNMARKED_EXCEPTIONS.has(name)) return false;
  const targetJob = EMBEDDED_TARGETS.get(name);
  const updated = targetJob
    ? migrateEmbedded(original, targetJob)
    : migrateStandalone(original);

  if (normalizeTrailingWhitespace(updated) === normalizeTrailingWhitespace(original)) return false;
  fs.writeFileSync(file, updated, 'utf8');
  return true;
}

function selfTest() {
  const os = require('node:os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-summary-migrate-'));

  const standalone = path.join(tempDir, 'legacy.yml');
  fs.writeFileSync(standalone, `name: sample\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n${JOB}`, 'utf8');
  if (migrateFile(standalone)) throw new Error('Canonical standalone job must be stable');

  const embeddedName = 'crawl-cnn-fear-and-greed.yml';
  const embedded = path.join(tempDir, embeddedName);
  fs.writeFileSync(embedded, `name: sample\n\njobs:\n  crawl:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - run: echo ok\n${JOB}`, 'utf8');
  if (!migrateFile(embedded)) throw new Error('Round 1 workflow must migrate to embedded step');
  const migrated = fs.readFileSync(embedded, 'utf8');
  if (migrated.includes('  schedule-timing-summary:')) throw new Error('Embedded workflow retained standalone summary job');
  if (!migrated.includes(STEP_MARKER)) throw new Error('Embedded workflow missing v2 marker');
  if (!migrated.includes("if: always() && github.event_name == 'schedule'")) throw new Error('Embedded workflow missing schedule-only always condition');
  if (migrateFile(embedded)) throw new Error('Canonical embedded step must be idempotent');

  const round2Name = 'crawl-tpex-daily-market-data.yml';
  const round2 = path.join(tempDir, round2Name);
  fs.writeFileSync(round2, `name: sample\n\njobs:\n  crawl:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - run: echo ok\n      ${STEP_MARKER}\n      - name: Write schedule timing summary\n        if: always() && github.event_name == 'schedule'\n        shell: bash\n        env:\n          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}\n        run: node scripts/write_workflow_schedule_summary.js\n`, 'utf8');
  if (migrateFile(round2)) throw new Error('Canonical Round 2 embedded target must be idempotent');

  fs.rmSync(tempDir, { recursive: true, force: true });
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

module.exports = {
  migrateFile,
  JOB_MARKER,
  STEP_MARKER,
  EMBEDDED_TARGETS,
  LEGACY_UNMARKED_EXCEPTIONS,
  normalizeTrailingWhitespace,
  migrateEmbedded,
  migrateStandalone,
};
