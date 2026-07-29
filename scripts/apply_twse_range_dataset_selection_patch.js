#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'crawl_twse_institutional_summaries_range.js');
const TEST = path.join(ROOT, 'tests', 'crawl_twse_institutional_summaries_range.test.js');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'crawl-twse-institutional-summaries-range.yml');

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

function writeChanged(file, content) {
  const previous = fs.readFileSync(file, 'utf8');
  if (previous === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

let script = fs.readFileSync(SCRIPT, 'utf8');
script = replaceOnce(
  script,
  `const DATASETS = Object.freeze([
  { endpointId: 'TWT38U', label: '外資及陸資', crawler: foreignInvestors },
  { endpointId: 'TWT44U', label: '投信', crawler: investmentTrust },
  { endpointId: 'TWT43U', label: '自營商', crawler: dealers },
]);`,
  `const DATASETS = Object.freeze([
  { endpointId: 'TWT38U', label: '外資及陸資', crawler: foreignInvestors },
  { endpointId: 'TWT44U', label: '投信', crawler: investmentTrust },
  { endpointId: 'TWT43U', label: '自營商', crawler: dealers },
]);

function selectDatasets(value) {
  const requested = String(value || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (!requested.length) return [...DATASETS];

  const uniqueIds = [...new Set(requested)];
  return uniqueIds.map((endpointId) => {
    const dataset = DATASETS.find((item) => item.endpointId === endpointId);
    if (!dataset) {
      throw new Error(
        \`Unknown dataset \${endpointId}; expected TWT38U, TWT44U, or TWT43U\`,
      );
    }
    return dataset;
  });
}`,
  'dataset selector',
);
script = replaceOnce(
  script,
  `    '  --max-days N          Maximum inclusive range (default: 366)',`,
  `    '  --max-days N          Maximum inclusive range (default: 366)',
    '  --datasets IDS        Comma-separated endpoint IDs; omitted means all three',`,
  'usage datasets option',
);
script = replaceOnce(
  script,
  `  const maxDays = getIntegerArg(argv, '--max-days', DEFAULT_MAX_DAYS);
  randomDelay(minDelayMs, maxDelayMs);`,
  `  const maxDays = getIntegerArg(argv, '--max-days', DEFAULT_MAX_DAYS);
  const datasets = selectDatasets(getArg(argv, '--datasets'));
  randomDelay(minDelayMs, maxDelayMs);`,
  'parse selected datasets',
);
script = replaceOnce(
  script,
  `  console.log(\`📌 Calendar days: \${range.dates.length}\`);
  console.log(\`⏱️ Request delay: \${minDelayMs}-\${maxDelayMs}ms\`);`,
  `  console.log(\`📌 Calendar days: \${range.dates.length}\`);
  console.log(\`🏛️ Selected datasets: \${datasets.map((item) => \`\${item.endpointId} \${item.label}\`).join(', ')}\`);
  console.log(\`⏱️ Request delay: \${minDelayMs}-\${maxDelayMs}ms\`);`,
  'selected dataset log',
);
script = replaceOnce(
  script,
  `  const summary = await crawlRange({
    dates: range.dates,
    nonTradingDays,`,
  `  const summary = await crawlRange({
    dates: range.dates,
    nonTradingDays,
    datasets,`,
  'pass selected datasets',
);
script = replaceOnce(
  script,
  `  randomDelay,
  validateRange,
};`,
  `  randomDelay,
  selectDatasets,
  validateRange,
};`,
  'export selector',
);

let test = fs.readFileSync(TEST, 'utf8');
test = replaceOnce(
  test,
  `  randomDelay,
  validateRange,`,
  `  randomDelay,
  selectDatasets,
  validateRange,`,
  'import selector test',
);
test = replaceOnce(
  test,
  `test('range calendar remains optional when requested years are uncovered', async () => {`,
  `test('selectDatasets defaults to all and supports checkbox combinations', () => {
  assert.deepEqual(
    selectDatasets('').map((item) => item.endpointId),
    ['TWT38U', 'TWT44U', 'TWT43U'],
  );
  assert.deepEqual(
    selectDatasets('TWT44U').map((item) => item.endpointId),
    ['TWT44U'],
  );
  assert.deepEqual(
    selectDatasets('twt43u,TWT38U,TWT43U').map((item) => item.endpointId),
    ['TWT43U', 'TWT38U'],
  );
  assert.throws(
    () => selectDatasets('UNKNOWN'),
    /Unknown dataset UNKNOWN/,
  );
});

test('range calendar remains optional when requested years are uncovered', async () => {`,
  'selector tests',
);

let workflow = fs.readFileSync(WORKFLOW, 'utf8');
workflow = replaceOnce(
  workflow,
  `      end_date:
        description: '結束日期（YYYYMMDD，不可晚於台灣當日）'
        required: true
        type: string
      min_delay_ms:`,
  `      end_date:
        description: '結束日期（YYYYMMDD，不可晚於台灣當日）'
        required: true
        type: string
      foreign_investors:
        description: '抓取外資及陸資（TWT38U）；三項都不勾時預設全部抓取'
        required: false
        default: false
        type: boolean
      investment_trust:
        description: '抓取投信（TWT44U）；三項都不勾時預設全部抓取'
        required: false
        default: false
        type: boolean
      dealers:
        description: '抓取自營商（TWT43U）；三項都不勾時預設全部抓取'
        required: false
        default: false
        type: boolean
      min_delay_ms:`,
  'workflow checkbox inputs',
);
workflow = replaceOnce(
  workflow,
  `      - name: Run institutional-summary range safety tests`,
  `      - name: Resolve selected institutional datasets
        id: datasets
        shell: bash
        env:
          FOREIGN_INVESTORS: \${{ inputs.foreign_investors }}
          INVESTMENT_TRUST: \${{ inputs.investment_trust }}
          DEALERS: \${{ inputs.dealers }}
        run: |
          set -euo pipefail
          SELECTED_IDS=()
          SELECTED_LABELS=()

          if [ "$FOREIGN_INVESTORS" = "true" ]; then
            SELECTED_IDS+=("TWT38U")
            SELECTED_LABELS+=("外資及陸資")
          fi
          if [ "$INVESTMENT_TRUST" = "true" ]; then
            SELECTED_IDS+=("TWT44U")
            SELECTED_LABELS+=("投信")
          fi
          if [ "$DEALERS" = "true" ]; then
            SELECTED_IDS+=("TWT43U")
            SELECTED_LABELS+=("自營商")
          fi

          if [ "\${#SELECTED_IDS[@]}" -eq 0 ]; then
            SELECTED_IDS=("TWT38U" "TWT44U" "TWT43U")
            SELECTED_LABELS=("外資及陸資" "投信" "自營商")
            echo "selection_mode=default-all" >> "$GITHUB_OUTPUT"
            echo "No institution checkbox selected; defaulting to all three datasets."
          else
            echo "selection_mode=explicit" >> "$GITHUB_OUTPUT"
          fi

          IDS=$(IFS=,; echo "\${SELECTED_IDS[*]}")
          LABELS=$(IFS='、'; echo "\${SELECTED_LABELS[*]}")
          echo "ids=$IDS" >> "$GITHUB_OUTPUT"
          echo "labels=$LABELS" >> "$GITHUB_OUTPUT"
          echo "Selected datasets: $IDS ($LABELS)"

      - name: Run institutional-summary range safety tests`,
  'resolve dataset step',
);
workflow = replaceOnce(
  workflow,
  `          MAX_DAYS: \${{ inputs.max_days }}
          CRAWL_LOG_FILE:`,
  `          MAX_DAYS: \${{ inputs.max_days }}
          SELECTED_DATASETS: \${{ steps.datasets.outputs.ids }}
          CRAWL_LOG_FILE:`,
  'crawl selected dataset env',
);
workflow = replaceOnce(
  workflow,
  `            --retry-cooldown "$RETRY_COOLDOWN_MS" \\
            --max-days "$MAX_DAYS" \\
            2>&1 | tee "$CRAWL_LOG_FILE"`,
  `            --retry-cooldown "$RETRY_COOLDOWN_MS" \\
            --max-days "$MAX_DAYS" \\
            --datasets "$SELECTED_DATASETS" \\
            2>&1 | tee "$CRAWL_LOG_FILE"`,
  'crawl datasets argument',
);
workflow = replaceOnce(
  workflow,
  `          CRAWL_OUTCOME: \${{ steps.crawl.outcome }}
          CRAWL_LOG_FILE:`,
  `          CRAWL_OUTCOME: \${{ steps.crawl.outcome }}
          SELECTED_DATASETS: \${{ steps.datasets.outputs.ids }}
          SELECTED_LABELS: \${{ steps.datasets.outputs.labels }}
          SELECTION_MODE: \${{ steps.datasets.outputs.selection_mode }}
          CRAWL_LOG_FILE:`,
  'report selected dataset env',
);
workflow = replaceOnce(
  workflow,
  `            crawl_outcome: process.env.CRAWL_OUTCOME,
            counts,`,
  `            crawl_outcome: process.env.CRAWL_OUTCOME,
            selection_mode: process.env.SELECTION_MODE,
            selected_datasets: String(process.env.SELECTED_DATASETS || '').split(',').filter(Boolean),
            selected_labels: String(process.env.SELECTED_LABELS || '').split('、').filter(Boolean),
            counts,`,
  'report selected datasets',
);
workflow = replaceOnce(
  workflow,
  `            \`- 區間：\${report.range.start} ～ \${report.range.end}\`,
            \`- 新增：`,
  `            \`- 區間：\${report.range.start} ～ \${report.range.end}\`,
            \`- 抓取法人：\${report.selected_labels.join('、') || '未指定'}（\${report.selection_mode === 'default-all' ? '全部未勾，預設三個都抓' : '依勾選項目'}）\`,
            \`- 新增：`,
  'summary selected labels',
);
workflow = replaceOnce(
  workflow,
  `                \`- \\`start_date=\${suggestion.start_date}\\`、\\`end_date=\${suggestion.end_date}\\`（\${endpoints}）\`,`,
  `                \`- \\`start_date=\${suggestion.start_date}\\`、\\`end_date=\${suggestion.end_date}\\`，並只勾選失敗法人（\${endpoints}）\`,`,
  'rerun checkbox guidance',
);

const changed = [
  writeChanged(SCRIPT, script),
  writeChanged(TEST, test),
  writeChanged(WORKFLOW, workflow),
];
console.log(`Patched files: ${changed.filter(Boolean).length}`);
