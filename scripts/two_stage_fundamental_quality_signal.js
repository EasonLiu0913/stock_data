'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  scoreComponents,
  prevMonth,
} = require('./summarize_mops_revenue_fundamental_acceleration_score');
const {
  latestKnownFinancial,
} = require('./summarize_two_stage_fundamental_quality_long_horizons');
const {
  syncMissingMonths,
} = require('./sync_mops_monthly_signal_artifacts');

const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業',
  '電腦及週邊設備業',
  '光電業',
  '通信網路業',
  '電子零組件業',
  '電子通路業',
  '資訊服務業',
  '其他電子業',
  '電子工業',
]);

const ROOT_CACHE = new Map();

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function rootState(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  if (!ROOT_CACHE.has(root)) {
    ROOT_CACHE.set(root, {
      signal_index: null,
      signal_files: [],
      revenue_months: new Map(),
      financial_by_stock: null,
      financial_source_available: null,
      signal_sync_result: null,
    });
  }
  return ROOT_CACHE.get(root);
}

function ensureMonthlySignalArtifacts(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const state = rootState(root);
  if (state.signal_sync_result) return state.signal_sync_result;

  const defaultRoot = path.resolve(__dirname, '..');
  if (root !== defaultRoot) {
    state.signal_sync_result = { skipped: true, reason: 'non_default_workspace_root' };
    return state.signal_sync_result;
  }

  state.signal_sync_result = syncMissingMonths();
  return state.signal_sync_result;
}

