#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXECUTION_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'fundamental-quality-execution-revalidation.json');
const PHASE3_SUMMARY_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-phase3-corrected-summary.json');
const RESEARCH_LOG_FILE = path.join(ROOT, 'docs', 'two-stage-fundamental-quality-research-log.md');
const START_MARKER = '<!-- EXECUTION_REVALIDATION_20260811_START -->';
const END_MARKER = '<!-- EXECUTION_REVALIDATION_20260811_END -->';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, payload) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
function row(payload, policyId, horizon) {
  return payload.rows.find(item => item.policy_id === policyId && item.horizon === horizon);
}
function format(value, digits = 4) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : 'N/A';
}
function buildSection(payload) {
  const signal = row(payload, 'signal_close', 'd60');
  const open5 = row(payload, 'next_open', 'd5');
  const close5 = row(payload, 'next_close', 'd5');
  const open20 = row(payload, 'next_open', 'd20');
  const close20 = row(payload, 'next_close', 'd20');
  const open60 = row(payload, 'next_open', 'd60');
  const close60 = row(payload, 'next_close', 'd60');
  const gap = payload.gap_analysis?.overall || {};
  const d60Buckets = new Map((payload.gap_analysis?.horizons?.d60 || []).map(item => [item.bucket, item]));
  const gapLe0 = d60Buckets.get('gap_le_0');
  const gap2to5 = d60Buckets.get('gap_2_5');
  return `${START_MARKER}\n## 0A. 2026-08-11 可執行進場價 Revalidation（正式取代舊 execution headline）\n\n本輪直接驗證 production V1 真正能成交的價格：**訊號日收盤 benchmark vs 隔日開盤 vs 隔日收盤**。研究窗仍為 \`202401～202606\`，universe 仍為 corrected anti-lookahead 的電子股 \`FAS >= 8 + latest-known FQ >= 10\`。\n\n### 先修正上一輪一個重要的證據解讀問題\n\nPhase 3 corrected workflow 當時採 sparse checkout，沒有 checkout 完整 TWSE MI_INDEX / legacy price sources。舊 summary 雖寫 \`eligible_events = 106\`，但 artifact 中 **D60 direct 實際只有 23 trades**；因此舊 \`D60 +26.1619% / median +17.4917% / positive 78.2609%\` 不可再解讀成 106 筆完整價格樣本。\n\n本輪使用 repository 內完整 OHLC provider 後：\n\n- corrected candidates：**${payload.coverage.candidate_events}**\n- signal / next-session OHLC 完整：**${payload.coverage.execution_price_complete_events}**（${format(payload.coverage.execution_price_coverage_pct)}%）\n- D60 實際 price-complete trades：**${signal.trades}**\n\n因此從現在開始，execution headline 改以本輪完整價格 coverage 為準。\n\n### D60：完整價格樣本結果\n\n| 執行方式 | 角色 | Trades | 平均報酬 | 中位報酬 | 正報酬率 | Median MFE | Median MAE |\n|---|---|---:|---:|---:|---:|---:|---:|\n| 訊號日收盤 | benchmark only | ${signal.trades} | ${format(signal.endpoint.average_pct)}% | ${format(signal.endpoint.median_pct)}% | ${format(signal.endpoint.positive_rate_pct)}% | ${format(signal.mfe.median_pct)}% | ${format(signal.mae.median_pct)}% |\n| 隔日開盤 | 最早可執行 | ${open60.trades} | ${format(open60.endpoint.average_pct)}% | ${format(open60.endpoint.median_pct)}% | ${format(open60.endpoint.positive_rate_pct)}% | ${format(open60.mfe.median_pct)}% | ${format(open60.mae.median_pct)}% |\n| 隔日收盤 | 可執行 | ${close60.trades} | ${format(close60.endpoint.average_pct)}% | ${format(close60.endpoint.median_pct)}% | ${format(close60.endpoint.positive_rate_pct)}% | ${format(close60.mfe.median_pct)}% | ${format(close60.mae.median_pct)}% |\n\n### Production execution 結論\n\n**正式建議：\`next_close\`（隔日收盤）**。它不是新策略，也不改 \`two_stage_fundamental_quality_direct_entry_v1\` 的 strategy ID/version；它是獨立 execution policy。\n\n主要 horizons 的 next-close 都比 next-open 有更好的中位報酬與勝率：\n\n| Horizon | Next Open median / 勝率 | Next Close median / 勝率 |\n|---|---:|---:|\n| D5 | ${format(open5.endpoint.median_pct)}% / ${format(open5.endpoint.positive_rate_pct)}% | ${format(close5.endpoint.median_pct)}% / ${format(close5.endpoint.positive_rate_pct)}% |\n| D20 | ${format(open20.endpoint.median_pct)}% / ${format(open20.endpoint.positive_rate_pct)}% | ${format(close20.endpoint.median_pct)}% / ${format(close20.endpoint.positive_rate_pct)}% |\n| D60 | ${format(open60.endpoint.median_pct)}% / ${format(open60.endpoint.positive_rate_pct)}% | ${format(close60.endpoint.median_pct)}% / ${format(close60.endpoint.positive_rate_pct)}% |\n\n### Overnight gap\n\n- 全樣本平均 gap：**${format(gap.average_gap_pct)}%**\n- 中位 gap：**${format(gap.median_gap_pct)}%**\n- \`gap > 5%\` 比例只有 **${format(gap.gap_gt_5_rate_pct)}%**，成熟樣本不足，不建立 >5% 硬 gate。\n- 但 next-open D60 有明顯梯度：\`gap <= 0\` 的 median 約 **${format(gapLe0?.endpoint?.median_pct)}%**、勝率 **${format(gapLe0?.endpoint?.positive_rate_pct)}%**；\`gap 2～5%\` 的 median 約 **${format(gap2to5?.endpoint?.median_pct)}%**、勝率 **${format(gap2to5?.endpoint?.positive_rate_pct)}%**。\n\n因此目前只把「高 gap 不宜開盤追價」保留為觀察提示，**不新增 entry gate**；production execution 直接採隔日收盤，未來等 gap-up 樣本增加後再做 OOS threshold 驗證。\n\n### 本輪狀態\n\n- next-day execution：**validated**\n- production execution policy：**\`next_close\`**\n- signal close：**只保留 benchmark，不視為使用者可成交績效**\n- strategy ID/version：**不變**\n- execution policy config：\`config/strategy-execution-policies.json\`\n- 研究輸出：\`data_prediction_analysis/quarterly-financial-quality/fundamental-quality-execution-revalidation.json\`\n\n${END_MARKER}`;
}

