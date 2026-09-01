#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateDailyPayload } = require('./lib/histock_broker_quality');
const { deriveReferenceResponseBytes, assessPersistedStatus } = require('./lib/histock_broker_status_policy');

const METHODOLOGY = 'institutional-withdrawal-untouched-expansion-protocol-v1';
const SEED = 'institutional-withdrawal-validation-expansion-v1';
const START = '2026-04-01';
const END = '2026-08-21';
const DEVELOPMENT = ['2330','2317','2454','2382','2303','2449'];
const PRIOR_HOLDOUT = ['1598','1616','1809','6257','7791'];
const PERMANENT_EXCLUSIONS = new Set([...DEVELOPMENT, ...PRIOR_HOLDOUT]);
const MIN_COMMON = 40;
const MIN_RATIO = 0.80;
const MIN_TDCC = 3;
const MIN_BROKER = 40;
const VALID_STATES = [
  'coverage_ready',
  'coverage_pending_tdcc',
  'coverage_pending_broker',
  'coverage_terminal_ineligible_common_source',
  'coverage_terminal_ineligible_tdcc',
  'coverage_terminal_ineligible_broker',
];

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const output = arg('output', path.join('data_research','institutional-flow','validation','batch-2-coverage-state-v1.json'));
const sampleFreeze = arg('sample-freeze', '');
const githubOutput = arg('github-output', '');
const foreignRoot = arg('foreign-root', 'data_twse_foreign_investors');
const ohlcvRoot = arg('ohlcv-root', 'data_fubon');
const tdccRoot = arg('tdcc-root', path.join('data_tdcc_shareholding','history'));
const brokerRoot = arg('broker-root', path.join('data_research','institutional-flow','histock'));
const protectedOutcomeBlob = arg('protected-outcome-blob', '82fefaa25becce30a461c36cb85eba36dda44b8f');
const protectedMetricsBlob = arg('protected-metrics-blob', '709eb1772bfbb0040257fc78d84adeda3626e98c');

