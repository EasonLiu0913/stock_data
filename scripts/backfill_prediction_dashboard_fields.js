#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_ROOT = path.join(ROOT, 'data_predictions');
const GENERATOR = path.join(__dirname, 'generate_prediction_dashboard_data.js');
const FORMAL_TAGGER = path.join(__dirname, 'apply_formal_market_strategy_tags.js');
const GROUP_SYNC = path.join(__dirname, 'sync_prediction_dashboard_groups.js');
const OFFICIAL_CONSTRAINTS = path.join(__dirname, 'apply_official_market_constraints.js');

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function parseArgs(argv) {
  const options = { date: '', from: '', to: '', dryRun: false };
  const readValue = (arg, index) => {
    const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg.split('=')[0]} requires YYYYMMDD`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--date', '--from', '--to'].some(flag => arg === flag || arg.startsWith(`${flag}=`))) {
      const flag = arg.split('=')[0];
      const value = compactDate(readValue(arg, index));
      if (!arg.includes('=')) index += 1;
      if (!value) throw new Error(`${flag} requires YYYYMMDD`);
      options[flag.slice(2)] = value;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  if (options.date && (options.from || options.to)) {
    throw new Error('--date cannot be combined with --from or --to');
  }
  if (!options.help && !options.date && !options.from && !options.to) {
    throw new Error('provide --date or --from/--to');
  }
  if (options.from && options.to && options.from > options.to) {
    throw new Error('--from cannot be after --to');
  }
  return options;
}

function selectDates(availableDates, options) {
  const sorted = [...new Set(availableDates.map(compactDate).filter(Boolean))].sort();
  if (options.date) return sorted.includes(options.date) ? [options.date] : [];
  return sorted.filter(date => (!options.from || date >= options.from) && (!options.to || date <= options.to));
}

function availablePredictionDates() {
  if (!fs.existsSync(PREDICTION_ROOT)) return [];
  return fs.readdirSync(PREDICTION_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .filter(entry => fs.existsSync(path.join(PREDICTION_ROOT, entry.name, 'manifest.json')))
    .map(entry => entry.name)
    .sort();
}

function usage() {
  return [
    'Usage: node scripts/backfill_prediction_dashboard_fields.js [options]',
    '',
    '  --date YYYYMMDD   Rebuild one prediction date',
    '  --from YYYYMMDD   Inclusive first prediction date',
    '  --to YYYYMMDD     Inclusive last prediction date',
    '  --dry-run         Compute and validate without writing',
    '  --help            Show this help'
  ].join('\n');
}

function runNodeScript(script, args, label, date) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed for ${date} with exit code ${result.status}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const dates = selectDates(availablePredictionDates(), options);
  if (!dates.length) throw new Error('no prediction directories matched the requested dates');

  console.log(`Selected prediction dates: ${dates.join(', ')}`);
  for (const date of dates) {
    const generatorArgs = ['--date', date];
    if (options.dryRun) generatorArgs.push('--dry-run');
    runNodeScript(GENERATOR, generatorArgs, 'dashboard backfill', date);

    const taggerArgs = ['--date', date];
    if (options.dryRun) taggerArgs.push('--dry-run');
    runNodeScript(FORMAL_TAGGER, taggerArgs, 'formal strategy tag backfill', date);

    const syncArgs = ['--date', date];
    if (options.dryRun) syncArgs.push('--dry-run');
    runNodeScript(GROUP_SYNC, syncArgs, 'dashboard group sync', date);

    const constraintArgs = ['--date', date, '--evaluate-replay-if-present'];
    if (options.dryRun) constraintArgs.push('--dry-run');
    runNodeScript(OFFICIAL_CONSTRAINTS, constraintArgs, 'official market constraint integration', date);
  }
  console.log(`${options.dryRun ? 'Dry-run validated' : 'Backfilled'} ${dates.length} prediction date(s).`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compactDate, parseArgs, selectDates, main };
