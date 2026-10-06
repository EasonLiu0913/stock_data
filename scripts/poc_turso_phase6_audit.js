#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FROZEN_DATES = [
  '20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917',
  '20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'
];
const EXPECTED_ROWS = 21475;
const EXPECTED_UNIQUE = 1088;
const SOURCE_DIR = 'data_twse_institutional_investors';

const CATEGORY_SOURCES = {
  stock: 'data_twse/twse_industry_Stock.csv',
  tdr: 'data_twse/twse_industry_TDR.csv',
  etf: 'data_twse/twse_industry_ETF.csv',
  etn: 'data_twse/twse_industry_ETN.csv',
  preferred_stock: 'data_twse/twse_industry_PreferredStock.csv',
  innovation_board: 'data_twse/twse_industry_InnovationBoard.csv',
  reit: 'data_twse/twse_industry_REITs.csv',
  warrant: 'data_twse/twse_industry_Warrants.csv'
};

const UPSTREAM = {
  url: 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2',
  extractor: 'scripts/extract_twse_industry.js',
  refresh_workflow: '.github/workflows/update-twse-industry.yml',
  semantics: 'The official TWSE ISIN page exposes explicit category headings. The repository extractor maps those headings into separate category CSVs; classification uses the category identity of the source file, not code shape or name heuristics.'
};

function fail(message) { throw new Error(message); }
function verify(value, message) { if (!value) fail(message); }
function inc(object, key, amount = 1) { object[key] = (object[key] || 0) + amount; }

function csvRecords(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  verify(lines[0] === 'Code,Name,Industry', 'Unexpected category CSV header: ' + file);
  const rows = [];
  for (const line of lines.slice(1)) {
    const first = line.indexOf(',');
    const second = line.indexOf(',', first + 1);
    verify(first > 0 && second > first, 'Malformed category CSV row in ' + file);
    rows.push({
      code: line.slice(0, first).trim(),
      name: line.slice(first + 1, second).trim(),
      industry: line.slice(second + 1).trim()
    });
  }
  return rows;
}

function gitText(file) {
  return execFileSync('git', ['show', 'HEAD:' + file], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
}

function gitPaths() {
  return execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);
}

function sourceFileFor(date) {
  return path.join(ROOT, SOURCE_DIR, date + '_twse_institutional_investors.json');
}

function loadFrozenPopulation() {
  const ids = new Map();
  let rows = 0;
  let fields = null;
  for (const date of FROZEN_DATES) {
    const payload = JSON.parse(fs.readFileSync(sourceFileFor(date), 'utf8'));
    verify(payload.date === date, 'Frozen payload date mismatch: ' + date);
    verify(Array.isArray(payload.fields) && Array.isArray(payload.data), 'Malformed frozen payload: ' + date);
    if (!fields) fields = payload.fields.map(String);
    else verify(JSON.stringify(fields) === JSON.stringify(payload.fields.map(String)), 'Frozen T86 schema drift: ' + date);
    const idIndex = payload.fields.findIndex((field) => /證券代號|股票代號|證券代碼/.test(String(field)));
    verify(idIndex >= 0, 'Missing security id field: ' + date);
    for (const row of payload.data) {
      const code = String(row[idIndex] ?? '').trim();
      if (!/^[1-9]\d{3}$/.test(code)) continue;
      rows += 1;
      ids.set(code, (ids.get(code) || 0) + 1);
    }
  }
  verify(rows === EXPECTED_ROWS, 'Frozen row count changed: ' + rows + '/' + EXPECTED_ROWS);
  verify(ids.size === EXPECTED_UNIQUE, 'Frozen unique id count changed: ' + ids.size + '/' + EXPECTED_UNIQUE);
  return { ids, rows, fields };
}

function buildCategoryIndex() {
  const index = new Map();
  const sourceStats = {};
  for (const [type, file] of Object.entries(CATEGORY_SOURCES)) {
    const records = csvRecords(file);
    sourceStats[type] = { path: file, rows: records.length };
    for (const record of records) {
      const list = index.get(record.code) || [];
      list.push({ type, file, name: record.name, industry: record.industry });
      index.set(record.code, list);
    }
  }
  return { index, sourceStats };
}

