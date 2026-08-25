'use strict';

const fs = require('node:fs');
const path = require('node:path');

const METHODOLOGY_VERSION = 1;
const HORIZONS = [1, 3, 5];
const MIN_OBSERVE_SAMPLES = 30;
const MIN_RESEARCH_SAMPLES = 100;

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function pct(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100, 2) : null;
}

function groupDefinitions() {
  return [
    { id: 'grade_a', category: 'grade', label: 'A｜動能飆股', test: stock => stock.momentum_grade === 'A' },
    { id: 'grade_b', category: 'grade', label: 'B｜動能加速', test: stock => stock.momentum_grade === 'B' },
    { id: 'grade_c', category: 'grade', label: 'C｜動能準備', test: stock => stock.momentum_grade === 'C' },
    { id: 'score_50_64', category: 'score', label: 'Score 50–64', test: stock => stock.momentum_score >= 50 && stock.momentum_score < 65 },
    { id: 'score_65_79', category: 'score', label: 'Score 65–79', test: stock => stock.momentum_score >= 65 && stock.momentum_score < 80 },
    { id: 'score_80_89', category: 'score', label: 'Score 80–89', test: stock => stock.momentum_score >= 80 && stock.momentum_score < 90 },
    { id: 'score_90_plus', category: 'score', label: 'Score 90+', test: stock => stock.momentum_score >= 90 },
    { id: 'accel_negative', category: 'acceleration', label: 'Acceleration < 0', test: stock => Number.isFinite(stock.momentum_acceleration) && stock.momentum_acceleration < 0 },
    { id: 'accel_0_9', category: 'acceleration', label: 'Acceleration 0–9', test: stock => Number.isFinite(stock.momentum_acceleration) && stock.momentum_acceleration >= 0 && stock.momentum_acceleration < 10 },
    { id: 'accel_10_19', category: 'acceleration', label: 'Acceleration 10–19', test: stock => Number.isFinite(stock.momentum_acceleration) && stock.momentum_acceleration >= 10 && stock.momentum_acceleration < 20 },
    { id: 'accel_20_plus', category: 'acceleration', label: 'Acceleration 20+', test: stock => Number.isFinite(stock.momentum_acceleration) && stock.momentum_acceleration >= 20 },
    { id: 'price_volume_sync', category: 'fact', label: '量價共振', test: stock => stock.facts?.price_volume_sync === true },
    { id: 'chip_sync', category: 'fact', label: '籌碼共振', test: stock => stock.facts?.chip_sync === true },
    { id: 'breakout', category: 'fact', label: '強勢突破', test: stock => stock.facts?.breakout === true },
    { id: 'pv_and_chip', category: 'combo', label: '量價 + 籌碼', test: stock => stock.facts?.price_volume_sync === true && stock.facts?.chip_sync === true },
    { id: 'pv_and_breakout', category: 'combo', label: '量價 + 突破', test: stock => stock.facts?.price_volume_sync === true && stock.facts?.breakout === true },
    { id: 'chip_and_breakout', category: 'combo', label: '籌碼 + 突破', test: stock => stock.facts?.chip_sync === true && stock.facts?.breakout === true },
    { id: 'triple_sync', category: 'combo', label: '量價 + 籌碼 + 突破', test: stock => stock.facts?.price_volume_sync === true && stock.facts?.chip_sync === true && stock.facts?.breakout === true },
  ];
}

function evidenceStatus(n) {
  if (n >= MIN_RESEARCH_SAMPLES) return 'research_ready';
  if (n >= MIN_OBSERVE_SAMPLES) return 'observe';
  return 'insufficient';
}

function summarizeOutcomes(selected, horizon) {
  const key = `t_plus_${horizon}`;
  const available = selected.map(item => item.replay?.outcomes?.[key]).filter(Boolean);
  const returns = available.map(outcome => outcome.return_pct).filter(Number.isFinite);
  const mfe = available.map(outcome => outcome.max_gain_pct).filter(Number.isFinite);
  const mae = available.map(outcome => outcome.max_drawdown_pct).filter(Number.isFinite);
  const positive = returns.filter(value => value > 0).length;
  return {
    horizon,
    selected_count: selected.length,
    sample_count: available.length,
    coverage_pct: pct(available.length, selected.length),
    evidence_status: evidenceStatus(available.length),
    mean_return_pct: round(mean(returns)),
    median_return_pct: round(median(returns)),
    positive_rate_pct: pct(positive, returns.length),
    avg_mfe_pct: round(mean(mfe)),
    avg_mae_pct: round(mean(mae)),
    hit_4_pct_rate: pct(mfe.filter(value => value >= 4).length, mfe.length),
    hit_7_pct_rate: pct(mfe.filter(value => value >= 7).length, mfe.length),
    hit_10_pct_rate: pct(mfe.filter(value => value >= 10).length, mfe.length),
  };
}

