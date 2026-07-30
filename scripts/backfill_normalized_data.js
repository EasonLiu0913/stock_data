'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ASSERTION_CODES = ['1101', '1102', '3231'];
const BROKER_BRANCH_DETAIL_LIMIT = 5;
const TYPES = {
  institutional: {
    sourceDir: 'data_twse_institutional_investors',
    outputDir: 'data_normalized/institutional_investors',
    sourcePattern: /^(\d{8})_twse_institutional_investors\.json$/,
    schemaVersion: 1
  },
  broker: {
    sourceDir: 'data_fubon_broker_details',
    outputDir: 'data_normalized/broker_details',
    sourcePattern: /^fubon_(\d{8})_券商分點進出明細\.json$/,
    schemaVersion: 4
  }
};

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(file) {
  const buffer = fs.readFileSync(file);
  if (!buffer.length) throw new Error(`empty file: ${path.relative(ROOT, file)}`);
  try {
    return { data: JSON.parse(buffer.toString('utf8')), hash: sha256(buffer) };
  } catch (error) {
    throw new Error(`invalid JSON: ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function findField(fields, names) {
  for (const name of names) {
    const index = fields.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function normalizeInstitutionalSource(source) {
  if (!Array.isArray(source?.fields) || !Array.isArray(source?.data)) {
    throw new Error('institutional schema mismatch: expected fields[] and data[]');
  }
  const fields = source.fields.map(value => String(value).trim());
  const indexes = {
    code: findField(fields, ['證券代號']),
    name: findField(fields, ['證券名稱']),
    foreignCash: findField(fields, ['外陸資買賣超股數(不含外資自營商)', '外資及陸資買賣超股數(不含外資自營商)']),
    foreignDealer: findField(fields, ['外資自營商買賣超股數']),
    trust: findField(fields, ['投信買賣超股數']),
    dealer: findField(fields, ['自營商買賣超股數']),
    total: findField(fields, ['三大法人買賣超股數'])
  };
  const missing = Object.entries(indexes).filter(([, index]) => index < 0).map(([key]) => key);
  if (missing.length) throw new Error(`institutional fields missing: ${missing.join(', ')}`);

  const stocks = {};
  for (const row of source.data) {
    if (!Array.isArray(row)) continue;
    const code = String(row[indexes.code] ?? '').trim();
    if (!code) continue;
    const foreignCash = numeric(row[indexes.foreignCash]);
    const foreignDealer = numeric(row[indexes.foreignDealer]);
    const foreign = foreignCash === null && foreignDealer === null
      ? null
      : (foreignCash ?? 0) + (foreignDealer ?? 0);
    const trust = numeric(row[indexes.trust]);
    const dealer = numeric(row[indexes.dealer]);
    const sourceTotal = numeric(row[indexes.total]);
    const derivedTotal = [foreign, trust, dealer].every(value => value !== null)
      ? foreign + trust + dealer
      : null;
    stocks[code] = {
      stock_code: code,
      stock_name: String(row[indexes.name] ?? '').trim(),
      foreign,
      trust,
      dealer,
      total: sourceTotal ?? derivedTotal,
      ...(sourceTotal === null && derivedTotal !== null ? { total_derived: true } : {})
    };
  }
  return stocks;
}

function branchIdentity(item, fallbackRank = 0) {
  const brokerId = String(item?.brokerId ?? '').trim();
  const branchId = String(item?.branchId ?? '').trim();
  const brokerName = String(item?.brokerName ?? '').trim();
  return [brokerId, branchId].filter(Boolean).join(':')
    || brokerName
    || `rank:${numeric(item?.rank) ?? fallbackRank}`;
}

function normalizeBrokerBranches(items, side) {
  if (!Array.isArray(items)) return [];
  const grouped = new Map();
  for (const [index, item] of items.entries()) {
    const rawNet = numeric(side === 'buy' ? item?.netBuy : item?.netSell);
    if (rawNet === null || rawNet <= 0) continue;
    const branchKey = branchIdentity(item, index + 1);
    const current = grouped.get(branchKey) || {
      rank: numeric(item?.rank) ?? index + 1,
      branch_key: branchKey,
      broker_name: String(item?.brokerName ?? '').trim(),
      broker_id: String(item?.brokerId ?? '').trim() || null,
      branch_id: String(item?.branchId ?? '').trim() || null,
      net_shares: 0,
      share_percent: 0
    };
    current.rank = Math.min(current.rank, numeric(item?.rank) ?? current.rank);
    current.net_shares += (side === 'buy' ? rawNet : -rawNet) * 1000;
    current.share_percent += numeric(item?.sharePercent) ?? 0;
    grouped.set(branchKey, current);
  }
  return [...grouped.values()]
    .map(item => ({ ...item, share_percent: round(item.share_percent) }))
    .sort((left, right) => side === 'buy'
      ? right.net_shares - left.net_shares || left.rank - right.rank
      : left.net_shares - right.net_shares || left.rank - right.rank);
}

function branchCount(items, valueKey) {
  if (!Array.isArray(items)) return null;
  const branches = new Set();
  for (const [index, item] of items.entries()) {
    const value = numeric(item?.[valueKey]);
    if (value === null || value <= 0) continue;
    branches.add(branchIdentity(item, index + 1));
  }
  return branches.size;
}

function sumBranchShares(branches, limit = branches.length) {
  return branches.slice(0, limit).reduce((sum, branch) => sum + Math.abs(branch.net_shares), 0);
}

function concentrationPercent(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return round(Math.min(100, Math.max(0, part / total * 100)));
}

function normalizeBrokerSource(source) {
  if (!source?.stocks || typeof source.stocks !== 'object' || Array.isArray(source.stocks)) {
    throw new Error('broker schema mismatch: expected stocks object');
  }
  const stocks = {};
  for (const [key, item] of Object.entries(source.stocks)) {
    const code = String(item?.stockCode ?? key).trim();
    const netLots = numeric(item?.totals?.net);
    if (!code || netLots === null) continue;

    const allBuyBranches = normalizeBrokerBranches(item?.buyBrokers, 'buy');
    const allSellBranches = normalizeBrokerBranches(item?.sellBrokers, 'sell');

    // Numerator and denominator must come from the same ranked branch list.
    // Source totals are preserved for auditing because some rows differ from
    // the sum of displayed branches and would otherwise produce >100%.
    const rankedBuyNetShares = sumBranchShares(allBuyBranches);
    const rankedSellNetShares = sumBranchShares(allSellBranches);
    const sourceReportedBuyNetShares = numeric(item?.totals?.netBuy);
    const sourceReportedSellNetShares = numeric(item?.totals?.netSell);
    const sourceBuyShares = sourceReportedBuyNetShares === null ? null : sourceReportedBuyNetShares * 1000;
    const sourceSellShares = sourceReportedSellNetShares === null ? null : sourceReportedSellNetShares * 1000;
    const top3BuyNetShares = sumBranchShares(allBuyBranches, 3);
    const top5BuyNetShares = sumBranchShares(allBuyBranches, 5);
    const top3SellNetShares = sumBranchShares(allSellBranches, 3);
    const top5SellNetShares = sumBranchShares(allSellBranches, 5);

    stocks[code] = {
      stock_code: code,
      stock_name: String(item?.stockName ?? '').trim(),
      net: netLots * 1000,
      buy_branch_count: branchCount(item?.buyBrokers, 'netBuy'),
      sell_branch_count: branchCount(item?.sellBrokers, 'netSell'),
      branch_detail_limit: BROKER_BRANCH_DETAIL_LIMIT,
      top_buy_branches: allBuyBranches.slice(0, BROKER_BRANCH_DETAIL_LIMIT),
      top_sell_branches: allSellBranches.slice(0, BROKER_BRANCH_DETAIL_LIMIT),
      concentration: {
        scope: 'sum_of_source_ranked_branches',
        denominator_definition: 'sum(abs(net_shares)) of the normalized source ranked branch list for the same side',
        ranked_buy_net_shares: rankedBuyNetShares,
        ranked_sell_net_shares: rankedSellNetShares,
        source_reported_buy_net_shares: sourceBuyShares,
        source_reported_sell_net_shares: sourceSellShares,
        source_buy_difference_shares: sourceBuyShares === null ? null : sourceBuyShares - rankedBuyNetShares,
        source_sell_difference_shares: sourceSellShares === null ? null : sourceSellShares - rankedSellNetShares,
        top3_buy_net_shares: top3BuyNetShares,
        top5_buy_net_shares: top5BuyNetShares,
        top3_sell_net_shares: top3SellNetShares,
        top5_sell_net_shares: top5SellNetShares,
        top3_buy_concentration_pct: concentrationPercent(top3BuyNetShares, rankedBuyNetShares),
        top5_buy_concentration_pct: concentrationPercent(top5BuyNetShares, rankedBuyNetShares),
        top3_sell_concentration_pct: concentrationPercent(top3SellNetShares, rankedSellNetShares),
        top5_sell_concentration_pct: concentrationPercent(top5SellNetShares, rankedSellNetShares)
      },
      source_unit: source.unit ?? item?.unit ?? '張',
      normalized_unit: '股'
    };
  }
  return stocks;
}

function validateBranchList(code, field, items, side, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${code}: ${field} must be an array`);
    return;
  }
  if (items.length > BROKER_BRANCH_DETAIL_LIMIT) errors.push(`${code}: ${field} exceeds detail limit`);
  const keys = new Set();
  for (const item of items) {
    const key = String(item?.branch_key ?? '').trim();
    const netShares = numeric(item?.net_shares);
    if (!key) errors.push(`${code}: ${field} branch_key is empty`);
    else if (keys.has(key)) errors.push(`${code}: ${field} duplicate branch_key ${key}`);
    keys.add(key);
    if (netShares === null || (side === 'buy' ? netShares <= 0 : netShares >= 0)) {
      errors.push(`${code}: ${field} net_shares has invalid sign`);
    }
    const sharePercent = numeric(item?.share_percent);
    if (sharePercent === null || sharePercent < 0) errors.push(`${code}: ${field} share_percent is invalid`);
  }
}