function loadSignalIndex(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const state = rootState(root);
  if (state.signal_index) return state;

  ensureMonthlySignalArtifacts(root);

  const signalRoot = path.join(
    root,
    'data_prediction_analysis',
    'monthly-revenue',
    'monthly-signals',
  );
  const index = new Map();
  let files = [];
  try {
    files = fs.readdirSync(signalRoot)
      .filter(name => /^20\d{4}\.json$/.test(name))
      .sort();
  } catch {
    files = [];
  }

  for (const file of files) {
    const month = file.slice(0, 6);
    const payload = readJson(path.join(signalRoot, file), null);
    if (!payload || !Array.isArray(payload.events)) continue;
    for (const event of payload.events) {
      const stockId = String(event?.stock_code || '');
      const signalDate = compactDate(event?.base_trading_date);
      if (!stockId || !signalDate) continue;
      const key = `${signalDate}:${stockId}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ month, event });
    }
  }

  state.signal_index = index;
  state.signal_files = files.map(file => (
    `data_prediction_analysis/monthly-revenue/monthly-signals/${file}`
  ));
  return state;
}

function loadRevenueMonth(workspaceRoot, month) {
  const root = path.resolve(workspaceRoot);
  const state = rootState(root);
  if (state.revenue_months.has(month)) return state.revenue_months.get(month);

  const file = path.join(root, 'data_mops_monthly_revenue', month, 'monthly_revenue.json');
  const payload = readJson(file, null);
  if (!payload || !Array.isArray(payload.companies)) {
    const result = { available: false, by_stock: new Map(), source_file: null };
    state.revenue_months.set(month, result);
    return result;
  }

  const result = {
    available: true,
    by_stock: new Map(payload.companies.map(row => [String(row.stock_code), row])),
    source_file: `data_mops_monthly_revenue/${month}/monthly_revenue.json`,
  };
  state.revenue_months.set(month, result);
  return result;
}

function revenueHistoryForStock(workspaceRoot, month, stockId) {
  const history = new Map();
  const sourceFiles = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const targetMonth = prevMonth(month, offset);
    const source = loadRevenueMonth(workspaceRoot, targetMonth);
    const row = source.by_stock.get(String(stockId));
    if (source.source_file) sourceFiles.push(source.source_file);
    if (row) history.set(targetMonth, row);
  }
  return { history, source_files: [...new Set(sourceFiles)] };
}

function loadFinancialByStock(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const state = rootState(root);
  if (state.financial_by_stock) return state;

  const file = path.join(
    root,
    'data_prediction_analysis',
    'quarterly-financial-quality',
    'financial-quality-master.json',
  );
  const payload = readJson(file, null);
  if (!payload || !Array.isArray(payload.stocks)) {
    state.financial_by_stock = new Map();
    state.financial_source_available = false;
    return state;
  }

  state.financial_by_stock = new Map(
    payload.stocks.map(stock => [String(stock.stock_id), stock.rows || []]),
  );
  state.financial_source_available = true;
  return state;
}

function evaluateCandidate(workspaceRoot, stockId, month, event) {
  const revenue = loadRevenueMonth(workspaceRoot, month);
  const currentRevenue = revenue.by_stock.get(String(stockId)) || null;
  if (!revenue.available || !currentRevenue) {
    return {
      available: false,
      reason: 'monthly_revenue_unavailable',
      month,
      event,
      source_files: revenue.source_file ? [revenue.source_file] : [],
    };
  }

  const revenueHistory = revenueHistoryForStock(workspaceRoot, month, stockId);
  const fas = scoreComponents(event, month, revenueHistory.history);
  const financialState = loadFinancialByStock(workspaceRoot);
  if (!financialState.financial_source_available) {
    return {
      available: false,
      reason: 'financial_quality_master_unavailable',
      month,
      event,
      currentRevenue,
      fas,
      source_files: revenueHistory.source_files,
    };
  }

  const eventDate = compactDate(
    event?.effective_trading_date || event?.conservative_availability_date,
  );
  const financial = latestKnownFinancial(
    financialState.financial_by_stock.get(String(stockId)) || [],
    eventDate,
  );
  if (!financial || !Number.isFinite(Number(financial.financial_quality_score))) {
    return {
      available: false,
      reason: 'latest_known_financial_quality_unavailable',
      month,
      event,
      eventDate,
      currentRevenue,
      fas,
      source_files: revenueHistory.source_files,
    };
  }

  const electronic = ELECTRONIC_INDUSTRIES.has(currentRevenue.industry || '');
  const fasTotal = Number(fas.total_score);
  const fqScore = Number(financial.financial_quality_score);
  return {
    available: true,
    reason: electronic && fasTotal >= 8 && fqScore >= 10
      ? 'qualified_signal_day'
      : 'signal_event_below_two_stage_threshold',
    month,
    event,
    eventDate,
    currentRevenue,
    fas,
    financial,
    electronic,
    fasTotal,
    fqScore,
    qualified: electronic && fasTotal >= 8 && fqScore >= 10,
    source_files: revenueHistory.source_files,
  };
}

function evaluateTwoStageFundamentalSignalDay({ workspaceRoot, stockId, baseTradeDate }) {
  const root = path.resolve(workspaceRoot);
  const code = String(stockId || '');
  const date = compactDate(baseTradeDate);
  const signalState = loadSignalIndex(root);

  if (!date || !code) {
    return {
      available: false,
      is_signal_day: null,
      reason: 'missing_stock_or_base_trade_date',
      stock_id: code || null,
      signal_date: date || null,
      source_files: signalState.signal_files,
    };
  }

  const candidates = signalState.signal_index.get(`${date}:${code}`) || [];
  if (!candidates.length) {
    return {
      available: true,
      is_signal_day: false,
      reason: 'no_monthly_signal_event_on_base_trade_date',
      stock_id: code,
      signal_date: date,
      signal_month: null,
      electronic: null,
      fas_total: null,
      fq_score: null,
      event_date: null,
      industry: null,
      source_files: signalState.signal_files,
    };
  }

  const evaluated = candidates.map(candidate => evaluateCandidate(
    root,
    code,
    candidate.month,
    candidate.event,
  ));
  const qualified = evaluated.find(item => item.available && item.qualified);
  const selected = qualified
    || evaluated.find(item => item.available)
    || evaluated[0];

  if (!selected?.available) {
    return {
      available: false,
      is_signal_day: null,
      reason: selected?.reason || 'signal_evaluation_unavailable',
      stock_id: code,
      signal_date: date,
      signal_month: selected?.month || candidates[0]?.month || null,
      electronic: null,
      fas_total: Number.isFinite(Number(selected?.fas?.total_score))
        ? Number(selected.fas.total_score)
        : null,
      fq_score: null,
      event_date: selected?.eventDate || null,
      industry: selected?.currentRevenue?.industry || null,
      source_files: [
        ...new Set([
          ...signalState.signal_files,
          ...(selected?.source_files || []),
        ]),
      ],
    };
  }

  return {
    available: true,
    is_signal_day: selected.qualified === true,
    reason: selected.reason,
    stock_id: code,
    signal_date: date,
    signal_month: selected.month,
    electronic: selected.electronic,
    fas_total: selected.fasTotal,
    fq_score: selected.fqScore,
    event_date: selected.eventDate || null,
    industry: selected.currentRevenue?.industry || null,
    financial_period: selected.financial?.fiscal_period || null,
    financial_known_date: selected.financial?.conservative_known_date || null,
    source_files: [
      ...new Set([
        ...signalState.signal_files,
        ...selected.source_files,
        'data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json',
      ]),
    ],
  };
}

function clearTwoStageFundamentalSignalCache(workspaceRoot = null) {
  if (workspaceRoot) ROOT_CACHE.delete(path.resolve(workspaceRoot));
  else ROOT_CACHE.clear();
}

module.exports = {
  ELECTRONIC_INDUSTRIES,
  ensureMonthlySignalArtifacts,
  evaluateTwoStageFundamentalSignalDay,
  clearTwoStageFundamentalSignalCache,
};
