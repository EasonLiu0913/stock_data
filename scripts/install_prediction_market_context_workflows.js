#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function insertBefore(content, marker, block) {
  if (content.includes(block.trim())) return content;
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`Marker not found: ${marker}`);
  return `${content.slice(0, index)}${block}${content.slice(index)}`;
}

function replaceOne(content, pattern, replacement, label) {
  const updated = content.replace(pattern, replacement);
  if (updated === content) throw new Error(`Unable to patch ${label}`);
  return updated;
}

function patchDailyPrediction() {
  const file = '.github/workflows/daily-stock-prediction.yml';
  let content = read(file);

  const captureBlock = `      - name: Capture prediction-time night and external market context
        id: market_context
        if: steps.dates.outputs.run == 'true' || inputs.force_environment == true
        run: |
          node scripts/capture_prediction_market_context.js \\
            --forecast-date "$FORECAST_TARGET_DATE" \\
            --base-date "$FORECAST_BASE_DATE"

`;
  content = insertBefore(content, '      - name: Generate or reuse market environment snapshot\n', captureBlock);

  const environmentBlock = `      - name: Generate or reuse market environment snapshot
        shell: bash
        env:
          FORCE_ENVIRONMENT: \${{ inputs.force_environment }}
        run: |
          set -euo pipefail
          if [ "\${{ steps.dates.outputs.run }}" = "true" ] || [ "$FORCE_ENVIRONMENT" = "true" ]; then
            node scripts/run_prediction_market_environment.js \\
              --forecast-date "$FORECAST_TARGET_DATE" \\
              --base-date "$FORECAST_BASE_DATE"
          else
            node scripts/generate_market_environment.js \\
              --forecast-date "$FORECAST_TARGET_DATE" \\
              --base-date "$FORECAST_BASE_DATE" \\
              --strict
          fi

`;
  content = replaceOne(
    content,
    /      - name: Generate or reuse market environment snapshot\n[\s\S]*?(?=      - name: Verify immutable market environment snapshot\n)/,
    environmentBlock,
    'daily market environment step',
  );

  const readinessBlock = `      - name: Apply immutable prediction-time market context to readiness
        if: always() && steps.dates.outputs.target_date != ''
        run: node scripts/apply_prediction_context_to_readiness.js --date "\${{ steps.dates.outputs.target_date }}"

`;
  content = insertBefore(content, '      - name: Attach environment snapshot to V1 outputs\n', readinessBlock);

  if (!content.includes('tests/prediction_market_context.test.js')) {
    content = content.replace(
      '            tests/oversold_electronics_strategy.test.js',
      '            tests/oversold_electronics_strategy.test.js \\\n            tests/prediction_market_context.test.js',
    );
  }
  content = content.replace(
    'git add data_normalized data_market_risk data_market_environment data_predictions data_prediction_ui public/index.html public/prediction-version-dashboard.html public/prediction-dashboard.html',
    'git add data_normalized data_market_risk data_market_environment data_prediction_context data_predictions data_prediction_ui public/index.html public/prediction-version-dashboard.html public/prediction-dashboard.html',
  );
  write(file, content);
}