function validateConcentration(code, concentration, errors) {
  if (!concentration || typeof concentration !== 'object' || Array.isArray(concentration)) {
    errors.push(`${code}: concentration must be an object`);
    return;
  }
  if (concentration.scope !== 'sum_of_source_ranked_branches') {
    errors.push(`${code}: concentration.scope is invalid`);
  }
  for (const field of [
    'ranked_buy_net_shares',
    'ranked_sell_net_shares',
    'top3_buy_net_shares',
    'top5_buy_net_shares',
    'top3_sell_net_shares',
    'top5_sell_net_shares'
  ]) {
    const value = numeric(concentration[field]);
    if (value === null || value < 0) errors.push(`${code}: concentration.${field} is invalid`);
  }
  for (const field of [
    'source_reported_buy_net_shares',
    'source_reported_sell_net_shares',
    'source_buy_difference_shares',
    'source_sell_difference_shares'
  ]) {
    if (concentration[field] !== null && numeric(concentration[field]) === null) {
      errors.push(`${code}: concentration.${field} is invalid`);
    }
  }
  for (const field of [
    'top3_buy_concentration_pct',
    'top5_buy_concentration_pct',
    'top3_sell_concentration_pct',
    'top5_sell_concentration_pct'
  ]) {
    const value = concentration[field];
    if (value === null) continue;
    const parsed = numeric(value);
    if (parsed === null || parsed < 0 || parsed > 100.0001) errors.push(`${code}: concentration.${field} is invalid`);
  }
  const rankedBuy = numeric(concentration.ranked_buy_net_shares);
  const rankedSell = numeric(concentration.ranked_sell_net_shares);
  const top3Buy = numeric(concentration.top3_buy_net_shares);
  const top5Buy = numeric(concentration.top5_buy_net_shares);
  const top3Sell = numeric(concentration.top3_sell_net_shares);
  const top5Sell = numeric(concentration.top5_sell_net_shares);
  if (top3Buy > top5Buy) errors.push(`${code}: top3 buy net exceeds top5`);
  if (top5Buy > rankedBuy) errors.push(`${code}: top5 buy net exceeds ranked buy total`);
  if (top3Sell > top5Sell) errors.push(`${code}: top3 sell net exceeds top5`);
  if (top5Sell > rankedSell) errors.push(`${code}: top5 sell net exceeds ranked sell total`);
}