function updateResearchLog(payload) {
  let text = fs.readFileSync(RESEARCH_LOG_FILE, 'utf8');
  const section = buildSection(payload);
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  if (start >= 0 && end >= start) {
    text = `${text.slice(0, start)}${section}${text.slice(end + END_MARKER.length)}`;
  } else {
    const anchor = '\n## 1. 目前有效研究結論';
    const index = text.indexOf(anchor);
    if (index < 0) throw new Error('Research log anchor not found');
    text = `${text.slice(0, index)}\n${section}\n${text.slice(index)}`;
  }
  fs.writeFileSync(RESEARCH_LOG_FILE, text, 'utf8');
}

function updatePhase3Summary(payload) {
  const summary = readJson(PHASE3_SUMMARY_FILE);
  const oldD60 = summary.corrected_direct_d60 || null;
  const signal = row(payload, 'signal_close', 'd60');
  const open60 = row(payload, 'next_open', 'd60');
  const close60 = row(payload, 'next_close', 'd60');
  summary.corrected_direct_d60_legacy_sparse_price_coverage = oldD60;
  summary.corrected_direct_d60 = {
    source: 'fundamental-quality-execution-revalidation.json',
    role: 'signal_close_benchmark_only',
    trades: signal.trades,
    average_pct: signal.endpoint.average_pct,
    median_pct: signal.endpoint.median_pct,
    positive_rate_pct: signal.endpoint.positive_rate_pct,
    ge30_rate_pct: signal.endpoint.ge30_rate_pct,
  };
  summary.execution_revalidation = {
    status: 'validated',
    candidate_events: payload.coverage.candidate_events,
    execution_price_complete_events: payload.coverage.execution_price_complete_events,
    execution_price_coverage_pct: payload.coverage.execution_price_coverage_pct,
    prior_phase3_price_coverage_issue: 'The prior Phase 3 artifact reported 106 eligible events but only 23 D60 direct trades because sparse checkout omitted complete price sources; its +26.1619% headline is superseded for execution evidence.',
    next_open_d60: {
      trades: open60.trades,
      average_pct: open60.endpoint.average_pct,
      median_pct: open60.endpoint.median_pct,
      positive_rate_pct: open60.endpoint.positive_rate_pct,
    },
    next_close_d60: {
      trades: close60.trades,
      average_pct: close60.endpoint.average_pct,
      median_pct: close60.endpoint.median_pct,
      positive_rate_pct: close60.endpoint.positive_rate_pct,
    },
    production_execution_policy: 'next_close',
    production_execution_label: '隔日收盤',
    research_source: 'data_prediction_analysis/quarterly-financial-quality/fundamental-quality-execution-revalidation.json',
  };
  summary.conclusion = summary.conclusion || {};
  summary.conclusion.next_day_execution_validated = true;
  summary.conclusion.next_day_execution_note = 'Execution revalidation completed on 2026-08-11. Production recommendation is next trading day close; signal-day close is benchmark only.';
  summary.conclusion.production_execution_policy = 'next_close';
  writeJson(PHASE3_SUMMARY_FILE, summary);
}

function main() {
  const payload = readJson(EXECUTION_FILE);
  if (payload.dataset !== 'fundamental_quality_execution_revalidation') throw new Error('Unexpected execution dataset');
  updateResearchLog(payload);
  updatePhase3Summary(payload);
  console.log(JSON.stringify({
    updated: [
      path.relative(ROOT, RESEARCH_LOG_FILE),
      path.relative(ROOT, PHASE3_SUMMARY_FILE),
    ],
    recommendation: payload.production_recommendation,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error?.stack || error); process.exitCode = 1; }
}

module.exports = { buildSection, updateResearchLog, updatePhase3Summary };