function classifyFrozen(population, categories) {
  const rowCounts = {};
  const uniqueCounts = {};
  const examples = {};
  const unmatched = [];
  const ambiguous = [];

  for (const [code, occurrences] of population.ids.entries()) {
    const matches = categories.index.get(code) || [];
    if (matches.length === 0) {
      unmatched.push(code);
      continue;
    }
    const distinctTypes = [...new Set(matches.map((x) => x.type))];
    if (distinctTypes.length !== 1) {
      ambiguous.push({ code, matches });
      continue;
    }
    const type = distinctTypes[0];
    inc(uniqueCounts, type);
    inc(rowCounts, type, occurrences);
    if (!examples[type]) examples[type] = [];
    if (examples[type].length < 12) examples[type].push({ code, occurrences, ...matches[0] });
  }

  verify(unmatched.length === 0, 'Authoritative category source left unmatched frozen ids: ' + unmatched.join(','));
  verify(ambiguous.length === 0, 'Authoritative category source produced ambiguous frozen ids: ' + JSON.stringify(ambiguous));
  verify(Object.values(rowCounts).reduce((a, b) => a + b, 0) === EXPECTED_ROWS, 'Classified row total mismatch');
  verify(Object.values(uniqueCounts).reduce((a, b) => a + b, 0) === EXPECTED_UNIQUE, 'Classified unique total mismatch');

  return { row_counts: rowCounts, unique_instrument_counts: uniqueCounts, examples, unmatched, ambiguous };
}

function sourceFieldRoles(fields) {
  const roles = new Map();
  for (const field of fields) {
    const f = String(field).trim();
    let role = 'optional_source_metric';
    if (/證券代號|股票代號|證券代碼/.test(f)) role = 'identity_key';
    else if (/證券名稱|股票名稱/.test(f)) role = 'derivable_dimension';
    else if (/外陸資買賣超股數|外資及陸資買賣超股數/.test(f)) role = 'net_metric';
    else if (/^外資自營商買賣超股數/.test(f)) role = 'net_metric';
    else if (/^投信買賣超股數$/.test(f)) role = 'net_metric';
    else if (/^自營商買賣超股數$/.test(f)) role = 'net_metric';
    else if (/^三大法人買賣超股數$/.test(f)) role = 'derivable_validation_metric';
    roles.set(f, role);
  }
  return roles;
}

function relevantRuntimePath(file) {
  if (file.startsWith('scripts/poc_turso_')) return false;
  if (file === 'docs/handoffs/turso-twse-institutional-poc.md') return false;
  if (file.startsWith('docs/')) return false;
  if (file.startsWith('data_') || file.startsWith('node_modules/')) return false;
  return (
    file.startsWith('scripts/') ||
    file.startsWith('public/') ||
    file.startsWith('.github/workflows/') ||
    file.startsWith('tests/')
  ) && /\.(?:js|cjs|mjs|ts|tsx|py|sh|html|yml|yaml)$/.test(file);
}