function validateNormalized(type, payload, date, options = {}) {
  const minimumRecords = options.minimumRecords ?? 100;
  const errors = [];
  const expectedVersion = TYPES[type].schemaVersion;
  if (!payload || typeof payload !== 'object') return ['payload is not an object'];
  if (payload.schemaVersion !== expectedVersion) errors.push(`schemaVersion must be ${expectedVersion}`);
  if (String(payload.date ?? '') !== date) errors.push(`date must be ${date}`);
  if (!payload.stocks || typeof payload.stocks !== 'object' || Array.isArray(payload.stocks)) {
    errors.push('stocks must be an object');
    return errors;
  }
  const entries = Object.entries(payload.stocks);
  if (entries.length < minimumRecords) errors.push(`stock count too low: ${entries.length}`);
  for (const code of ASSERTION_CODES) {
    if (!payload.stocks[code]) errors.push(`reference stock missing: ${code}`);
  }
  for (const [code, item] of entries) {
    if (String(item?.stock_code ?? '') !== code) errors.push(`${code}: stock_code mismatch`);
    if (type === 'institutional') {
      for (const field of ['foreign', 'trust', 'dealer', 'total']) {
        if (numeric(item?.[field]) === null) errors.push(`${code}: ${field} is not numeric`);
      }
    } else {
      if (numeric(item?.net) === null) errors.push(`${code}: net is not numeric`);
      for (const field of ['buy_branch_count', 'sell_branch_count']) {
        const value = numeric(item?.[field]);
        if (value === null || value < 0) errors.push(`${code}: ${field} is invalid`);
      }
      if (numeric(item?.branch_detail_limit) !== BROKER_BRANCH_DETAIL_LIMIT) {
        errors.push(`${code}: branch_detail_limit must be ${BROKER_BRANCH_DETAIL_LIMIT}`);
      }
      validateBranchList(code, 'top_buy_branches', item?.top_buy_branches, 'buy', errors);
      validateBranchList(code, 'top_sell_branches', item?.top_sell_branches, 'sell', errors);
      validateConcentration(code, item?.concentration, errors);
      if (item?.normalized_unit !== '股') errors.push(`${code}: normalized_unit must be 股`);
    }
    if (errors.length >= 20) {
      errors.push('additional validation errors omitted');
      break;
    }
  }
  return errors;
}

