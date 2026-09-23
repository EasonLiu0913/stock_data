#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PROTOCOL_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-protocol-v1.json');
const EVENT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-five-window-event-intelligence-v1.json');
const HANDOFF_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-event-intelligence-handoff.md');
const CALENDAR_PATH = path.join(ROOT, 'data_history_sma/trading_days.json');
const BENCHMARK_PATH = path.join(ROOT, 'data_twse_market_chart/market_chart.json');
const OUTPUT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-execution-v1.json');

const EXPECTED_EVENT_BLOB = 'ee34b995148886ed4f4b27940c6a854fff26f3bb';
const EXPECTED_EVENT_METHOD = '27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96';
const EXPECTED_PROTOCOL_METHOD = '5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be';
const AUTH_TEXT = '我授權開啟 outcome values，執行下一輪 Prompt A';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function gitBlobSha1(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
}
function compactDate(v) { return String(v || '').replace(/[^0-9]/g, ''); }
function formatLocalParts(iso) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { date: `${parts.year}${parts.month}${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
function loadTradingDays() {
  const payload = readJson(CALENDAR_PATH);
  return [...new Set(Object.values(payload).flat().map(compactDate).filter(x => /^20\d{6}$/.test(x)))].sort();
}
function resolveEventSession(firstSeenAt, tradingDays) {
  const local = formatLocalParts(firstSeenAt);
  const open = 9 * 60, close = 13 * 60 + 30;
  const sameIndex = tradingDays.indexOf(local.date);
  if (local.minutes >= open && local.minutes < close && sameIndex >= 0) {
    return { status: 'resolved', local_first_seen_date: local.date, classification: 'during_regular_session', event_session: local.date };
  }
  const eligible = tradingDays.find(d => d > local.date || (local.minutes < open && d === local.date));
  if (!eligible) {
    return {
      status: 'missing',
      local_first_seen_date: local.date,
      classification: local.minutes >= close ? 'after_regular_close' : (local.minutes < open ? 'before_open' : 'non_eligible_session'),
      event_session: null,
      reason: 'trading_calendar_has_no_eligible_session_at_or_after_event',
    };
  }
  return {
    status: 'resolved', local_first_seen_date: local.date,
    classification: local.minutes >= close ? 'after_regular_close' : (local.minutes < open ? 'before_open' : 'non_eligible_session'),
    event_session: eligible
  };
}
function latestBenchmarkDate() {
  if (!fs.existsSync(BENCHMARK_PATH)) return null;
  const payload = readJson(BENCHMARK_PATH);
  const dates = (payload.data || []).map(x => compactDate(x.date)).filter(Boolean).sort();
  return dates.at(-1) || null;
}
function availableDailyDates(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(name => {
    const m = name.match(/^(20\d{6})/);
    return m && (!suffix || name.endsWith(suffix)) ? m[1] : null;
  }).filter(Boolean).sort();
}
function existsRel(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function buildResult() {
  const protocolBytes = fs.readFileSync(PROTOCOL_PATH);
  const eventBytes = fs.readFileSync(EVENT_PATH);
  const protocol = JSON.parse(protocolBytes);
  const event = JSON.parse(eventBytes);
  const handoff = fs.readFileSync(HANDOFF_PATH, 'utf8');

  if (gitBlobSha1(eventBytes) !== EXPECTED_EVENT_BLOB) throw new Error('Frozen Event Intelligence blob drift');
  if (event.methodology_sha256 !== EXPECTED_EVENT_METHOD) throw new Error('Frozen Event Intelligence methodology drift');
  if (protocol.methodology?.sha256 !== EXPECTED_PROTOCOL_METHOD) throw new Error('Protocol methodology drift');
  if (!handoff.includes(AUTH_TEXT) || !handoff.includes('owner authorization recorded before first outcome read: **true**')) {
    throw new Error('Durable owner authorization checkpoint missing');
  }
  if (protocol.cohort?.primary_count !== 11 || protocol.cohort?.excluded_left_censored_count !== 169) throw new Error('Protocol cohort drift');

  const tradingDays = loadTradingDays();
  const calendarLatest = tradingDays.at(-1) || null;
  const primaryEvents = protocol.cohort.primary_events.map(row => {
    const alignment = resolveEventSession(row.first_seen_at, tradingDays);
    return {
      event_identity: row.event_identity,
      stock: row.stock,
      first_seen_at: row.first_seen_at,
      source_reported_at: row.source_reported_at,
      first_listing_taxonomy: row.first_listing_taxonomy,
      first_listing_features: row.first_listing_features,
      alignment,
      stock_session_cluster_id: alignment.event_session ? `${row.stock}|${alignment.event_session}` : null,
      returns: {
        D1: { status: 'missing', value_pct: null, benchmark_pct: null, relative_pct: null, reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' },
        D3: { status: 'missing', value_pct: null, benchmark_pct: null, relative_pct: null, reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' },
        D5: { status: 'missing', value_pct: null, benchmark_pct: null, relative_pct: null, reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' }
      },
      institutional_flow: { status: 'missing', reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' },
      broker_flow: { status: 'missing', reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' },
      margin_financing: { status: 'missing', reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' },
      tdcc_ownership: { status: 'missing', reason: alignment.event_session ? 'not_materialized_in_this_fail_closed_snapshot' : 'event_session_unresolved' }
    };
  });

  const resolved = primaryEvents.filter(x => x.alignment.status === 'resolved').length;
  const unresolved = primaryEvents.length - resolved;
  const benchmarkLatest = latestBenchmarkDate();
  const instDates = availableDailyDates(path.join(ROOT, 'data_twse_institutional_investors'), '_twse_institutional_investors.json');
  const marginDates = availableDailyDates(path.join(ROOT, 'data_twse_margin_balance'), '_twse_margin_balance.csv');
  const miDates = availableDailyDates(path.join(ROOT, 'data_twse_mi_index'), '_twse_mi_index.json');

  return {
    schema_version: 1,
    artifact_id: 'institutional-accumulation-catalyst-outcome-association-execution-v1',
    parent_protocol: {
      path: path.relative(ROOT, PROTOCOL_PATH).replaceAll(path.sep, '/'),
      methodology_sha256: protocol.methodology.sha256,
      file_sha256: sha256(protocolBytes)
    },
    frozen_event_intelligence: {
      path: path.relative(ROOT, EVENT_PATH).replaceAll(path.sep, '/'),
      git_blob_sha1: gitBlobSha1(eventBytes),
      methodology_sha256: event.methodology_sha256
    },
    authorization: {
      owner_authorized: true,
      durable_handoff_marker_present: true,
      scope: 'institutional-accumulation-catalyst-outcome-association-execution-v1',
      protected_2454_holdout_withdrawal_authorized: false,
      score_rank_model_production_authorized: false
    },
    protocol_integrity: {
      cohort_primary_count: 11,
      left_censored_excluded_count: 169,
      captured_detail_context_count: protocol.cohort.captured_detail_context_count,
      rules_changed_after_outcome_access: false,
      fallback_alignment_added: false,
      imputation_used: false
    },
    source_coverage: {
      trading_calendar: {
        path: protocol.providers.trading_calendar.path,
        latest_eligible_date: calendarLatest,
        stale_for_all_primary_events: unresolved === 11
      },
      benchmark: { path: protocol.providers.benchmark.path, latest_date: benchmarkLatest },
      stock_price: { path: protocol.providers.stock_price.path, latest_mi_index_date: miDates.at(-1) || null },
      institutional: { path: protocol.providers.institutional.output_pattern, latest_date: instDates.at(-1) || null },
      broker: {
        path: protocol.providers.broker.daily_pattern,
        stock_1102_root_exists: existsRel('data_research/institutional-flow/histock/1102'),
        stock_1216_root_exists: existsRel('data_research/institutional-flow/histock/1216')
      },
      margin: { path: protocol.providers.margin.output_pattern, latest_date: marginDates.at(-1) || null },
      ownership: {
        path: protocol.providers.ownership.manifest,
        manifest_exists: existsRel(protocol.providers.ownership.manifest)
      }
    },
    coverage: {
      primary_events: 11,
      event_session_resolved: resolved,
      event_session_unresolved: unresolved,
      numeric_return_horizons_materialized: 0,
      institutional_windows_materialized: 0,
      broker_windows_materialized: 0,
      margin_windows_materialized: 0,
      ownership_windows_materialized: 0
    },
    primary_events: primaryEvents,
    descriptive_summary: {
      status: unresolved === 11 ? 'blocked_by_preregistered_trading_calendar_freshness' : 'partial',
      interpretation: 'Fail-closed snapshot. The preregistered trading calendar does not contain an eligible session for the primary cohort, so no event session or downstream outcome is inferred from alternate sources.',
      sample_warning: protocol.sample_warning
    },
    prohibited_outputs: protocol.rules.analysis_scope.prohibited
  };
}

function serialize() { return JSON.stringify(buildResult(), null, 2) + '\n'; }
function main(argv = process.argv.slice(2)) {
  const content = serialize();
  if (argv.includes('--write')) {
    fs.writeFileSync(OUTPUT_PATH, content);
    console.log(`wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
    return;
  }
  const checked = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (checked !== content) throw new Error('Outcome-association execution artifact is not byte-identical to deterministic regeneration');
  console.log('outcome-association execution byte-match: PASS');
}
if (require.main === module) main();
module.exports = { buildResult, serialize, resolveEventSession, gitBlobSha1 };
