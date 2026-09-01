#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  SOURCE_STATES,
  loadHistockBrokerObservation,
  loadMarginObservation,
  loadPriceObservation,
  loadTwseInstitutionalObservation,
} = require('./lib/institutional_accumulation_pit');

const ROOT = path.resolve(__dirname, '..');
const METHODOLOGY = 'institutional-accumulation-point-in-time-contract-v1';
const AUDIT_ID = 'institutional-accumulation-pit-coverage-v1';
const DEFAULT_CUTOFF = '20260831';
const DEFAULT_UNIVERSE_SIZE = 12;
const DEFAULT_SESSION_COUNT = 20;
const OUTPUT = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-pit-coverage-v1.json');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function manifestDates(relativePath, suffix, root = ROOT) {
  const list = readJson(path.join(root, relativePath), []);
  return (Array.isArray(list) ? list : [])
    .map(name => String(name).match(new RegExp(`^(20\\d{6})_${suffix.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`))?.[1] || null)
    .filter(Boolean)
    .sort();
}

function parseUniverse(root = ROOT, size = DEFAULT_UNIVERSE_SIZE) {
  const file = path.join(root, 'data_twse', 'twse_industry.csv');
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const codes = rows
    .map(line => line.split(',')[0]?.trim())
    .filter(code => /^\d{4}$/.test(code) && code !== '2454')
    .sort((a, b) => Number(a) - Number(b));
  return [...new Set(codes)].slice(0, size);
}

function intersection(arrays) {
  if (!arrays.length) return [];
  let result = new Set(arrays[0]);
  for (const list of arrays.slice(1)) {
    const next = new Set(list);
    result = new Set([...result].filter(item => next.has(item)));
  }
  return [...result].sort();
}

function selectAuditSessions(root = ROOT, cutoff = DEFAULT_CUTOFF, count = DEFAULT_SESSION_COUNT) {
  const dates = intersection([
    manifestDates('data_twse_foreign_investors/files.json', 'twse_foreign_investors', root),
    manifestDates('data_twse_investment_trust/files.json', 'twse_investment_trust', root),
    manifestDates('data_twse_dealers/files.json', 'twse_dealers', root),
    manifestDates('data_twse_margin_balance/files.json', 'twse_margin_balance', root),
  ]).filter(date => date <= cutoff);
  return dates.slice(-count);
}

function summarizeStates(observations) {
  const counts = Object.fromEntries(Object.values(SOURCE_STATES).map(state => [state, 0]));
  for (const observation of observations) {
    if (!(observation.state in counts)) throw new Error(`Unknown observation state: ${observation.state}`);
    counts[observation.state] += 1;
  }
  const total = observations.length;
  const rates = Object.fromEntries(Object.entries(counts).map(([state, count]) => [state, total ? count / total : 0]));
  return { total, counts, rates };
}

function auditSource({ universe, sessions, loader }) {
  const observations = [];
  for (const stock of universe) {
    for (const date of sessions) {
      observations.push(loader(stock, date));
    }
  }
  return summarizeStates(observations);
}

function runAudit(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const cutoff = options.cutoff || DEFAULT_CUTOFF;
  const universeSize = Number(options.universeSize || DEFAULT_UNIVERSE_SIZE);
  const sessionCount = Number(options.sessionCount || DEFAULT_SESSION_COUNT);
  const universe = parseUniverse(root, universeSize);
  const sessions = selectAuditSessions(root, cutoff, sessionCount);
  if (!universe.length) throw new Error('Coverage audit universe is empty');
  if (!sessions.length) throw new Error('Coverage audit session set is empty');

  const complete = { root, sessionComplete: true };
  const sources = {
    unified_price: auditSource({ universe, sessions, loader: (stock, date) => loadPriceObservation(stock, date, complete) }),
    foreign: auditSource({ universe, sessions, loader: (stock, date) => loadTwseInstitutionalObservation(stock, date, 'foreign', complete) }),
    investment_trust: auditSource({ universe, sessions, loader: (stock, date) => loadTwseInstitutionalObservation(stock, date, 'investment_trust', complete) }),
    dealer: auditSource({ universe, sessions, loader: (stock, date) => loadTwseInstitutionalObservation(stock, date, 'dealer', complete) }),
    margin: auditSource({ universe, sessions, loader: (stock, date) => loadMarginObservation(stock, date, complete) }),
    histock_broker: auditSource({ universe, sessions, loader: (stock, date) => loadHistockBrokerObservation(stock, date, complete) }),
  };

  return {
    audit_id: AUDIT_ID,
    methodology: METHODOLOGY,
    generated_at: new Date().toISOString(),
    outcome_blind: true,
    sample_freeze: false,
    cutoff_session: cutoff,
    selection_contract: {
      universe: `first ${universeSize} ascending four-digit TWSE codes from data_twse/twse_industry.csv, excluding protected motivation stock 2454; industry labels are ignored`,
      sessions: `latest ${sessionCount} dates <= ${cutoff} shared by foreign/investment-trust/dealer/margin manifests`,
      purpose: 'mechanical source-state coverage probe only; not development-sample selection',
    },
    universe,
    sessions,
    observation_count_per_source: universe.length * sessions.length,
    sources,
    contract_only_exclusions: {
      tdcc_history: {
        state: SOURCE_STATES.AVAILABILITY_UNSAFE,
        reason: 'production_no_lookahead_safe=false until original publication timing is independently proven',
      },
      historical_industry_relative: {
        state: SOURCE_STATES.NOT_APPLICABLE,
        reason: 'current data_twse/twse_industry.csv is not effective-dated historical membership',
      },
      catalyst_news: {
        state: SOURCE_STATES.NOT_APPLICABLE,
        reason: 'optional separate layer; only timestamp-proven evidence may later enter',
      },
    },
    forbidden_outcome_fields: [
      'forward_return', 'mfe', 'mae', 'breakout', 'repricing_success', 'failure_label', 'future_catalyst',
    ],
  };
}

function main() {
  const payload = runAudit();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(JSON.stringify({ universe: payload.universe, sessions: payload.sessions, sources: payload.sources }, null, 2));
}

if (require.main === module) main();

module.exports = {
  AUDIT_ID,
  DEFAULT_CUTOFF,
  DEFAULT_SESSION_COUNT,
  DEFAULT_UNIVERSE_SIZE,
  OUTPUT,
  intersection,
  manifestDates,
  parseUniverse,
  runAudit,
  selectAuditSessions,
  summarizeStates,
};
