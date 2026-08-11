#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const EXECUTION = path.join(ROOT, 'data_prediction_analysis/quarterly-financial-quality/fundamental-quality-execution-revalidation.json');
const LOG = path.join(ROOT, 'docs/two-stage-fundamental-quality-research-log.md');
const PHASE1 = path.join(ROOT, 'docs/research/fundamental-events/phase-1-shadow-timeline.md');
const LEGACY_POLICY = path.join(ROOT, 'data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-entry-policy.json');

function main() {
  const p = JSON.parse(fs.readFileSync(EXECUTION, 'utf8'));
  const signal = p.rows.find(r => r.policy_id === 'signal_close' && r.horizon === 'd60');
  const nextOpen = p.rows.find(r => r.policy_id === 'next_open' && r.horizon === 'd60');
  const nextClose = p.rows.find(r => r.policy_id === 'next_close' && r.horizon === 'd60');
  let text = fs.readFileSync(LOG, 'utf8');
  const start = text.indexOf('## 1. 目前有效研究結論');
  const end = text.indexOf('## 2. Production V1 訊號顯示規則');
  if (start < 0 || end <= start) throw new Error('Cannot locate current-conclusion section');
  const replacement = `## 1. 目前有效研究結論\n\n截至 2026-08-11，正式證據以 corrected anti-lookahead + 完整價格 coverage 為準：\n\n1. **\`FAS >= 8 + FQ >= 10\` 仍值得保留為基本面選股訊號。**\n2. corrected candidates：**${p.coverage.candidate_events} 筆**；signal / next-session OHLC 完整 **${p.coverage.execution_price_complete_events} 筆**；D60 三種 execution 皆有 **${signal.trades} 筆實際 trades**。\n3. 訊號日收盤只作 benchmark：D60 平均 **${signal.endpoint.average_pct}%**、中位 **${signal.endpoint.median_pct}%**、正報酬率 **${signal.endpoint.positive_rate_pct}%**。\n4. 真實可執行價格中，**隔日收盤（\`next_close\`）正式優先於隔日開盤（\`next_open\`）**：D60 平均 **${nextClose.endpoint.average_pct}%**、中位 **${nextClose.endpoint.median_pct}%**、正報酬率 **${nextClose.endpoint.positive_rate_pct}%**；隔日開盤則為平均 **${nextOpen.endpoint.average_pct}%**、中位 **${nextOpen.endpoint.median_pct}%**、正報酬率 **${nextOpen.endpoint.positive_rate_pct}%**。\n5. D5 / D20 / D60 的中位報酬與勝率皆由 next-close 勝過 next-open，因此 production execution policy 定為 **\`next_close\`**。\n6. overnight gap 有梯度：開盤 gap 越高，next-open 後續報酬有轉弱跡象；但 \`gap > 5%\` 成熟樣本不足，**不建立硬性 gap gate**。\n7. 舊 Phase 3 的 \`+26.1619%\`、以及同批 pullback headline，來自 sparse checkout 下只有 23 筆 D60 direct price-complete trades；**不再作目前 production execution 證據**。若要重啟 pullback 研究，必須用完整價格 coverage 重跑。\n8. event-driven FQ historical coverage 仍不足，因此 **FQ production migration 維持不切換**；這與 execution policy 是兩個獨立議題。\n\n### Execution 已完成驗證\n\nproduction V1 在訊號日收盤後才產生，因此訊號日收盤價不可視為使用者可成交價。本輪已完成 next-day execution revalidation：\n\n- 訊號日：策略訊號形成日\n- 可執行日：下一交易日\n- production execution：**下一交易日收盤（\`next_close\`）**\n- \`signal_close\`：benchmark only\n\nExecution policy 獨立存於 \`config/strategy-execution-policies.json\`，不修改策略 ID / version。\n\n---\n\n`;
  text = text.slice(0, start) + replacement + text.slice(end);
  text = text.replaceAll('基本面雙確認－訊號日直接進場', '財報品質訊號');
  text = text.replaceAll('訊號日直接進場', '財報品質訊號');
  fs.writeFileSync(LOG, text, 'utf8');

  for (const file of [PHASE1, LEGACY_POLICY]) {
    if (!fs.existsSync(file)) continue;
    let value = fs.readFileSync(file, 'utf8');
    value = value.replaceAll('基本面雙確認－訊號日直接進場', '財報品質訊號');
    value = value.replaceAll('訊號日直接進場', '財報品質訊號');
    fs.writeFileSync(file, value, 'utf8');
  }
  console.log(JSON.stringify({ updated: [LOG, PHASE1, LEGACY_POLICY].map(f => path.relative(ROOT, f)) }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
