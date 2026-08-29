#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const hasArg = (name) => args.includes(`--${name}`);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stock = getArg('stock', '2449');
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-07-31');
const fixture = getArg('tdcc-fixture', path.join('data_research', 'institutional-flow', 'tdcc-fixtures', `${stock}-2026Q2.json`));
const tdccRoot = getArg('tdcc-root', path.join('data_tdcc_shareholding', 'stocks'));
const tdccMode = getArg('tdcc-mode', hasArg('tdcc-fixture') ? 'fixture' : 'auto');
const output = getArg('output', path.join('data_research', 'institutional-flow', 'scores', `${stock}.json`));
const dailyDir = path.join('data_research', 'institutional-flow', 'histock', stock, 'daily');
const tradingFile = path.join('data_history_sma', 'trading_days.json');

const normalize = (v) => String(v).replaceAll('/', '-');
const ymd = (d) => d.replaceAll('-', '');
const round = (v, n = 2) => Number(Number(v).toFixed(n));

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function loadTradingDays() {
  const p = readJson(tradingFile);
  return [...new Set(Object.values(p).flat().map(normalize))].filter((d) => d >= start && d <= end).sort();
}
function readBrokerDay(date) {
  const file = path.join(dailyDir, `${ymd(date)}.json`);
  if (!fs.existsSync(file)) return null;
  const p = readJson(file);
  if (p.stock !== stock || p.date !== date || p.source !== 'histock' || p.research_only !== true || !Array.isArray(p.records) || !p.records.length) return null;
  return p;
}
function brokerEvidence(days, index) {
  const today = days[index];
  const rows = today?.records || [];
  const negative = rows.filter((r) => Number(r.net) < 0);
  const dailyNegativeNet = negative.reduce((sum, r) => sum + Number(r.net), 0);
  const slice = days.slice(Math.max(0, index - 4), index + 1);
  const map = new Map();
  for (const day of slice) {
    for (const r of day.records) {
      const a = map.get(r.broker) || { broker: r.broker, total_net: 0, appearances: 0, sell_days: 0 };
      a.total_net += Number(r.net); a.appearances += 1;
      if (Number(r.net) < 0) a.sell_days += 1;
      map.set(r.broker, a);
    }
  }
  const persistent = [...map.values()].filter((x) => x.total_net < 0 && x.sell_days >= 2).sort((a, b) => a.total_net - b.total_net);
  const persistentNet = persistent.reduce((sum, x) => sum + x.total_net, 0);
  let score = 0; const reasons = [];
  if (negative.length >= 8) { score += 1; reasons.push(`daily_negative_breadth:${negative.length}`); }
  if (dailyNegativeNet <= -6000) { score += 1; reasons.push(`daily_negative_net:${round(dailyNegativeNet)}`); }
  if (persistent.length >= 5) { score += 1; reasons.push(`persistent_5d_sellers:${persistent.length}`); }
  if (persistentNet <= -8000) { score += 1; reasons.push(`persistent_5d_net:${round(persistentNet)}`); }
  return { score, reasons, daily_negative_breadth: negative.length, daily_negative_net: round(dailyNegativeNet), persistent_5d_sellers: persistent.length, persistent_5d_net: round(persistentNet), top_persistent_sellers: persistent.slice(0, 8) };
}
function tdccEvidence(prev, curr) {
  if (!prev) return { score: 0, reasons: [], large_change_pp: null, small_change_pp: null };
  const large = round(curr.large_holder_pct - prev.large_holder_pct);
  const small = round(curr.small_holder_pct - prev.small_holder_pct);
  let score = 0; const reasons = [];
  if (large <= -1) { score += 1; reasons.push(`large_holder_1w:${large}pp`); }
  if (small >= 0.75) { score += 1; reasons.push(`small_holder_1w:+${small}pp`); }
  if (large <= -2 && small >= 2) { score += 2; reasons.push('ownership_transfer_confirmed'); }
  if (large <= -5 && small >= 5) { score += 3; reasons.push('ownership_transfer_extreme'); }
  return { score, reasons, large_change_pp: large, small_change_pp: small };
}
function rawLevel(score) {
  if (score >= 8) return 'red';
  if (score >= 5) return 'orange';
  if (score >= 3) return 'yellow';
  return 'watch';
}
const rank = { watch: 0, yellow: 1, orange: 2, red: 3 };