const iso = (raw) => `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
const ymd = (d) => d.replaceAll('-','');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const hashKey = (stock) => crypto.createHash('sha256').update(`${SEED}|${stock}`).digest('hex');

function sourceTradingDates() {
  if (!isDir(foreignRoot)) throw new Error(`Missing foreign root: ${foreignRoot}`);
  const dates = [];
  for (const name of fs.readdirSync(foreignRoot).filter((n)=>/^\d{8}_twse_foreign_investors\.json$/.test(n)).sort()) {
    const raw = name.slice(0,8); const d = iso(raw);
    if (d < START || d > END) continue;
    const p = readJson(path.join(foreignRoot,name));
    if (p.stat !== 'OK' || String(p.date) !== raw || !Array.isArray(p.data)) throw new Error(`Invalid foreign calendar payload: ${name}`);
    dates.push(d);
  }
  if (dates.length < MIN_COMMON) throw new Error(`Source-derived calendar has only ${dates.length} sessions`);
  return dates;
}

function foreignPresence(dates) {
  const map = new Map();
  for (const d of dates) {
    const p = readJson(path.join(foreignRoot, `${ymd(d)}_twse_foreign_investors.json`));
    for (const row of p.data || []) {
      const stock = String(row?.[1] || '').trim();
      if (!/^\d{4}$/.test(stock)) continue;
      if (!map.has(stock)) map.set(stock,new Set());
      map.get(stock).add(d);
    }
  }
  return map;
}

function ohlcvPresence(dates) {
  const map = new Map();
  for (const d of dates) {
    const file = path.join(ohlcvRoot, `fubon_${ymd(d)}_sma.json`);
    if (!fs.existsSync(file)) continue;
    let p; try { p = readJson(file); } catch { continue; }
    const slash = d.replaceAll('-','/');
    for (const [stock,byDate] of Object.entries(p)) {
      if (!/^\d{4}$/.test(stock)) continue;
      const row = byDate?.[slash]; if (!row) continue;
      if (![row.Price,row.Open,row.High,row.Low,row.Volume].map(Number).every(Number.isFinite)) continue;
      if (!map.has(stock)) map.set(stock,new Set());
      map.get(stock).add(d);
    }
  }
  return map;
}

function tdccEvidence(stock) {
  const root = path.join(tdccRoot, stock);
  const observations = [];
  if (isDir(root)) {
    for (const name of fs.readdirSync(root).filter((n)=>/^\d{8}\.json$/.test(n)).sort()) {
      try {
        const p = readJson(path.join(root,name));
        const d = String(p.observed_date || '');
        if (p.source === 'tdcc_official_historical_query' && p.stock === stock && p.historical_backfill === true && d >= START && d <= END && Number.isFinite(p.derived?.large_holder_pct) && Number.isFinite(p.derived?.small_holder_pct)) observations.push(d);
      } catch (_) {}
    }
  }
  let attemptComplete = false;
  const manifestFile = path.join(root,'manifest.json');
  if (fs.existsSync(manifestFile)) {
    try {
      const m = readJson(manifestFile);
      attemptComplete = m.source === 'tdcc_official_historical_query' && m.stock === stock && m.range?.start === START && m.range?.end === END && Number(m.requested_dates) > 0 && Array.isArray(m.failed_dates) && m.failed_dates.length === 0;
    } catch (_) {}
  }
  return { observations:[...new Set(observations)].sort(), attempt_complete: attemptComplete, manifest: fs.existsSync(manifestFile) ? manifestFile : null };
}

function brokerEvidence(stock, commonDates) {
  const root = path.join(brokerRoot, stock);
  const dailyRoot = path.join(root,'daily');
  const statusRoot = path.join(root,'batch-status');
  const referenceResponseBytes = deriveReferenceResponseBytes(root);
  const valid=[]; const terminal=[]; const retryable=[];
  for (const d of commonDates) {
    const daily = path.join(dailyRoot, `${ymd(d)}.json`);
    if (fs.existsSync(daily)) {
      try {
        const p = readJson(daily);
        if (validateDailyPayload(p,{stock,date:d}).valid) { valid.push(d); continue; }
      } catch (_) {}
    }
    const status = path.join(statusRoot, `exact-source-date-${ymd(d)}.json`);
    if (!fs.existsSync(status)) { retryable.push({date:d,classification:'missing'}); continue; }
    try {
      const p = readJson(status);
      const a = assessPersistedStatus(p,{referenceResponseBytes});
      if (a.terminal) terminal.push({date:d,outcome:p.outcome || null,classification:a.classification});
      else retryable.push({date:d,outcome:p.outcome || null,classification:a.classification});
    } catch (_) { retryable.push({date:d,classification:'invalid_status'}); }
  }
  return { valid_dates:valid, terminal_dates:terminal, retryable_dates:retryable, reference_response_bytes:referenceResponseBytes };
}

function classifyRow({stock,key,calendar,foreignSet,ohlcvSet}) {
  const common = calendar.filter((d)=>foreignSet.has(d) && ohlcvSet.has(d));
  const ratio = calendar.length ? common.length/calendar.length : 0;
  const base = { stock, expansion_order_key:key, common_source_sessions:common.length, common_source_ratio:Number(ratio.toFixed(6)), common_source_dates:common };
  if (common.length < MIN_COMMON || ratio < MIN_RATIO) return {...base, coverage_state:'coverage_terminal_ineligible_common_source', tdcc_observations:0, normalized_broker_days:0};
  const tdcc = tdccEvidence(stock);
  if (tdcc.observations.length < MIN_TDCC) {
    return {...base, coverage_state:tdcc.attempt_complete ? 'coverage_terminal_ineligible_tdcc':'coverage_pending_tdcc', tdcc_observations:tdcc.observations.length, tdcc_attempt_complete:tdcc.attempt_complete, normalized_broker_days:0};
  }
  const broker = brokerEvidence(stock, common);
  if (broker.valid_dates.length >= MIN_BROKER) return {...base, coverage_state:'coverage_ready', tdcc_observations:tdcc.observations.length, tdcc_attempt_complete:tdcc.attempt_complete, normalized_broker_days:broker.valid_dates.length, broker_terminal_dates:broker.terminal_dates.length, broker_retryable_dates:broker.retryable_dates};
  if (broker.retryable_dates.length === 0) return {...base, coverage_state:'coverage_terminal_ineligible_broker', tdcc_observations:tdcc.observations.length, tdcc_attempt_complete:tdcc.attempt_complete, normalized_broker_days:broker.valid_dates.length, broker_terminal_dates:broker.terminal_dates.length, broker_retryable_dates:[]};
  return {...base, coverage_state:'coverage_pending_broker', tdcc_observations:tdcc.observations.length, tdcc_attempt_complete:tdcc.attempt_complete, normalized_broker_days:broker.valid_dates.length, broker_terminal_dates:broker.terminal_dates.length, broker_retryable_dates:broker.retryable_dates};
}

function selectSample(rows, target=10) {
  const selected=[]; let blocking=null; let lastExamined=-1;
  for (let i=0;i<rows.length;i++) {
    const r=rows[i]; lastExamined=i;
    if (r.coverage_state === 'coverage_ready') selected.push(r);
    else if (r.coverage_state === 'coverage_pending_tdcc' || r.coverage_state === 'coverage_pending_broker') { blocking=r; break; }
    if (selected.length === target) break;
  }
  const exactTarget = selected.length === target;
  const fullyResolved = !blocking && lastExamined === rows.length-1;
  return {selected,blocking,last_examined_index:lastExamined,sample_determined:exactTarget || fullyResolved,terminal_smaller_batch:fullyResolved && selected.length < target};
}

function main() {
  const calendar=sourceTradingDates(); const foreign=foreignPresence(calendar); const ohlcv=ohlcvPresence(calendar);
  const universe=[...new Set([...foreign.keys(),...ohlcv.keys()])].filter((s)=>!PERMANENT_EXCLUSIONS.has(s));
  const ordered=universe.map((stock)=>({stock,key:hashKey(stock)})).sort((a,b)=>a.key.localeCompare(b.key)||a.stock.localeCompare(b.stock));
  const rows=ordered.map(({stock,key},position)=>({...classifyRow({stock,key,calendar,foreignSet:foreign.get(stock)||new Set(),ohlcvSet:ohlcv.get(stock)||new Set()}), deterministic_position:position+1}));
  for (const r of rows) if (!VALID_STATES.includes(r.coverage_state)) throw new Error(`Invalid state ${r.coverage_state}`);
  const selection=selectSample(rows,10);
  const payload={schema_version:1,methodology:METHODOLOGY,generated_without_outcomes:true,anchor_range:{start:START,end:END},calendar:{source:'valid TWSE foreign-investor daily files',forbidden_calendar:'data_history_sma/trading_days.json',sessions:calendar.length,first:calendar[0],last:calendar.at(-1)},permanent_exclusions:{development:DEVELOPMENT,prior_holdout:PRIOR_HOLDOUT},ordering:{algorithm:'sha256(seed|stock)',seed:SEED,tie_break:'stock ascending'},coverage_gate:{minimum_tdcc_observations:MIN_TDCC,minimum_common_sessions:MIN_COMMON,minimum_common_ratio:MIN_RATIO,minimum_normalized_broker_days:MIN_BROKER},counts:Object.fromEntries(VALID_STATES.map((s)=>[s,rows.filter((r)=>r.coverage_state===s).length])),selection:{sample_determined:selection.sample_determined,terminal_smaller_batch:selection.terminal_smaller_batch,selected_stocks:selection.selected.map((r)=>r.stock),blocking_candidate:selection.blocking?{stock:selection.blocking.stock,state:selection.blocking.coverage_state,position:selection.blocking.deterministic_position,key:selection.blocking.expansion_order_key}:null,last_examined_index:selection.last_examined_index},rows,generated_at:new Date().toISOString()};
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
  if (sampleFreeze && selection.sample_determined) {
    const evidenceRows=rows.slice(0,selection.last_examined_index+1).map((r)=>({stock:r.stock,deterministic_position:r.deterministic_position,expansion_order_key:r.expansion_order_key,coverage_state:r.coverage_state,tdcc_observations:r.tdcc_observations,common_source_sessions:r.common_source_sessions,common_source_ratio:r.common_source_ratio,normalized_broker_days:r.normalized_broker_days}));
    const freeze={schema_version:1,methodology:METHODOLOGY,batch:2,generated_without_outcomes:true,anchor_range:{start:START,end:END},stocks:selection.selected.map((r)=>r.stock),deterministic_members:selection.selected.map((r)=>({stock:r.stock,deterministic_position:r.deterministic_position,expansion_order_key:r.expansion_order_key})),coverage_state_artifact:path.relative('.',output),protected_batch_1_blobs:{validation_outcomes_v1:protectedOutcomeBlob,validation_metrics_v1:protectedMetricsBlob},earlier_candidate_resolution:evidenceRows,terminal_smaller_batch:selection.terminal_smaller_batch,generated_at:new Date().toISOString()};
    fs.mkdirSync(path.dirname(sampleFreeze),{recursive:true}); fs.writeFileSync(sampleFreeze,JSON.stringify(freeze,null,2)+'\n');
  }
  if (githubOutput) {
    fs.appendFileSync(githubOutput,`sample_determined=${selection.sample_determined}\n`);
    fs.appendFileSync(githubOutput,`selected_stocks=${selection.selected.map((r)=>r.stock).join(',')}\n`);
    fs.appendFileSync(githubOutput,`blocking_stock=${selection.blocking?.stock||''}\n`);
    fs.appendFileSync(githubOutput,`blocking_state=${selection.blocking?.coverage_state||''}\n`);
  }
  console.log(JSON.stringify({methodology:METHODOLOGY,counts:payload.counts,selection:payload.selection},null,2));
}

if (require.main === module) main();
module.exports={METHODOLOGY,SEED,DEVELOPMENT,PRIOR_HOLDOUT,VALID_STATES,hashKey,selectSample};
