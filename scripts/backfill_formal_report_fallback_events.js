#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discoverTradingDates } = require('./fundamental_event_timeline');
const { fallbackFormalEvents, dedupeEvents } = require('./build_fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const GAP_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'formal-report-event-gap-report.json');
const EVENT_ROOT = path.join(ROOT, 'data_fundamental_events');
const REPORT_DIR = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'formal-report-backfill-runs');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}
function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}
function intValue(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}
function loadExistingEvents(stockId) {
  const dir = path.join(EVENT_ROOT, stockId);
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).filter(name => /^20\d{2}\.json$/.test(name)).sort()) {
    const payload = readJson(path.join(dir, name), {});
    for (const event of payload.events || []) out.push(event);
  }
  return out;
}
function eventYear(event, asOfDate) {
  return String(event.published_date || event.fallback_known_date || event.effective_trading_date || asOfDate).slice(0, 4);
}
function writeMergedStock(stockId, events, asOfDate) {
  const byYear = new Map();
  for (const event of events) {
    const year = eventYear(event, asOfDate);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(event);
  }
  const dir = path.join(EVENT_ROOT, stockId);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [year, rows] of [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const file = path.join(dir, `${year}.json`);
    const previous = readJson(file, {});
    writeJson(file, {
      schema_version: 1,
      dataset: 'fundamental_event_timeline',
      generated_at: new Date().toISOString(),
      shadow_mode: true,
      stock_id: stockId,
      year,
      as_of_date: asOfDate,
      event_count: rows.length,
      events: rows,
      backfill_metadata: {
        mode: 'formal_report_fallback_only',
        preserves_higher_confidence_events: true,
        previous_generated_at: previous.generated_at || null,
      },
    });
    files.push(path.relative(ROOT, file));
  }
  return files;
}
function validateCandidate(stockPlan, event) {
  const periodPlan = (stockPlan.periods || []).find(p => p.fiscal_period === event.fiscal_period);
  if (!periodPlan || periodPlan.status !== 'direct_fallback_candidate') return 'not_approved_by_gap_report';
  if (event.event_type !== 'formal_financial_report') return 'unexpected_event_type';
  if (event.availability_confidence !== 'fallback_deadline') return 'unexpected_confidence';
  if (!event.fallback_known_date || !event.effective_trading_date) return 'missing_availability_dates';
  if (event.published_at || event.published_date) return 'fallback_must_not_claim_publication_time';
  return null;
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const apply = boolValue(args.get('apply'), false);
  const offset = intValue(args.get('offset'), 0);
  const batchSize = Math.max(1, intValue(args.get('batch-size'), 50));
  const gap = readJson(GAP_FILE);
  if (!gap || gap.mode !== 'investigation_only' || gap.mutates_fundamental_events !== false) throw new Error('Gap report missing or unsafe');
  const asOfDate = String(args.get('as-of-date') || gap.as_of_date || '').trim();
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error(`Invalid as-of date: ${asOfDate}`);
  const selected = (gap.stocks || [])
    .filter(stock => stock.priority === 'event_only_gap' && stock.direct_fallback_candidate_count > 0)
    .sort((a, b) => a.stock_code.localeCompare(b.stock_code))
    .slice(offset, offset + batchSize);
  const tradingDates = discoverTradingDates(ROOT);
  const stockResults = [];
  let created = 0, skipped = 0, failed = 0;
  const writtenFiles = [];

  for (const stockPlan of selected) {
    const stockId = stockPlan.stock_code;
    try {
      const existing = loadExistingEvents(stockId);
      const existingFormalPeriods = new Set(existing.filter(e => e.event_type === 'formal_financial_report' && e.fiscal_period).map(e => e.fiscal_period));
      const proposed = fallbackFormalEvents(stockId, tradingDates, asOfDate)
        .filter(event => stockPlan.direct_fallback_candidate_periods.includes(event.fiscal_period));
      const accepted = [];
      const details = [];
      for (const event of proposed) {
        const invalid = validateCandidate(stockPlan, event);
        if (invalid) { failed++; details.push({ fiscal_period: event.fiscal_period, action: 'failed', reason: invalid }); continue; }
        if (existingFormalPeriods.has(event.fiscal_period)) { skipped++; details.push({ fiscal_period: event.fiscal_period, action: 'skipped', reason: 'formal_event_already_exists' }); continue; }
        accepted.push(event);
        details.push({ fiscal_period: event.fiscal_period, action: apply ? 'created' : 'would_create', event_id: event.event_id, fallback_known_date: event.fallback_known_date, effective_trading_date: event.effective_trading_date });
      }
      if (accepted.length !== stockPlan.direct_fallback_candidate_count) {
        const accounted = accepted.length + details.filter(x => x.action === 'skipped').length + details.filter(x => x.action === 'failed').length;
        if (accounted < stockPlan.direct_fallback_candidate_count) {
          failed += stockPlan.direct_fallback_candidate_count - accounted;
          details.push({ action: 'failed', reason: 'candidate_count_mismatch', expected: stockPlan.direct_fallback_candidate_count, proposed: proposed.length });
        }
      }
      if (apply && accepted.length) {
        const merged = dedupeEvents([...existing, ...accepted]);
        writtenFiles.push(...writeMergedStock(stockId, merged, asOfDate));
        created += accepted.length;
      } else if (!apply) {
        created += accepted.length;
      }
      stockResults.push({ stock_code: stockId, candidate_count: stockPlan.direct_fallback_candidate_count, accepted_count: accepted.length, details });
    } catch (error) {
      failed += stockPlan.direct_fallback_candidate_count || 1;
      stockResults.push({ stock_code: stockId, candidate_count: stockPlan.direct_fallback_candidate_count, accepted_count: 0, error: error.message });
    }
  }

  const payload = {
    schema_version: 1,
    dataset: 'formal_report_fallback_backfill_run',
    generated_at: new Date().toISOString(),
    mode: apply ? 'apply' : 'plan_only',
    source_gap_report_generated_at: gap.generated_at,
    as_of_date: asOfDate,
    offset,
    batch_size: batchSize,
    selected_stock_count: selected.length,
    selected_stock_codes: selected.map(s => s.stock_code),
    summary: {
      candidates: selected.reduce((sum, s) => sum + s.direct_fallback_candidate_count, 0),
      would_create_or_created: created,
      skipped,
      failed,
      written_file_count: writtenFiles.length,
    },
    written_files: writtenFiles,
    stocks: stockResults,
  };
  const suffix = `${String(offset).padStart(4, '0')}-${String(offset + selected.length - 1).padStart(4, '0')}`;
  const reportFile = path.join(REPORT_DIR, `${apply ? 'apply' : 'plan'}-${suffix}.json`);
  writeJson(reportFile, payload);
  console.log(JSON.stringify({ report: path.relative(ROOT, reportFile), ...payload.summary, selected_stock_count: selected.length }, null, 2));
  if (failed > 0) process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { validateCandidate, loadExistingEvents, writeMergedStock };