function parseArgs(argv) {
  const options = {
    types: new Set(['institutional', 'broker']),
    dryRun: false,
    force: false,
    repairInvalid: false,
    date: null,
    from: null,
    to: null
  };
  const valueFor = (arg, index) => {
    const inline = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[index + 1];
    if (!inline || inline.startsWith('--')) throw new Error(`${arg.split('=')[0]} requires a value`);
    return inline;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--repair-invalid') options.repairInvalid = true;
    else if (arg === '--type' || arg.startsWith('--type=')) {
      const value = valueFor(arg, i);
      if (!arg.includes('=')) i++;
      const requested = value === 'all' ? Object.keys(TYPES) : value.split(',').map(item => item.trim());
      const unknown = requested.filter(type => !TYPES[type]);
      if (unknown.length) throw new Error(`unknown type: ${unknown.join(', ')}`);
      options.types = new Set(requested);
    } else if (['--date', '--from', '--to'].some(flag => arg === flag || arg.startsWith(`${flag}=`))) {
      const flag = arg.split('=')[0];
      const value = valueFor(arg, i);
      if (!arg.includes('=')) i++;
      if (!/^\d{8}$/.test(value)) throw new Error(`${flag} must use YYYYMMDD`);
      options[flag.slice(2)] = value;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  if (options.date && (options.from || options.to)) throw new Error('--date cannot be combined with --from or --to');
  if (options.from && options.to && options.from > options.to) throw new Error('--from cannot be after --to');
  return options;
}

function inRange(date, options) {
  if (options.date) return date === options.date;
  return (!options.from || date >= options.from) && (!options.to || date <= options.to);
}

function listSourceFiles(type, options) {
  const config = TYPES[type];
  const directory = path.join(ROOT, config.sourceDir);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .map(name => ({ name, match: name.match(config.sourcePattern) }))
    .filter(item => item.match && inRange(item.match[1], options))
    .map(item => ({
      date: item.match[1],
      sourcePath: path.join(directory, item.name),
      outputPath: path.join(ROOT, config.outputDir, `${item.match[1]}.json`)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildPayload(type, date, sourcePath) {
  const source = readJson(sourcePath);
  const stocks = type === 'institutional'
    ? normalizeInstitutionalSource(source.data)
    : normalizeBrokerSource(source.data);
  return {
    schemaVersion: TYPES[type].schemaVersion,
    generated_at: new Date().toISOString(),
    source_file: path.relative(ROOT, sourcePath).replaceAll(path.sep, '/'),
    source_sha256: source.hash,
    date,
    ...(type === 'institutional'
      ? { unit: '股' }
      : {
          source_unit: source.data.unit ?? '張',
          normalized_unit: '股',
          branch_detail_limit: BROKER_BRANCH_DETAIL_LIMIT,
          concentration_scope: 'sum_of_source_ranked_branches'
        }),
    stocks
  };
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function refreshManifest(dryRun) {
  const files = [];
  for (const config of Object.values(TYPES)) {
    const directory = path.join(ROOT, config.outputDir);
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
      if (/^\d{8}\.json$/.test(name)) {
        files.push(`${config.outputDir.replace(/^data_normalized\//, '')}/${name}`);
      }
    }
  }
  files.sort();
  const file = path.join(ROOT, 'data_normalized', 'files.json');
  const content = JSON.stringify(files, null, 2);
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = previous !== content;
  if (changed && !dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return { count: files.length, changed };
}

function processOne(type, item, options) {
  if (fs.existsSync(item.outputPath) && !options.force) {
    let existingErrors;
    try {
      existingErrors = validateNormalized(type, readJson(item.outputPath).data, item.date);
    } catch (error) {
      existingErrors = [error.message];
    }
    if (!existingErrors.length) return { status: 'skipped', reason: 'valid output exists' };
    if (!options.repairInvalid) {
      throw new Error(`existing output is invalid; use --repair-invalid: ${existingErrors.join('; ')}`);
    }
  }

  const payload = buildPayload(type, item.date, item.sourcePath);
  const errors = validateNormalized(type, payload, item.date);
  if (errors.length) throw new Error(errors.join('; '));
  const existed = fs.existsSync(item.outputPath);
  if (!options.dryRun) writeJsonAtomic(item.outputPath, payload);
  return { status: existed ? 'repaired' : 'created' };
}

function usage() {
  return [
    'Usage: node scripts/backfill_normalized_data.js [options]',
    '',
    'Options:',
    '  --type institutional|broker|all  Data type(s), comma-separated (default: all)',
    '  --date YYYYMMDD                  Process one date',
    '  --from YYYYMMDD                  Inclusive start date',
    '  --to YYYYMMDD                    Inclusive end date',
    '  --dry-run                        Validate and report without writing',
    '  --force                          Rebuild even valid outputs',
    '  --repair-invalid                 Replace invalid or outdated outputs',
    '  --help                           Show this help'
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const summary = { created: 0, repaired: 0, skipped: 0, failed: 0 };
  for (const type of options.types) {
    const files = listSourceFiles(type, options);
    console.log(`[${type}] ${files.length} source file(s) selected`);
    for (const item of files) {
      try {
        const result = processOne(type, item, options);
        summary[result.status]++;
        console.log(`${options.dryRun ? '[dry-run] ' : ''}${type} ${item.date}: ${result.status}`);
      } catch (error) {
        summary.failed++;
        console.error(`${type} ${item.date}: failed: ${error.message}`);
      }
    }
  }
  const manifest = refreshManifest(options.dryRun);
  console.log(`manifest: ${manifest.count} file(s), ${manifest.changed ? (options.dryRun ? 'would update' : 'updated') : 'unchanged'}`);
  console.log(`summary: ${JSON.stringify(summary)}`);
  return summary.failed ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  BROKER_BRANCH_DETAIL_LIMIT,
  branchCount,
  normalizeBrokerBranches,
  normalizeInstitutionalSource,
  normalizeBrokerSource,
  validateNormalized,
  parseArgs,
  main
};
