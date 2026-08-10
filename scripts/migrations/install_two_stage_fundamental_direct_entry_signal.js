#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateRegistry } = require('../../scripts/strategy_tag_engine');

const ROOT = path.resolve(__dirname, '../..');
const APPLY_FILE = path.join(ROOT, 'scripts', 'apply_strategy_tag_registry.js');
const REGISTRY_FILE = path.join(ROOT, 'config', 'strategy-tag-registry.json');
const RESEARCH_LOG = path.join(ROOT, 'docs', 'two-stage-fundamental-quality-research-log.md');

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Migration anchor missing: ${label}`);
  return source.replace(needle, replacement);
}

function installApplyHook() {
  let source = fs.readFileSync(APPLY_FILE, 'utf8');
  if (!source.includes("require('./two_stage_fundamental_quality_signal')")) {
    source = replaceOnce(
      source,
      "const { enrichStrategyTagSources } = require('./strategy_tag_source_enrichment');\n",
      "const { enrichStrategyTagSources } = require('./strategy_tag_source_enrichment');\nconst {\n  evaluateTwoStageFundamentalSignalDay,\n} = require('./two_stage_fundamental_quality_signal');\n",
      'two-stage import',
    );
  }

  if (!source.includes('function enrichTwoStageFundamentalFeatures(')) {
    const helper = `function enrichTwoStageFundamentalFeatures(payload, workspaceRoot) {\n  const baseTradeDate = compactDate(payload?.base_trade_date);\n  let availableStockCount = 0;\n  let unavailableStockCount = 0;\n  let signalStockCount = 0;\n  const sourceFiles = new Set();\n\n  payload.stocks = (payload.stocks || []).map(stock => {\n    const result = evaluateTwoStageFundamentalSignalDay({\n      workspaceRoot,\n      stockId: stock.stock_code,\n      baseTradeDate,\n    });\n    for (const file of result.source_files || []) sourceFiles.add(file);\n    if (result.available) availableStockCount += 1;\n    else unavailableStockCount += 1;\n    if (result.is_signal_day === true) signalStockCount += 1;\n    return {\n      ...stock,\n      strategy_tag_features: {\n        ...(stock.strategy_tag_features || {}),\n        two_stage_fundamental_signal_day: result.available ? result.is_signal_day : null,\n        two_stage_fundamental_source_available: result.available === true,\n        two_stage_fundamental_electronic: result.electronic ?? null,\n        two_stage_fundamental_fas_total: result.fas_total ?? null,\n        two_stage_fundamental_fq_score: result.fq_score ?? null,\n        two_stage_fundamental_signal_month: result.signal_month ?? null,\n        two_stage_fundamental_signal_date: result.signal_date ?? null,\n        two_stage_fundamental_event_date: result.event_date ?? null,\n        two_stage_fundamental_industry: result.industry ?? null,\n        two_stage_fundamental_financial_period: result.financial_period ?? null,\n        two_stage_fundamental_financial_known_date: result.financial_known_date ?? null,\n        two_stage_fundamental_reason: result.reason || null,\n      },\n    };\n  });\n\n  const totalStockCount = payload.stocks.length;\n  const status = availableStockCount === 0\n    ? 'unable_to_calculate'\n    : unavailableStockCount > 0 ? 'partial' : 'completed';\n  const metadata = {\n    calculation_status: status,\n    calculation_message: status === 'unable_to_calculate'\n      ? '基本面雙確認訊號來源無法計算。'\n      : status === 'partial'\n        ? \`基本面雙確認訊號部分可計算；可計算 \${availableStockCount}／\${totalStockCount} 檔。\`\n        : signalStockCount\n          ? \`已完成基本面雙確認訊號日判斷，共 \${signalStockCount} 檔。\`\n          : '已完成基本面雙確認訊號日判斷，當日 0 檔。',\n    base_trade_date: baseTradeDate || null,\n    rule_version: 1,\n    universe: 'electronic FAS>=8 + latest-known FQ>=10',\n    entry_policy: 'signal_day_direct_entry_baseline',\n    research_status: 'current_best_total-capital baseline; timing routing not OOS validated',\n    total_stock_count: totalStockCount,\n    available_stock_count: availableStockCount,\n    unavailable_stock_count: unavailableStockCount,\n    signal_stock_count: status === 'unable_to_calculate' ? null : signalStockCount,\n    coverage_pct: totalStockCount\n      ? Math.round((availableStockCount / totalStockCount) * 10000) / 100\n      : null,\n    source_files: [...sourceFiles].sort(),\n  };\n  payload.strategy_tag_source_metadata = {\n    ...(payload.strategy_tag_source_metadata || {}),\n    two_stage_fundamental_quality: metadata,\n  };\n  return metadata;\n}\n\n`;
    source = replaceOnce(source, 'function compactSnapshot(snapshot) {\n', `${helper}function compactSnapshot(snapshot) {\n`, 'helper insertion');
  }

  if (!source.includes('enrichTwoStageFundamentalFeatures(enrichedPayload, workspaceRoot);')) {
    const anchor = `    enrichStrategyTagSources(enrichedPayload, workspaceRoot, {\n      forecastDate: date,\n      dataAsOf,\n    });\n`;
    source = replaceOnce(
      source,
      anchor,
      `${anchor}    enrichTwoStageFundamentalFeatures(enrichedPayload, workspaceRoot);\n`,
      'enrichment call',
    );
  }

  if (!source.includes('  enrichTwoStageFundamentalFeatures,\n')) {
    source = replaceOnce(
      source,
      '  enrichMarginFeatures,\n',
      '  enrichMarginFeatures,\n  enrichTwoStageFundamentalFeatures,\n',
      'module export',
    );
  }
  fs.writeFileSync(APPLY_FILE, source, 'utf8');
}

