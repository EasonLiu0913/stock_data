#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getClose } = require('./lib/stock_price_provider');

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
function existsRel(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function parseNumeric(value) {
  if (value == null) return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}

function benchmarkMap() {
  const payload = readJson(BENCHMARK_PATH);
  return new Map((payload.data || []).map(row => [compactDate(row.date), Number(row.close)]));
}

function tradingIndex(tradingDays, date) {
  return tradingDays.indexOf(date);
}

function horizonDate(tradingDays, eventSession, horizonCount) {
  const idx = tradingIndex(tradingDays, eventSession);
  if (idx < 0) return null;
  return tradingDays[idx + horizonCount - 1] || null;
}

function previousEligibleDate(tradingDays, eventSession) {
  const idx = tradingIndex(tradingDays, eventSession);
  return idx > 0 ? tradingDays[idx - 1] : null;
}

function pctReturn(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null;
  return 100 * (end / start - 1);
}

function materializeReturn(stock, eventSession, horizonCount, tradingDays, bench) {
  if (!eventSession) return { status:'missing', value_pct:null, benchmark_pct:null, relative_pct:null, reason:'event_session_unresolved' };
  const baselineDate = previousEligibleDate(tradingDays, eventSession);
  const targetDate = horizonDate(tradingDays, eventSession, horizonCount);
  if (!baselineDate || !targetDate) {
    return { status:'missing', value_pct:null, benchmark_pct:null, relative_pct:null, baseline_date:baselineDate, target_date:targetDate, reason:'immature_trading_horizon' };
  }
  const baselineClose = getClose(stock, baselineDate, { root: ROOT });
  const targetClose = getClose(stock, targetDate, { root: ROOT });
  const benchmarkBaseline = bench.get(baselineDate) ?? null;
  const benchmarkTarget = bench.get(targetDate) ?? null;
  if (![baselineClose,targetClose,benchmarkBaseline,benchmarkTarget].every(Number.isFinite)) {
    return { status:'missing', value_pct:null, benchmark_pct:null, relative_pct:null, baseline_date:baselineDate, target_date:targetDate, reason:'required_close_missing' };
  }
  const valuePct = pctReturn(baselineClose,targetClose);
  const benchmarkPct = pctReturn(benchmarkBaseline,benchmarkTarget);
  return {
    status:'materialized',
    baseline_date:baselineDate,
    target_date:targetDate,
    baseline_close:baselineClose,
    target_close:targetClose,
    benchmark_baseline_close:benchmarkBaseline,
    benchmark_target_close:benchmarkTarget,
    value_pct:valuePct,
    benchmark_pct:benchmarkPct,
    relative_pct:valuePct - benchmarkPct
  };
}

function findFieldIndex(fields, predicates) {
  return fields.findIndex(field => predicates.some(p => p(field)));
}

function loadInstitutionalRow(stock, date) {
  const file = path.join(ROOT, 'data_twse_institutional_investors', `${date}_twse_institutional_investors.json`);
  if (!fs.existsSync(file)) return null;
  const payload = readJson(file);
  const fields = payload.fields || [];
  const rows = payload.data || [];
  const codeIdx = fields.indexOf('證券代號');
  const row = rows.find(r => String(r?.[codeIdx] || '').trim() === String(stock));
  if (!row) return null;
  const foreignIdx = findFieldIndex(fields, [f => f.includes('外陸資買賣超股數')]);
  const trustIdx = findFieldIndex(fields, [f => f.includes('投信買賣超股數')]);
  const dealerIdx = findFieldIndex(fields, [f => f === '自營商買賣超股數']);
  const totalIdx = findFieldIndex(fields, [f => f.includes('三大法人買賣超股數')]);
  return {
    date,
    foreign_net: foreignIdx >= 0 ? parseNumeric(row[foreignIdx]) : null,
    investment_trust_net: trustIdx >= 0 ? parseNumeric(row[trustIdx]) : null,
    dealer_net: dealerIdx >= 0 ? parseNumeric(row[dealerIdx]) : null,
    three_institutions_net: totalIdx >= 0 ? parseNumeric(row[totalIdx]) : null
  };
}

function sumInstitutionalWindow(stock, dates) {
  if (!dates || !dates.length) return { status:'missing', reason:'window_dates_unavailable' };
  const rows = dates.map(date => loadInstitutionalRow(stock,date));
  const missingDates = dates.filter((_,i) => !rows[i]);
  if (missingDates.length) return { status:'missing', dates, missing_dates:missingDates, reason:'institutional_source_missing' };
  const metrics = ['foreign_net','investment_trust_net','dealer_net','three_institutions_net'];
  const sums = {};
  for (const m of metrics) {
    if (rows.some(r => !Number.isFinite(r[m]))) sums[m] = null;
    else sums[m] = rows.reduce((a,r)=>a+r[m],0);
  }
  return { status:'materialized', dates, ...sums };
}

function windowBefore(tradingDays,eventSession,count) {
  const idx=tradingIndex(tradingDays,eventSession);
  return idx >= count ? tradingDays.slice(idx-count,idx) : null;
}
function windowFrom(tradingDays,eventSession,count) {
  const idx=tradingIndex(tradingDays,eventSession);
  if (idx < 0 || idx+count > tradingDays.length) return null;
  return tradingDays.slice(idx,idx+count);
}

function parseCsvLine(line) {
  const out=[]; let cur=''; let quoted=false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch === '"') quoted=!quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur=''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function loadMarginRow(stock,date) {
  const file=path.join(ROOT,'data_twse_margin_balance',`${date}_twse_margin_balance.csv`);
  if (!fs.existsSync(file)) return null;
  const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/);
  if (!lines.length) return null;
  const header=parseCsvLine(lines[0]);
  const codeIdx=header.indexOf('股票代號');
  const finIdx=header.indexOf('融資今日餘額');
  const shortIdx=header.indexOf('融券今日餘額');
  for (const line of lines.slice(1)) {
    const row=parseCsvLine(line);
    if (String(row[codeIdx]||'').trim() !== String(stock)) continue;
    return { date, financing_balance:parseNumeric(row[finIdx]), short_balance:parseNumeric(row[shortIdx]) };
  }
  return null;
}

