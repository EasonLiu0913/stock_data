'use strict';

const fs = require('node:fs');
const path = require('node:path');

const METHODOLOGY_VERSION = 2;
const HORIZONS = [1, 3, 5];
const MIN_OBSERVE_SAMPLES = 30;
const MIN_RESEARCH_SAMPLES = 100;
const MIN_STABILITY_OBSERVE_DATES = 5;
const MIN_STABILITY_RESEARCH_DATES = 20;
const MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT = 80;
const RANK_TOP_N = 50;

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

function stddev(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return null;
  const avg = mean(finite);
  return Math.sqrt(finite.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / finite.length);
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

function stabilityEvidenceStatus(n) {
  if (n >= MIN_STABILITY_RESEARCH_DATES) return 'research_ready';
  if (n >= MIN_STABILITY_OBSERVE_DATES) return 'observe';
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

function summarizeDateStability(selected, horizon, matureDates = []) {
  const key = `t_plus_${horizon}`;
  const byDate = new Map();
  for (const item of selected) {
    if (!byDate.has(item.signal_date)) byDate.set(item.signal_date, []);
    byDate.get(item.signal_date).push(item);
  }
  const dateMetrics = [];
  for (const signalDate of matureDates) {
    const rows = byDate.get(signalDate) || [];
    if (!rows.length) continue;
    const outcomes = rows.map(item => item.replay?.outcomes?.[key]).filter(Boolean);
    const returns = outcomes.map(outcome => outcome.return_pct).filter(Number.isFinite);
    if (!returns.length) continue;
    dateMetrics.push({
      signal_date: signalDate,
      selected_count: rows.length,
      sample_count: outcomes.length,
      coverage_pct: pct(outcomes.length, rows.length),
      mean_return_pct: round(mean(returns)),
      median_return_pct: round(median(returns)),
      positive_rate_pct: pct(returns.filter(value => value > 0).length, returns.length),
    });
  }
  const dateMeans = dateMetrics.map(item => item.mean_return_pct).filter(Number.isFinite);
  const positiveDates = dateMeans.filter(value => value > 0).length;
  const negativeDates = dateMeans.filter(value => value < 0).length;
  const ranked = [...dateMetrics].sort((a, b) => (a.mean_return_pct ?? 0) - (b.mean_return_pct ?? 0));
  return {
    horizon,
    mature_date_count: dateMetrics.length,
    evidence_status: stabilityEvidenceStatus(dateMetrics.length),
    avg_date_mean_return_pct: round(mean(dateMeans)),
    stddev_date_mean_return_pct: round(stddev(dateMeans)),
    positive_date_rate_pct: pct(positiveDates, dateMeans.length),
    directional_consistency_pct: pct(Math.max(positiveDates, negativeDates), dateMeans.length),
    best_date: ranked.length ? ranked.at(-1) : null,
    worst_date: ranked.length ? ranked[0] : null,
    dates: dateMetrics,
  };
}

function rankStocks(stocks) {
  return [...(stocks || [])]
    .filter(stock => Number.isFinite(Number(stock.momentum_score)))
    .sort((left, right) => Number(right.momentum_score) - Number(left.momentum_score) || String(left.stock_code).localeCompare(String(right.stock_code)))
    .map((stock, index) => ({ ...stock, momentum_rank: index + 1 }));
}

function overlapPct(current, previous, topN) {
  const currentSet = new Set(current.slice(0, topN).map(stock => String(stock.stock_code)));
  const previousSet = new Set(previous.slice(0, topN).map(stock => String(stock.stock_code)));
  if (!currentSet.size || !previousSet.size) return null;
  const overlap = [...currentSet].filter(code => previousSet.has(code)).length;
  return { count: overlap, rate_pct: pct(overlap, Math.min(currentSet.size, previousSet.size)) };
}

function buildRankingAnalysis(histories, topN = RANK_TOP_N) {
  const ordered = histories
    .filter(history => history?.signal_date && Array.isArray(history.stocks))
    .sort((a, b) => a.signal_date.localeCompare(b.signal_date));
  const dates = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const currentHistory = ordered[index];
    const previousHistory = ordered[index - 1] || null;
    const current = rankStocks(currentHistory.stocks);
    const previous = previousHistory ? rankStocks(previousHistory.stocks) : [];
    const previousByCode = new Map(previous.map(stock => [String(stock.stock_code), stock]));
    const top20Overlap = previousHistory ? overlapPct(current, previous, 20) : null;
    const top50Overlap = previousHistory ? overlapPct(current, previous, topN) : null;
    const currentTop20 = current.slice(0, 20).map(stock => String(stock.stock_code));
    const previousTop20 = previous.slice(0, 20).map(stock => String(stock.stock_code));
    const previousTop20Set = new Set(previousTop20);
    const currentTop20Set = new Set(currentTop20);
    const movers = current.slice(0, Math.min(topN, current.length)).map(stock => {
      const prior = previousByCode.get(String(stock.stock_code));
      const priorScore = Number(prior?.momentum_score);
      return {
        stock_code: stock.stock_code,
        stock_name: stock.stock_name || '',
        industry: stock.industry || '',
        rank: stock.momentum_rank,
        previous_rank: prior?.momentum_rank ?? null,
        rank_change: prior?.momentum_rank ? prior.momentum_rank - stock.momentum_rank : null,
        momentum_score: Number(stock.momentum_score),
        previous_score: Number.isFinite(priorScore) ? priorScore : null,
        score_change: Number.isFinite(priorScore) ? round(Number(stock.momentum_score) - priorScore, 2) : null,
        momentum_grade: stock.momentum_grade || null,
      };
    });
    dates.push({
      signal_date: currentHistory.signal_date,
      previous_signal_date: previousHistory?.signal_date || null,
      ranked_stock_count: current.length,
      top20_overlap_count: top20Overlap?.count ?? null,
      top20_overlap_pct: top20Overlap?.rate_pct ?? null,
      top50_overlap_count: top50Overlap?.count ?? null,
      top50_overlap_pct: top50Overlap?.rate_pct ?? null,
      top20_entrants: previousHistory ? currentTop20.filter(code => !previousTop20Set.has(code)) : [],
      top20_exits: previousHistory ? previousTop20.filter(code => !currentTop20Set.has(code)) : [],
      movers,
    });
  }
  const comparable = dates.filter(item => item.previous_signal_date);
  return {
    top_n: topN,
    comparable_pair_count: comparable.length,
    avg_top20_overlap_pct: round(mean(comparable.map(item => item.top20_overlap_pct)), 2),
    avg_top50_overlap_pct: round(mean(comparable.map(item => item.top50_overlap_pct)), 2),
    dates,
  };
}

function cleanIndustry(value) {
  return String(value || '').trim();
}

function industryDistribution(selectedStocks, universeStocks) {
  const selected = selectedStocks || [];
  const universe = universeStocks || [];
  const selectedClassified = selected.filter(stock => cleanIndustry(stock.industry));
  const universeClassified = universe.filter(stock => cleanIndustry(stock.industry));
  const selectedCounts = new Map();
  const universeCounts = new Map();
  for (const stock of selectedClassified) {
    const industry = cleanIndustry(stock.industry);
    selectedCounts.set(industry, (selectedCounts.get(industry) || 0) + 1);
  }
  for (const stock of universeClassified) {
    const industry = cleanIndustry(stock.industry);
    universeCounts.set(industry, (universeCounts.get(industry) || 0) + 1);
  }
  const selectedTotal = selected.length;
  const universeTotal = universe.length;
  const selectedClassifiedCount = selectedClassified.length;
  const universeClassifiedCount = universeClassified.length;
  const selectedClassificationCoverage = pct(selectedClassifiedCount, selectedTotal);
  const universeClassificationCoverage = pct(universeClassifiedCount, universeTotal);
  let classificationStatus = 'sufficient';
  if (selectedTotal === 0) classificationStatus = 'no_candidates';
  else if (!selectedClassifiedCount || !universeClassifiedCount) classificationStatus = 'unavailable';
  else if ((selectedClassificationCoverage ?? 0) < MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT
    || (universeClassificationCoverage ?? 0) < MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT) classificationStatus = 'partial';

  const industries = [...selectedCounts.keys()].map(industry => {
    const selectedCount = selectedCounts.get(industry) || 0;
    const universeCount = universeCounts.get(industry) || 0;
    const selectedShare = selectedClassifiedCount ? selectedCount / selectedClassifiedCount : 0;
    const universeShare = universeClassifiedCount ? universeCount / universeClassifiedCount : 0;
    return {
      industry,
      selected_count: selectedCount,
      selected_share_pct: round(selectedShare * 100, 2),
      universe_count: universeCount,
      universe_share_pct: round(universeShare * 100, 2),
      lift_ratio: universeShare > 0 ? round(selectedShare / universeShare, 2) : null,
    };
  }).sort((a, b) => b.selected_count - a.selected_count || a.industry.localeCompare(b.industry));
  const shares = industries.map(item => item.selected_share_pct / 100);
  return {
    selected_count: selectedTotal,
    selected_classified_count: selectedClassifiedCount,
    selected_unclassified_count: selectedTotal - selectedClassifiedCount,
    selected_classification_coverage_pct: selectedClassificationCoverage,
    universe_count: universeTotal,
    universe_classified_count: universeClassifiedCount,
    universe_unclassified_count: universeTotal - universeClassifiedCount,
    universe_classification_coverage_pct: universeClassificationCoverage,
    minimum_classification_coverage_pct: MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT,
    classification_status: classificationStatus,
    concentration_available: classificationStatus === 'sufficient',
    industry_count: industries.length,
    top3_share_pct: selectedClassifiedCount ? round(industries.slice(0, 3).reduce((sum, item) => sum + item.selected_share_pct, 0), 2) : null,
    hhi: selectedClassifiedCount ? round(shares.reduce((sum, value) => sum + (value ** 2), 0) * 10000, 2) : null,
    industries,
  };
}

function buildIndustryAnalysis(histories) {
  const segments = [
    { id: 'score_50_plus', label: 'Momentum Score ≥ 50', test: stock => Number(stock.momentum_score) >= 50 },
    { id: 'grade_a', label: 'A｜動能飆股', test: stock => stock.momentum_grade === 'A' },
    { id: 'grade_b', label: 'B｜動能加速', test: stock => stock.momentum_grade === 'B' },
    { id: 'grade_c', label: 'C｜動能準備', test: stock => stock.momentum_grade === 'C' },
  ];
  const ordered = histories
    .filter(history => history?.signal_date && Array.isArray(history.stocks))
    .sort((a, b) => a.signal_date.localeCompare(b.signal_date));
  const perDate = ordered.map(history => ({
    signal_date: history.signal_date,
    segments: Object.fromEntries(segments.map(segment => [segment.id, industryDistribution(history.stocks.filter(segment.test), history.stocks)])),
  }));
  const allUniverse = ordered.flatMap(history => history.stocks);
  const overall = Object.fromEntries(segments.map(segment => [
    segment.id,
    {
      label: segment.label,
      ...industryDistribution(allUniverse.filter(segment.test), allUniverse),
    },
  ]));
  return {
    baseline: 'same-signal-date classified listed-stock universe; overall aggregates classified stock-date observations',
    missing_industry_policy: 'unclassified stocks remain in coverage counts but are excluded from share, lift, Top3, and HHI calculations',
    minimum_classification_coverage_pct: MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT,
    segments: segments.map(({ id, label }) => ({ id, label })),
    overall,
    dates: perDate,
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

  const matureHorizonDates = Object.fromEntries(HORIZONS.map(horizon => [
    String(horizon),
    dateSummaries.filter(item => item.completed_horizon >= horizon).map(item => item.signal_date),
  ]));

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
      stability: Object.fromEntries(HORIZONS.map(horizon => [String(horizon), summarizeDateStability(selected, horizon, matureHorizonDates[String(horizon)])])),
    };
  });

  const rankingAnalysis = buildRankingAnalysis(histories, options.rankTopN || RANK_TOP_N);
  const industryAnalysis = buildIndustryAnalysis(histories);

  const warnings = [];
  if (signalDates.length < 10) warnings.push(`目前只有 ${signalDates.length} 個 signal dates，任何報酬差異都只能視為早期觀測。`);
  for (const horizon of HORIZONS) {
    const matureCount = matureHorizonDates[String(horizon)].length;
    if (!matureCount) warnings.push(`T+${horizon} 尚無成熟 signal date，不產生該 horizon 的研究結論。`);
    else if (matureCount < MIN_STABILITY_OBSERVE_DATES) warnings.push(`T+${horizon} 目前只有 ${matureCount} 個成熟 signal dates，跨日期穩定性仍不足。`);
  }
  if (fingerprints.size > 1) warnings.push('資料包含多個 Registry fingerprint，跨版本比較時應分開解讀。');
  const candidateIndustry = industryAnalysis.overall.score_50_plus;
  if (candidateIndustry.selected_count > 0 && candidateIndustry.classification_status !== 'sufficient') {
    warnings.push(`Score ≥ 50 候選的產業分類覆蓋率為 ${candidateIndustry.selected_classification_coverage_pct ?? 0}%（Universe ${candidateIndustry.universe_classification_coverage_pct ?? 0}%），低於研究門檻 ${MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT}%；暫不判定產業集中度。`);
  } else if (candidateIndustry.concentration_available && candidateIndustry.top3_share_pct >= 70) {
    warnings.push(`Score ≥ 50 候選的前三大產業占比為 ${candidateIndustry.top3_share_pct}%，目前存在明顯產業集中，不能把整體結果直接泛化到全市場。`);
  }

  return {
    schema_version: 2,
    methodology_version: METHODOLOGY_VERSION,
    generated_at: options.generatedAt || new Date().toISOString(),
    momentum_model_version: options.momentumModelVersion || 1,
    promotion_policy: {
      status: 'research_only',
      message: '此資料只用於研究與觀測，不會自動修改 Momentum v1 門檻或升版策略。',
      minimum_observe_samples: MIN_OBSERVE_SAMPLES,
      minimum_research_samples: MIN_RESEARCH_SAMPLES,
      minimum_stability_observe_dates: MIN_STABILITY_OBSERVE_DATES,
      minimum_stability_research_dates: MIN_STABILITY_RESEARCH_DATES,
      minimum_industry_classification_coverage_pct: MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT,
      required_checks_before_promotion: ['sample_size', 'cross_date_stability', 'rank_persistence', 'industry_distribution', 'market_context'],
    },
    signal_date_count: signalDates.length,
    signal_dates: signalDates,
    registry_fingerprints: [...fingerprints].sort(),
    mature_horizon_dates: matureHorizonDates,
    warnings,
    date_summaries: dateSummaries,
    groups,
    ranking_analysis: rankingAnalysis,
    industry_analysis: industryAnalysis,
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
  MIN_STABILITY_OBSERVE_DATES,
  MIN_STABILITY_RESEARCH_DATES,
  MIN_INDUSTRY_CLASSIFICATION_COVERAGE_PCT,
  RANK_TOP_N,
  readJson,
  round,
  mean,
  median,
  stddev,
  pct,
  groupDefinitions,
  evidenceStatus,
  stabilityEvidenceStatus,
  summarizeOutcomes,
  summarizeDateStability,
  rankStocks,
  buildRankingAnalysis,
  industryDistribution,
  buildIndustryAnalysis,
  buildResearchSummary,
  loadStoredResearchInputs,
  writeResearchSummary,
};