function installRegistryEntries() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const tagId = 'fundamental_two_stage_signal_day_v1';
  const strategyId = 'two_stage_fundamental_quality_direct_entry_v1';
  if (!registry.tags.some(item => item.tag_id === tagId)) {
    registry.tags.push({
      tag_id: tagId,
      family_id: 'fundamental_two_stage_signal_day',
      version: 1,
      label: '基本面雙確認訊號日',
      category: 'fundamental',
      fixed_display: true,
      enabled: true,
      description: '僅在月營收訊號 base_trading_date 當日判定；電子股、FAS >= 8，且 latest-known FQ >= 10。',
      rule: {
        path: 'strategy_tag_features.two_stage_fundamental_signal_day',
        operator: 'eq',
        value: true,
      },
    });
  }
  if (!registry.strategies.some(item => item.strategy_id === strategyId)) {
    registry.strategies.push({
      strategy_id: strategyId,
      family_id: 'two_stage_fundamental_quality_direct_entry',
      version: 1,
      label: '基本面雙確認－訊號日直接進場',
      category: 'fundamental',
      fixed_display: true,
      enabled: true,
      description: '研究目前支持的總資金報酬 baseline：電子股 FAS >= 8 + latest-known FQ >= 10，僅列在實際訊號日。-5%/-10% timing 尚未通過 OOS，不作為必要 entry gate。',
      expression: {
        all: [tagId],
        any: [],
        not: [],
      },
    });
  }
  validateRegistry(registry);
  fs.writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

function updateResearchLog() {
  let doc = fs.readFileSync(RESEARCH_LOG, 'utf8');
  const start = '<!-- PRODUCTION_DIRECT_ENTRY_SIGNAL_START -->';
  const end = '<!-- PRODUCTION_DIRECT_ENTRY_SIGNAL_END -->';
  const section = `${start}\n## Production promotion — 基本面雙確認訊號日\n\n研究結論已正式接到股票預測的 Strategy Registry，但定位仍是「可觀測研究訊號」，不是保證買進建議。\n\n- Strategy ID：\`two_stage_fundamental_quality_direct_entry_v1\`\n- 顯示名稱：**基本面雙確認－訊號日直接進場**\n- Atomic tag：\`fundamental_two_stage_signal_day_v1\` / **基本面雙確認訊號日**\n- Universe：電子股\n- FAS：\`>= 8\`\n- FQ：\`latest-known financial_quality_score >= 10\`\n- 日期規則：**只在 monthly signal event 的 \`base_trading_date\` 當日命中**；之後不會因曾經出現過訊號而每天持續掛標籤。\n- Anti-lookahead：FQ 沿用 \`conservative_known_date <= event date\` 的 latest-known join；FAS 沿用原月營收研究 scoring。\n- Timing：目前不加入 -5% / -10% 等待 gate。Round 5 OOS 已證實 -5% timing 未通過，-10% 也僅 promising but not validated。\n- Production source：\`strategy_tag_features.two_stage_fundamental_signal_day\`，由 Registry 統一產生預測與覆盤分類，避免 Dashboard 另寫一套條件。\n\n目前 production 決策：\n\n> **FAS >= 8 + FQ >= 10 的電子股，在實際訊號日列入「基本面雙確認－訊號日直接進場」清單；未來若研究門檻改變，必須新增版本，不覆寫 v1 歷史定義。**\n${end}`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (pattern.test(doc)) doc = doc.replace(pattern, section);
  else doc = `${doc.trimEnd()}\n\n---\n\n${section}\n`;
  fs.writeFileSync(RESEARCH_LOG, doc, 'utf8');
}

function main() {
  installApplyHook();
  installRegistryEntries();
  updateResearchLog();
  console.log(JSON.stringify({
    apply_file: path.relative(ROOT, APPLY_FILE),
    registry_file: path.relative(ROOT, REGISTRY_FILE),
    research_log: path.relative(ROOT, RESEARCH_LOG),
    strategy_id: 'two_stage_fundamental_quality_direct_entry_v1',
  }, null, 2));
}

main();