function materializeMargin(stock,eventSession,tradingDays) {
  if (!eventSession) return { status:'missing', reason:'event_session_unresolved' };
  const baselineDate=previousEligibleDate(tradingDays,eventSession);
  const baseline=baselineDate ? loadMarginRow(stock,baselineDate) : null;
  const event=loadMarginRow(stock,eventSession);
  const eventWindow = baseline && event && Number.isFinite(baseline.financing_balance) && Number.isFinite(event.financing_balance)
    ? {
        status:'materialized',
        baseline_date:baselineDate,
        event_date:eventSession,
        financing_balance_change:event.financing_balance-baseline.financing_balance,
        short_balance_change:Number.isFinite(baseline.short_balance)&&Number.isFinite(event.short_balance) ? event.short_balance-baseline.short_balance : null,
        baseline,
        event
      }
    : { status:'missing', baseline_date:baselineDate, event_date:eventSession, reason:'margin_baseline_or_event_missing' };
  return {
    status:eventWindow.status === 'materialized' ? 'partial' : 'missing',
    event_window:eventWindow,
    D3:{ status:'missing', reason:horizonDate(tradingDays,eventSession,3)?'not_materialized':'immature_trading_horizon' },
    D5:{ status:'missing', reason:horizonDate(tradingDays,eventSession,5)?'not_materialized':'immature_trading_horizon' }
  };
}

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
  const bench = benchmarkMap();
  const primaryEvents = protocol.cohort.primary_events.map(row => {
    const alignment = resolveEventSession(row.first_seen_at, tradingDays);
    const eventSession = alignment.event_session;
    const preDates = eventSession ? windowBefore(tradingDays,eventSession,5) : null;
    const eventDates = eventSession ? [eventSession] : null;
    const post3Dates = eventSession ? windowFrom(tradingDays,eventSession,3) : null;
    const post5Dates = eventSession ? windowFrom(tradingDays,eventSession,5) : null;
    return {
      event_identity: row.event_identity,
      stock: row.stock,
      first_seen_at: row.first_seen_at,
      source_reported_at: row.source_reported_at,
      first_listing_taxonomy: row.first_listing_taxonomy,
      first_listing_features: row.first_listing_features,
      alignment,
      stock_session_cluster_id: eventSession ? `${row.stock}|${eventSession}` : null,
      returns: {
        D1: materializeReturn(row.stock,eventSession,1,tradingDays,bench),
        D3: materializeReturn(row.stock,eventSession,3,tradingDays,bench),
        D5: materializeReturn(row.stock,eventSession,5,tradingDays,bench)
      },
      institutional_flow: eventSession ? {
        status:'partial',
        pre_T5_T1: sumInstitutionalWindow(row.stock,preDates),
        event_T0: sumInstitutionalWindow(row.stock,eventDates),
        post_T0_T2: post3Dates ? sumInstitutionalWindow(row.stock,post3Dates) : {status:'missing',reason:'immature_trading_horizon'},
        post_T0_T4: post5Dates ? sumInstitutionalWindow(row.stock,post5Dates) : {status:'missing',reason:'immature_trading_horizon'}
      } : { status:'missing', reason:'event_session_unresolved' },
      broker_flow: { status: 'missing', reason: eventSession ? 'preregistered_histock_stock_root_unavailable' : 'event_session_unresolved' },
      margin_financing: materializeMargin(row.stock,eventSession,tradingDays),
      tdcc_ownership: { status: 'missing', reason: eventSession ? 'pit_safe_archived_snapshot_join_not_available' : 'event_session_unresolved' }
    };
  });

  const resolved = primaryEvents.filter(x => x.alignment.status === 'resolved').length;
  const unresolved = primaryEvents.length - resolved;
  const benchmarkLatest = latestBenchmarkDate();
  const observedRepositoryDate = calendarLatest || '20260923';

  return {
    schema_version: 1,
    artifact_id: 'institutional-accumulation-catalyst-outcome-association-execution-v1',
    parent_protocol: {
      path: path.relative(ROOT, PROTOCOL_PATH).replaceAll(path.sep, '/'),
      methodology_sha256: protocol.methodology.sha256,
      git_blob_sha1: gitBlobSha1(protocolBytes)
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
      stock_price: {
        path: protocol.providers.stock_price.path,
        observed_repository_date: observedRepositoryDate,
        observed_date_file_exists: existsRel(`data_twse_mi_index/${observedRepositoryDate}_twse_mi_index.json`)
      },
      institutional: {
        path: protocol.providers.institutional.output_pattern,
        observed_repository_date: observedRepositoryDate,
        observed_date_file_exists: existsRel(`data_twse_institutional_investors/${observedRepositoryDate}_twse_institutional_investors.json`)
      },
      broker: {
        path: protocol.providers.broker.daily_pattern,
        stock_1102_root_exists: existsRel('data_research/institutional-flow/histock/1102'),
        stock_1216_root_exists: existsRel('data_research/institutional-flow/histock/1216')
      },
      margin: {
        path: protocol.providers.margin.output_pattern,
        observed_repository_date: observedRepositoryDate,
        observed_date_file_exists: existsRel(`data_twse_margin_balance/${observedRepositoryDate}_twse_margin_balance.csv`)
      },
      ownership: {
        path: protocol.providers.ownership.manifest,
        manifest_exists: existsRel(protocol.providers.ownership.manifest)
      }
    },
    coverage: {
      primary_events: 11,
      event_session_resolved: resolved,
      event_session_unresolved: unresolved,
      numeric_return_horizons_materialized: primaryEvents.reduce((n,e)=>n+['D1','D3','D5'].filter(h=>e.returns[h].status==='materialized').length,0),
      institutional_windows_materialized: primaryEvents.reduce((n,e)=>n+(['pre_T5_T1','event_T0','post_T0_T2','post_T0_T4'].filter(k=>e.institutional_flow?.[k]?.status==='materialized').length),0),
      broker_windows_materialized: 0,
      margin_windows_materialized: primaryEvents.reduce((n,e)=>n+(e.margin_financing?.event_window?.status==='materialized'?1:0),0),
      ownership_windows_materialized: 0
    },
    primary_events: primaryEvents,
    descriptive_summary: {
      status: resolved > 0 ? 'partial_materialization' : 'blocked_by_preregistered_trading_calendar_freshness',
      interpretation: resolved > 0
        ? 'Canonical trading-calendar freshness is restored through the latest durable session. Mature preregistered windows are materialized; later horizons remain explicit missing.'
        : 'Fail-closed snapshot. The preregistered trading calendar does not contain an eligible session for the primary cohort, so no event session or downstream outcome is inferred from alternate sources.',
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