function buildResearchSummary(histories, replays, options = {}) {
  const definitions = options.groups || groupDefinitions();
  const replayByDate = new Map(replays.map(replay => [replay.signal_date, replay]));
  const joined = [];
  const signalDates = [];
  const fingerprints = new Set();
  const dateSummaries = [];

  for (const history of histories) {
    if (!history?.signal_date || !Array.isArray(history.stocks)) continue;
    signalDates.push(history.signal_date);
    if (history.source_registry_fingerprint) fingerprints.add(history.source_registry_fingerprint);
    const replay = replayByDate.get(history.signal_date);
    const replayStocks = new Map((replay?.stocks || []).map(stock => [String(stock.stock_code), stock]));
    dateSummaries.push({
      signal_date: history.signal_date,
      stock_count: history.stock_count ?? history.stocks.length,
      grade_counts: history.grade_counts || null,
      completed_horizon: replay?.completed_horizon ?? 0,
      horizon_coverage: replay?.horizon_coverage || null,
      source_registry_fingerprint: history.source_registry_fingerprint || null,
    });
    for (const stock of history.stocks) {
      joined.push({
        signal_date: history.signal_date,
        stock,
        replay: replayStocks.get(String(stock.stock_code)) || null,
      });
    }
  }

  signalDates.sort();
  dateSummaries.sort((a, b) => a.signal_date.localeCompare(b.signal_date));

  const groups = definitions.map(group => {
    const selected = joined.filter(item => group.test(item.stock));
    const matchedDates = [...new Set(selected.map(item => item.signal_date))].sort();
    return {
      id: group.id,
      category: group.category,
      label: group.label,
      selected_count: selected.length,
      signal_date_count: matchedDates.length,
      matched_signal_dates: matchedDates,
      horizons: Object.fromEntries(HORIZONS.map(horizon => [String(horizon), summarizeOutcomes(selected, horizon)])),
    };
  });

  const matureHorizonDates = Object.fromEntries(HORIZONS.map(horizon => [
    String(horizon),
    dateSummaries.filter(item => item.completed_horizon >= horizon).map(item => item.signal_date),
  ]));

  const warnings = [];
  if (signalDates.length < 10) warnings.push(`目前只有 ${signalDates.length} 個 signal dates，任何報酬差異都只能視為早期觀測。`);
  for (const horizon of HORIZONS) {
    if (!matureHorizonDates[String(horizon)].length) warnings.push(`T+${horizon} 尚無成熟 signal date，不產生該 horizon 的研究結論。`);
  }
  if (fingerprints.size > 1) warnings.push('資料包含多個 Registry fingerprint，跨版本比較時應分開解讀。');

  return {
    schema_version: 1,
    methodology_version: METHODOLOGY_VERSION,
    generated_at: options.generatedAt || new Date().toISOString(),
    momentum_model_version: options.momentumModelVersion || 1,
    promotion_policy: {
      status: 'research_only',
      message: '此資料只用於研究與觀測，不會自動修改 Momentum v1 門檻或升版策略。',
      minimum_observe_samples: MIN_OBSERVE_SAMPLES,
      minimum_research_samples: MIN_RESEARCH_SAMPLES,
    },
    signal_date_count: signalDates.length,
    signal_dates: signalDates,
    registry_fingerprints: [...fingerprints].sort(),
    mature_horizon_dates: matureHorizonDates,
    warnings,
    date_summaries: dateSummaries,
    groups,
  };
}

function loadStoredResearchInputs(workspaceRoot, version = 1) {
  const historyRoot = path.join(workspaceRoot, 'data_prediction_analysis', 'momentum-history', `v${version}`);
  const replayRoot = path.join(workspaceRoot, 'data_prediction_analysis', 'momentum-replay', `v${version}`);
  const historyManifest = readJson(path.join(historyRoot, 'manifest.json'), { dates: {} });
  const replayManifest = readJson(path.join(replayRoot, 'manifest.json'), { dates: {} });
  const dates = Object.keys(historyManifest.dates || {}).sort();
  const histories = [];
  const replays = [];
  for (const date of dates) {
    const history = readJson(path.join(historyRoot, `${date}.json`), null);
    if (history) histories.push(history);
    if (replayManifest.dates?.[date]) {
      const replay = readJson(path.join(replayRoot, `${date}.json`), null);
      if (replay) replays.push(replay);
    }
  }
  return { histories, replays };
}

function writeResearchSummary(workspaceRoot, summary, version = 1) {
  const directory = path.join(workspaceRoot, 'data_prediction_analysis', 'momentum-research', `v${version}`);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'summary.json');
  fs.writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return file;
}

module.exports = {
  METHODOLOGY_VERSION,
  HORIZONS,
  MIN_OBSERVE_SAMPLES,
  MIN_RESEARCH_SAMPLES,
  readJson,
  round,
  mean,
  median,
  pct,
  groupDefinitions,
  evidenceStatus,
  summarizeOutcomes,
  buildResearchSummary,
  loadStoredResearchInputs,
  writeResearchSummary,
};