function patchStrategyRegistry() {
  const file = '.github/workflows/apply-strategy-tag-registry.yml';
  let content = read(file);
  content = content.replace(
    /      - name: Refresh official disposition and TX night snapshot\n[\s\S]*?(?=      - name: Apply fixed tag and strategy registry\n)/,
    `      - name: Reapply immutable prediction-time market context
        run: node scripts/apply_prediction_context_to_readiness.js --date "$TARGET_DATE"
`,
  );
  if (!content.includes('node --check scripts/apply_prediction_context_to_readiness.js')) {
    content = content.replace(
      /          node --check scripts\/backfill_prediction_dashboard_fields\.js\n/g,
      '          node --check scripts/backfill_prediction_dashboard_fields.js\n          node --check scripts/apply_prediction_context_to_readiness.js\n',
    );
  }
  content = content.replace(
    `      - name: Commit official constraints, snapshot, and enriched prediction summary`,
    `      - name: Commit strategy snapshot and prediction-time context`,
  );
  content = content.replace(
    `          git add \\
            data_market_constraints \\
            data_market_environment \\
            data_predictions \\
            data_prediction_analysis`,
    `          git add \\
            data_market_environment \\
            data_prediction_context \\
            data_predictions \\
            data_predictions_v2 \\
            data_prediction_analysis`,
  );
  content = content.replace(
    `echo 'No official constraint, tag, strategy snapshot, or dashboard group changes'`,
    `echo 'No prediction context, tag, strategy snapshot, or dashboard group changes'`,
  );
  content = content.replace(
    `git commit -m "data: refresh official constraints and apply strategy snapshot \${TARGET_DATE}"`,
    `git commit -m "data: apply prediction context and strategy snapshot \${TARGET_DATE}"`,
  );
  write(file, content);
}

function patchExternalMarketWorkflow() {
  const file = '.github/workflows/crawl-external-market-indicators.yml';
  let content = read(file);
  content = replaceOne(
    content,
    /  schedule:\n(?:    - cron: '[^']+'\n){4}/,
    `  schedule:
    # 台灣時間週二至週六 05:10、05:40、06:10、06:40；紐約 17:00 gate 會自動處理夏冬令時間。
    - cron: '10 21 * * 1-5'
    - cron: '40 21 * * 1-5'
    - cron: '10 22 * * 1-5'
    - cron: '40 22 * * 1-5'
`,
    'external market schedules',
  );
  const finalizeBlock = `      - name: Preserve final external market context for matching predictions
        if: steps.validate.outputs.ready == 'true'
        run: |
          node scripts/finalize_prediction_market_context.js \\
            --external-market-date "\${{ steps.validate.outputs.actual_date }}" \\
            --external-file "\${{ steps.crawl.outputs.output_file }}"

`;
  content = insertBefore(content, '      - name: Run market environment tests\n', finalizeBlock);
  content = content.replace(
    'git add config/external_market_indicators.json config/stock_news_aliases.json data_external_market/ data_market_risk/',
    'git add config/external_market_indicators.json config/stock_news_aliases.json data_external_market/ data_market_risk/ data_prediction_context/',
  );
  write(file, content);
}