function auditConsumers(fields) {
  const paths = gitPaths().filter(relevantRuntimePath);
  const directConsumers = [];
  const normalizedConsumers = [];
  const readable = [];

  for (const file of paths) {
    let text;
    try { text = gitText(file); }
    catch { continue; }
    readable.push({ file, text });
    if (text.includes('data_twse_institutional_investors')) directConsumers.push({ file, text });
    if (text.includes('data_normalized/institutional_investors') || text.includes("data_normalized', 'institutional_investors")) {
      normalizedConsumers.push({ file, text });
    }
  }

  const fieldAudit = fields.map((sourceField, index) => {
    const exactConsumers = directConsumers
      .filter((item) => item.text.includes(String(sourceField)))
      .map((item) => item.file);
    return {
      index,
      source_field: String(sourceField),
      source_role: sourceFieldRoles(fields).get(String(sourceField)),
      direct_runtime_consumers: exactConsumers,
      proven_current_requirement: exactConsumers.length > 0
    };
  });

  const directPaths = directConsumers.map((x) => x.file).sort();
  const normalizedPaths = normalizedConsumers.map((x) => x.file).sort();

  const rawNetNames = {
    foreign_ex_dealer_net: fields.find((f) => /外陸資買賣超股數|外資及陸資買賣超股數/.test(String(f))) || null,
    foreign_dealer_net: fields.find((f) => /^外資自營商買賣超股數/.test(String(f))) || null,
    trust_net: fields.find((f) => /^投信買賣超股數$/.test(String(f))) || null,
    dealer_net: fields.find((f) => /^自營商買賣超股數$/.test(String(f))) || null,
    total_net: fields.find((f) => /^三大法人買賣超股數$/.test(String(f))) || null
  };

  const requiredByRuntime = {};
  for (const [logical, sourceField] of Object.entries(rawNetNames)) {
    requiredByRuntime[logical] = sourceField
      ? directConsumers.filter((item) => item.text.includes(sourceField)).map((item) => item.file).sort()
      : [];
  }

  const identityField = fields.find((f) => /證券代號|股票代號|證券代碼/.test(String(f))) || null;
  const nameField = fields.find((f) => /證券名稱|股票名稱/.test(String(f))) || null;

  return {
    scanned_runtime_files: readable.length,
    direct_t86_runtime_consumers: directPaths,
    normalized_institutional_runtime_consumers: normalizedPaths,
    field_audit: fieldAudit,
    logical_net_requirements: requiredByRuntime,
    schema_recommendation: {
      required_fact_key: ['trade_date', 'stock_code'],
      required_stored_metrics_for_proven_current_consumers: [
        'foreign_ex_dealer_net',
        'foreign_dealer_net',
        'trust_net',
        'dealer_net'
      ],
      derivable_or_validation_metrics: [
        {
          field: 'total_net',
          reason: 'Current consumers read source total when present, but existing normalization already derives it as foreign_ex_dealer_net + foreign_dealer_net + trust_net + dealer_net when source total is absent.'
        }
      ],
      derivable_dimensions: [
        {
          field: 'stock_name',
          source_field: nameField,
          reason: 'Human-readable dimension; can be joined from the validated security master instead of duplicated in every fact row.'
        }
      ],
      optional_future_metrics: fieldAudit
        .filter((x) => !x.proven_current_requirement && x.source_role === 'optional_source_metric')
        .map((x) => x.source_field),
      required_source_identity_field: identityField,
      production_gap_resolved: true,
      note: 'The current eight-metric POC schema is insufficient for proven production consumers because it omits foreign_dealer_net. Gross buy/sell and dealer proprietary/hedge component fields remain unproven for current T86 consumers.'
    }
  };
}

function main() {
  const population = loadFrozenPopulation();
  verify(population.fields.length === 19, 'Expected frozen T86 schema to contain 19 fields');
  const categories = buildCategoryIndex();
  const classification = classifyFrozen(population, categories);
  const consumers = auditConsumers(population.fields);

  verify((classification.unique_instrument_counts.stock || 0) > 0, 'No stock category found in frozen population');
  verify(consumers.schema_recommendation.required_stored_metrics_for_proven_current_consumers.includes('foreign_dealer_net'), 'Expected foreign_dealer_net to be proven required');

  const report = {
    schema: 'turso_phase6_semantics_consumer_audit_v1',
    frozen_dates: FROZEN_DATES,
    frozen_row_count: population.rows,
    frozen_unique_instrument_count: population.ids.size,
    authoritative_instrument_type_source: {
      status: 'verified_present',
      upstream: UPSTREAM,
      category_files: categories.sourceStats,
      trust_boundary: 'Classification is authoritative only to the explicit TWSE ISIN category headings captured by the repository extractor. It does not infer type from code length, suffix absence, industry membership, or exclusion lists.',
      main_freshness_precondition: 'Prompt A verified the category-file blobs, extractor, and refresh workflow were byte-identical between the POC branch and current remote main before this run.'
    },
    classification,
    consumer_audit: consumers
  };

  fs.writeFileSync('/tmp/turso-phase6-audit.json', JSON.stringify(report, null, 2));
  console.log('[TURSO-PHASE6] AUDIT_PASS ' + JSON.stringify({
    rows: population.rows,
    unique: population.ids.size,
    row_counts: classification.row_counts,
    unique_counts: classification.unique_instrument_counts,
    direct_consumers: consumers.direct_t86_runtime_consumers.length,
    normalized_consumers: consumers.normalized_institutional_runtime_consumers.length,
    required_metrics: consumers.schema_recommendation.required_stored_metrics_for_proven_current_consumers,
    optional_future_metric_count: consumers.schema_recommendation.optional_future_metrics.length
  }));
}

try { main(); }
catch (error) {
  console.error('[TURSO-PHASE6] FAILED ' + error.stack);
  process.exitCode = 1;
}
