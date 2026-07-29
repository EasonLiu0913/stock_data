#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RANGE_SCRIPT = path.join(ROOT, 'scripts', 'crawl_twse_institutional_summaries_range.js');
const RANGE_TEST = path.join(ROOT, 'tests', 'crawl_twse_institutional_summaries_range.test.js');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'crawl-twse-institutional-summaries-range.yml');

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

function replaceSection(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Missing patch section: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function writeChanged(file, content) {
  const previous = fs.readFileSync(file, 'utf8');
  if (previous === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

let script = fs.readFileSync(RANGE_SCRIPT, 'utf8');

script = replaceOnce(
  script,
  "'use strict';\n\nconst {",
  "'use strict';\n\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst {",
  'range script imports',
);

script = replaceOnce(
  script,
  "    skippedNonTradingDates: 0,\n    networkRequests: 0,",
  "    skippedNonTradingDates: 0,\n    skippedDates: [],\n    networkRequests: 0,",
  'skipped date collection',
);

script = replaceOnce(
  script,
  "      summary.skippedNonTradingDates += 1;\n      logger.log(`⏭️ Skip ${targetDate}: weekend or configured non-trading day`);",
  "      summary.skippedNonTradingDates += 1;\n      summary.skippedDates.push(targetDate);\n      logger.log(`⏭️ Skip ${targetDate}: weekend or configured non-trading day`);",
  'record skipped dates',
);

const reportHelpers = [
  'function buildReport({ range, summary, settings = {} }) {',
  '  const failuresByDate = new Map();',
  '  for (const failure of summary.failures) {',
  '    const entries = failuresByDate.get(failure.targetDate) || [];',
  '    entries.push({',
  '      endpointId: failure.endpointId,',
  '      label: failure.label,',
  '      message: failure.message,',
  '    });',
  '    failuresByDate.set(failure.targetDate, entries);',
  '  }',
  '  const failedDates = [...failuresByDate.keys()].sort();',
  '',
  '  return {',
  '    schemaVersion: 1,',
  '    generated_at: new Date().toISOString(),',
  '    range: {',
  '      start: range.start,',
  '      end: range.end,',
  '      calendar_days: range.dates.length,',
  '    },',
  '    settings,',
  '    counts: {',
  '      created: summary.created,',
  '      existing: summary.existing,',
  '      skipped_non_trading_dates: summary.skippedNonTradingDates,',
  '      network_requests: summary.networkRequests,',
  '      failed: summary.failures.length,',
  '    },',
  '    skipped_non_trading_dates: [...(summary.skippedDates || [])],',
  '    failed_dates: failedDates,',
  '    failures: summary.failures.map((failure) => ({ ...failure })),',
  '    rerun_suggestions: failedDates.map((date) => ({',
  '      start_date: date,',
  '      end_date: date,',
  '      failed_endpoints: failuresByDate.get(date),',
  '    })),',
  '  };',
  '}',
  '',
  'function writeReport(file, report) {',
  '  if (!file) return null;',
  '  const outputPath = path.resolve(process.cwd(), file);',
  '  fs.mkdirSync(path.dirname(outputPath), { recursive: true });',
  "  const temporaryFile = outputPath + '.tmp-' + process.pid;",
  '  try {',
  "    fs.writeFileSync(temporaryFile, JSON.stringify(report, null, 2) + '\\n', 'utf8');",
  '    fs.renameSync(temporaryFile, outputPath);',
  '  } finally {',
  '    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);',
  '  }',
  '  return outputPath;',
  '}',
  '',
  'function usage() {',
].join('\n');

script = replaceOnce(script, 'function usage() {', reportHelpers, 'report helpers');

script = replaceOnce(
  script,
  "    '  --max-days N          Maximum inclusive range (default: 366)',",
  "    '  --max-days N          Maximum inclusive range (default: 366)',\n    '  --report-file FILE      Write a JSON execution report before exiting',",
  'usage report option',
);

script = replaceOnce(
  script,
  "  const maxDays = getIntegerArg(argv, '--max-days', DEFAULT_MAX_DAYS);\n  randomDelay(minDelayMs, maxDelayMs);",
  "  const maxDays = getIntegerArg(argv, '--max-days', DEFAULT_MAX_DAYS);\n  const reportFile = getArg(argv, '--report-file');\n  randomDelay(minDelayMs, maxDelayMs);",
  'report argument',
);

const mainTail = [
  "  console.log('✅ Range crawl finished');",
  '  console.log(',
  "    'Created=' + summary.created + ', Existing=' + summary.existing",
  "    + ', SkippedDates=' + summary.skippedNonTradingDates",
  "    + ', Requests=' + summary.networkRequests",
  "    + ', Failed=' + summary.failures.length,",
  '  );',
  '',
  '  const report = buildReport({',
  '    range,',
  '    summary,',
  '    settings: {',
  '      min_delay_ms: minDelayMs,',
  '      max_delay_ms: maxDelayMs,',
  '      max_retries: maxRetries,',
  '      retry_cooldown_ms: retryCooldownMs,',
  '      max_days: maxDays,',
  '    },',
  '  });',
  '  const reportPath = writeReport(reportFile, report);',
  "  if (reportPath) console.log('🧾 Range report: ' + reportPath);",
  '',
  '  if (summary.failures.length) {',
  '    const details = summary.failures.map((failure) => (',
  "      failure.targetDate + '/' + failure.endpointId + ': ' + failure.message",
  "    )).join('; ');",
  '    throw new Error(',
  "      'Range crawl completed with ' + summary.failures.length",
  "      + ' failure(s): ' + details,",
  '    );',
  '  }',
].join('\n');

script = replaceSection(
  script,
  "  console.log('✅ Range crawl finished');",
  '\n}\n\nif (require.main === module)',
  mainTail,
  'main report output',
);

script = replaceOnce(
  script,
  "module.exports = {\n  DATASETS,\n  crawlRange,",
  "module.exports = {\n  DATASETS,\n  buildReport,\n  crawlRange,",
  'export buildReport',
);

script = replaceOnce(
  script,
  "  randomDelay,\n  validateRange,\n};",
  "  randomDelay,\n  validateRange,\n  writeReport,\n};",
  'export writeReport',
);

let test = fs.readFileSync(RANGE_TEST, 'utf8');

test = replaceOnce(
  test,
  "const {\n  crawlRange,",
  "const {\n  buildReport,\n  crawlRange,",
  'test import buildReport',
);

const reportTest = [
  "test('buildReport exposes failed dates and precise rerun suggestions', () => {",
  '  const report = buildReport({',
  '    range: {',
  "      start: '20260721',",
  "      end: '20260722',",
  "      dates: ['20260721', '20260722'],",
  '    },',
  '    summary: {',
  '      created: 2,',
  '      existing: 3,',
  '      skippedNonTradingDates: 1,',
  "      skippedDates: ['20260722'],",
  '      networkRequests: 4,',
  '      failures: [{',
  "        targetDate: '20260721',",
  "        endpointId: 'TWT44U',",
  "        label: '投信',",
  "        message: 'simulated failure',",
  '      }],',
  '    },',
  '    settings: { max_retries: 3 },',
  '  });',
  '',
  "  assert.deepEqual(report.failed_dates, ['20260721']);",
  "  assert.deepEqual(report.skipped_non_trading_dates, ['20260722']);",
  '  assert.deepEqual(report.rerun_suggestions, [{',
  "    start_date: '20260721',",
  "    end_date: '20260721',",
  '    failed_endpoints: [{',
  "      endpointId: 'TWT44U',",
  "      label: '投信',",
  "      message: 'simulated failure',",
  '    }],',
  '  }]);',
  '});',
  '',
  "test('beforeFetch runs for a missing file but not for a valid existing file', async () => {",
].join('\n');

test = replaceOnce(
  test,
  "test('beforeFetch runs for a missing file but not for a valid existing file', async () => {",
  reportTest,
  'report test',
);

let workflow = fs.readFileSync(WORKFLOW, 'utf8');

workflow = replaceOnce(
  workflow,
  '            --retry-cooldown "$RETRY_COOLDOWN_MS" \\\n            --max-days "$MAX_DAYS"',
  '            --retry-cooldown "$RETRY_COOLDOWN_MS" \\\n            --max-days "$MAX_DAYS" \\\n            --report-file "${{ runner.temp }}/twse-institutional-range-report.json"',
  'workflow report argument',
);

const reportSteps = [
  '      - name: Publish range crawl report',
  "        if: always() && steps.tests.outcome == 'success'",
  '        shell: bash',
  '        env:',
  '          REPORT_FILE: ${{ runner.temp }}/twse-institutional-range-report.json',
  '        run: |',
  '          if [ ! -s "$REPORT_FILE" ]; then',
  '            echo "### TWSE 三大法人區間爬取報告" >> "$GITHUB_STEP_SUMMARY"',
  '            echo "未產生報告檔，請查看爬蟲步驟的輸入驗證或啟動錯誤。" >> "$GITHUB_STEP_SUMMARY"',
  '            exit 0',
  '          fi',
  "          node <<'NODE'",
  "          const fs = require('node:fs');",
  "          const report = JSON.parse(fs.readFileSync(process.env.REPORT_FILE, 'utf8'));",
  "          const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\\\|').replace(/\\r?\\n/g, ' ');",
  '          const lines = [',
  "            '### TWSE 三大法人區間爬取報告',",
  "            '',",
  "            '- 區間：' + report.range.start + ' ～ ' + report.range.end,",
  "            '- 新增：' + report.counts.created + ' 份；既有：' + report.counts.existing + ' 份；失敗：' + report.counts.failed + ' 份',",
  "            '- 跳過非交易日：' + report.counts.skipped_non_trading_dates + ' 天；實際請求：' + report.counts.network_requests + ' 次',",
  "            '',",
  '          ];',
  '          if (report.failures.length) {',
  "            lines.push('| 失敗日期 | 端點 | 法人 | 原因 |');",
  "            lines.push('|---|---|---|---|');",
  '            for (const failure of report.failures) {',
  "              lines.push('| ' + escapeCell(failure.targetDate) + ' | ' + escapeCell(failure.endpointId) + ' | ' + escapeCell(failure.label) + ' | ' + escapeCell(failure.message) + ' |');",
  '            }',
  "            lines.push('', '#### 建議重跑');",
  '            for (const suggestion of report.rerun_suggestions) {',
  "              const endpoints = suggestion.failed_endpoints.map((item) => item.endpointId + ' ' + item.label).join('、');",
  "              lines.push('- `start_date=' + suggestion.start_date + '`、`end_date=' + suggestion.end_date + '`（' + endpoints + '）');",
  '            }',
  '          } else {',
  "            lines.push('✅ 沒有失敗日期，不需要重跑。');",
  '          }',
  "          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\\n') + '\\n');",
  '          NODE',
  '',
  '      - name: Upload range crawl report',
  "        if: always() && steps.tests.outcome == 'success'",
  '        uses: actions/upload-artifact@v4',
  '        with:',
  '          name: twse-institutional-range-report-${{ inputs.start_date }}-${{ inputs.end_date }}',
  '          path: ${{ runner.temp }}/twse-institutional-range-report.json',
  '          if-no-files-found: warn',
  '          retention-days: 30',
  '',
  '      - name: Generate institutional-summary files.json only',
].join('\n');

workflow = replaceOnce(
  workflow,
  '      - name: Generate institutional-summary files.json only',
  reportSteps,
  'workflow summary and artifact steps',
);

const failureStep = [
  '      - name: Report range crawl failure',
  "        if: always() && steps.crawl.outcome == 'failure'",
  '        shell: bash',
  '        env:',
  '          REPORT_FILE: ${{ runner.temp }}/twse-institutional-range-report.json',
  '        run: |',
  '          echo "One or more downloads failed. Valid completed files were committed."',
  '          if [ -s "$REPORT_FILE" ]; then',
  "            node <<'NODE'",
  "            const fs = require('node:fs');",
  "            const report = JSON.parse(fs.readFileSync(process.env.REPORT_FILE, 'utf8'));",
  "            console.error('Failed downloads:');",
  '            for (const failure of report.failures) {',
  "              console.error('- ' + failure.targetDate + ' ' + failure.endpointId + ' ' + failure.label + ': ' + failure.message);",
  '            }',
  "            console.error('Suggested reruns:');",
  '            for (const suggestion of report.rerun_suggestions) {',
  "              const endpoints = suggestion.failed_endpoints.map((item) => item.endpointId + ' ' + item.label).join(', ');",
  "              console.error('- start_date=' + suggestion.start_date + ', end_date=' + suggestion.end_date + ' (' + endpoints + ')');",
  '            }',
  '            NODE',
  '          else',
  '            echo "Range report was not generated; inspect the crawl step for the fatal error."',
  '          fi',
  '          exit 1',
].join('\n');

workflow = replaceOnce(
  workflow,
  [
    '      - name: Report range crawl failure',
    "        if: always() && steps.crawl.outcome == 'failure'",
    '        run: |',
    '          echo "One or more downloads failed. Valid completed files were committed."',
    '          exit 1',
  ].join('\n'),
  failureStep,
  'workflow detailed failure step',
);

const changed = [
  writeChanged(RANGE_SCRIPT, script),
  writeChanged(RANGE_TEST, test),
  writeChanged(WORKFLOW, workflow),
].some(Boolean);

console.log(changed ? 'TWSE range report patch applied.' : 'No patch changes were needed.');