const NIGHT_WORKFLOW = `name: "[03 晨間補充] 台指期夜盤收盤定稿"

on:
  schedule:
    # GitHub cron 使用 UTC；對應台灣時間週二至週六 05:10、07:10、07:40。
    - cron: '10 21 * * 0-4'
    - cron: '10 23 * * 0-4'
    - cron: '40 23 * * 0-4'
  workflow_dispatch:
    inputs:
      target_date:
        description: '預測交易日 YYYYMMDD；留空使用最新預測市場快照日期'
        required: false
        type: string
      phase:
        description: 'realtime_close 保存 05:00 最後即時快照；official_final 保存官方盤後日報'
        required: true
        type: choice
        default: official_final
        options:
          - realtime_close
          - official_final
      force:
        description: '重新抓取官方資料'
        required: false
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: official-night-futures-finalization
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Resolve target prediction date and phase
        id: target
        shell: bash
        env:
          INPUT_DATE: \${{ github.event_name == 'workflow_dispatch' && inputs.target_date || '' }}
          INPUT_PHASE: \${{ github.event_name == 'workflow_dispatch' && inputs.phase || '' }}
          EVENT_SCHEDULE: \${{ github.event.schedule || '' }}
        run: |
          set -euo pipefail
          if [ -n "\${INPUT_DATE:-}" ]; then
            date="\${INPUT_DATE//[^0-9]/}"
          else
            date=$(node -e "const d=require('./scripts/finalize_prediction_market_context').predictionDates();process.stdout.write(d.at(-1)||'')")
          fi
          [[ "$date" =~ ^20[0-9]{6}$ ]] || { echo "No prediction market context date is available"; exit 1; }
          if [ -n "\${INPUT_PHASE:-}" ]; then
            phase="$INPUT_PHASE"
          elif [ "\${EVENT_SCHEDULE:-}" = "10 21 * * 0-4" ]; then
            phase="realtime_close"
          else
            phase="official_final"
          fi
          echo "TARGET_DATE=$date" >> "$GITHUB_ENV"
          echo "PHASE=$phase" >> "$GITHUB_ENV"
          echo "date=$date" >> "$GITHUB_OUTPUT"
          echo "phase=$phase" >> "$GITHUB_OUTPUT"

      - name: Validate market-context scripts
        run: |
          node --check scripts/taifex_realtime_night_futures.js
          node --check scripts/finalize_prediction_market_context.js
          node --test tests/prediction_market_context.test.js

      - name: Capture the 05:00 realtime close snapshot
        if: steps.target.outputs.phase == 'realtime_close'
        run: |
          node scripts/taifex_realtime_night_futures.js \\
            --forecast-date "$TARGET_DATE" \\
            --session-status closed_realtime \\
            --output /tmp/night-futures-realtime-close.json
          node scripts/finalize_prediction_market_context.js \\
            --forecast-date "$TARGET_DATE" \\
            --night-kind realtime_close \\
            --night-file /tmp/night-futures-realtime-close.json

      - name: Fetch official disposition and night daily report
        if: steps.target.outputs.phase == 'official_final'
        shell: bash
        env:
          FORCE: \${{ github.event_name == 'workflow_dispatch' && inputs.force || false }}
        run: |
          set -euo pipefail
          args=(--date "$TARGET_DATE" --allow-partial --force)
          node scripts/fetch_official_market_constraints.js "\${args[@]}"
          node scripts/finalize_prediction_market_context.js \\
            --forecast-date "$TARGET_DATE" \\
            --night-kind official \\
            --night-file "data_market_constraints/$TARGET_DATE/night-futures.json"

      - name: Commit final market context without rewriting prediction snapshot
        shell: bash
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data_market_constraints data_prediction_context
          if git diff --cached --quiet; then
            echo "No final night market context changes"
            exit 0
          fi
          git commit -m "data: finalize $TARGET_DATE night market context ($PHASE)"
          for attempt in 1 2 3 4 5; do
            if git pull --rebase origin main && git push origin HEAD:main; then exit 0; fi
            git rebase --abort 2>/dev/null || true
            sleep $((attempt * 5))
          done
          exit 1

      - name: Write workflow summary
        if: always()
        run: |
          echo "## 台指期夜盤收盤定稿" >> "$GITHUB_STEP_SUMMARY"
          echo "- 預測交易日：\${TARGET_DATE:-N/A}" >> "$GITHUB_STEP_SUMMARY"
          echo "- 階段：\${PHASE:-N/A}" >> "$GITHUB_STEP_SUMMARY"
          echo "- 原始預測快照：不覆寫" >> "$GITHUB_STEP_SUMMARY"
`;

function replaceNightWorkflow() {
  write('.github/workflows/update-official-market-constraints.yml', NIGHT_WORKFLOW);
}

function cleanupDiagnosticWorkflow() {
  fs.rmSync(path.join(ROOT, '.github/workflows/test-current-taifex-night-snapshot.yml'), { force: true });
}

function main() {
  patchDailyPrediction();
  patchStrategyRegistry();
  patchExternalMarketWorkflow();
  replaceNightWorkflow();
  cleanupDiagnosticWorkflow();
  console.log(JSON.stringify({
    updated: [
      '.github/workflows/daily-stock-prediction.yml',
      '.github/workflows/apply-strategy-tag-registry.yml',
      '.github/workflows/crawl-external-market-indicators.yml',
      '.github/workflows/update-official-market-constraints.yml',
    ],
    removed: ['.github/workflows/test-current-taifex-night-snapshot.yml'],
  }));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  insertBefore,
  replaceOne,
  patchDailyPrediction,
  patchStrategyRegistry,
  patchExternalMarketWorkflow,
  replaceNightWorkflow,
  main,
};