function loadFixture() {
  const p = readJson(fixture);
  if (p.stock !== stock || p.research_only !== true) throw new Error('Invalid TDCC research fixture');
  return {
    kind: 'fixture',
    research_only: true,
    production_safe: false,
    availability_policy: p.availability_policy,
    observations: p.observations.map((x) => ({ ...x, source: p.source })),
  };
}
function loadOfficial() {
  const dir = path.join(tdccRoot, stock);
  if (!fs.existsSync(dir)) return null;
  const observations = fs.readdirSync(dir).filter((n) => /^\d{8}\.json$/.test(n)).sort().map((name) => readJson(path.join(dir, name))).filter((p) =>
    p.source === 'tdcc_official_openapi_1_5' && p.production_safe === true && p.observed_date >= start && p.observed_date <= end && p.available_at && p.derived
  ).map((p) => ({
    observed_date: p.observed_date,
    available_at: p.available_at,
    large_holder_pct: Number(p.derived.large_holder_pct),
    small_holder_pct: Number(p.derived.small_holder_pct),
    source: p.source,
  }));
  if (!observations.length) return null;
  return {
    kind: 'official', research_only: false, production_safe: true,
    availability_policy: 'official canonical uses first successful archive capture timestamp', observations,
  };
}
function loadTdcc() {
  if (tdccMode === 'fixture') return loadFixture();
  if (tdccMode === 'official') {
    const p = loadOfficial();
    if (!p) throw new Error(`No official TDCC canonical data for ${stock} in ${start}..${end}`);
    return p;
  }
  if (tdccMode !== 'auto') throw new Error(`Unknown --tdcc-mode ${tdccMode}`);
  return loadOfficial() || loadFixture();
}

const tdccPayload = loadTdcc();
const observations = tdccPayload.observations.filter((x) => x.observed_date >= start && x.observed_date <= end).sort((a, b) => a.observed_date.localeCompare(b.observed_date));
for (const o of observations) {
  if (!o.available_at) throw new Error(`Missing available_at for ${o.observed_date}`);
  if (!Number.isFinite(Number(o.large_holder_pct)) || !Number.isFinite(Number(o.small_holder_pct))) throw new Error(`Invalid TDCC percentages for ${o.observed_date}`);
}
const tradingDays = loadTradingDays();
const brokerDays = tradingDays.map(readBrokerDay).filter(Boolean);
const brokerIndex = new Map(brokerDays.map((d, i) => [d.date, i]));
let carriedLevel = 'watch'; let recoveryStreak = 0;
const timeline = [];
for (let i = 0; i < observations.length; i += 1) {
  const obs = observations[i];
  const idx = brokerIndex.get(obs.observed_date);
  if (idx === undefined) continue;
  const broker = brokerEvidence(brokerDays, idx);
  const tdcc = tdccEvidence(observations[i - 1], obs);
  const score = broker.score + tdcc.score;
  const candidate = rawLevel(score);
  const improving = tdcc.large_change_pp !== null && tdcc.large_change_pp > 1 && tdcc.small_change_pp < -1;
  recoveryStreak = improving ? recoveryStreak + 1 : 0;
  if (rank[candidate] > rank[carriedLevel]) carriedLevel = candidate;
  else if (rank[candidate] < rank[carriedLevel] && recoveryStreak >= 2) carriedLevel = candidate;
  timeline.push({
    observed_date: obs.observed_date,
    available_at: obs.available_at,
    action_eligible_after: obs.available_at,
    score, raw_level: candidate, level: carriedLevel,
    evidence: { broker, tdcc, tdcc_source: obs.source },
  });
}
const payload = {
  schema_version: 2,
  methodology: 'institutional-distribution-score-v2',
  stock,
  research_only: tdccPayload.research_only,
  production_safe: tdccPayload.production_safe,
  tdcc_input: { mode: tdccPayload.kind, availability_policy: tdccPayload.availability_policy, observations: observations.length },
  no_lookahead_contract: {
    scoring_evidence_date: 'observed_date',
    action_gate: 'available_at',
    rule: 'signals may only be acted on at or after action_eligible_after',
    availability_policy: tdccPayload.availability_policy,
  },
  limitations: [
    'HiStock exposes ranked broker rows rather than the complete official TWSE broker ledger.',
    tdccPayload.kind === 'fixture' ? 'TDCC inputs are a manually verified research fixture and not a production data feed.' : 'TDCC availability is conservatively timestamped at this repository first successful archive capture, which may be later than actual publication.',
    'Broker branch activity must not be interpreted as beneficial-owner identity.',
    'Foreign flow is intentionally not a mandatory confirmation condition.',
  ],
  generated_at: new Date().toISOString(), range: { start, end }, timeline,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(timeline.map(({ observed_date, score, raw_level, level, evidence }) => ({ observed_date, score, raw_level, level, large_change_pp: evidence.tdcc.large_change_pp, small_change_pp: evidence.tdcc.small_change_pp, broker_score: evidence.broker.score })), null, 2));
console.log(`tdcc_mode=${tdccPayload.kind} production_safe=${payload.production_safe} output=${output}`);
