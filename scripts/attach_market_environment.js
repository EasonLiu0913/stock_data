#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  atomicWriteJson,
} = require('./market_environment_lib');
const {
  applyFormalMarketStrategyTags,
} = require('./apply_formal_market_strategy_tags');

function attach(rootDir, date, environment) {
  const dir = path.join(ROOT, rootDir, date);
  const targets = ['summary.json', 'manifest.json'];
  let changed = 0;
  for (const filename of targets) {
    const file = path.join(dir, filename);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    const payload = readJson(file, {});
    payload.market_environment = {
      source_file: `data_market_environment/${date}/market_environment.json`,
      snapshot_hash: environment.snapshot_hash,
      code: environment.environment?.code,
      label: environment.environment?.label,
      score: environment.environment?.score,
      mode: environment.mode,
      data_freshness: environment.data_freshness,
      strategy_policy: environment.strategy_policy,
    };
    atomicWriteJson(file, payload);
    changed += 1;
  }
  return changed;
}

function main() {
  const args = parseArgs();
  const date = compactDate(args.get('date') || process.env.FORECAST_TARGET_DATE, 'date');
  const version = String(args.get('version') || 'all').toLowerCase();
  const environmentFile = path.join(ROOT, 'data_market_environment', date, 'market_environment.json');
  const environment = readJson(environmentFile);
  if (!environment) throw new Error(`Missing environment snapshot: ${path.relative(ROOT, environmentFile)}`);
  const roots = version === 'v1' ? ['data_predictions'] : version === 'v2' ? ['data_predictions_v2'] : ['data_predictions', 'data_predictions_v2'];
  const changed = roots.reduce((total, rootDir) => total + attach(rootDir, date, environment), 0);
  const formalStrategy = roots.includes('data_predictions')
    ? applyFormalMarketStrategyTags({ rootDir: 'data_predictions', date, environment })
    : null;
  console.log(JSON.stringify({
    date,
    version,
    changed,
    snapshot_hash: environment.snapshot_hash,
    formal_strategy: formalStrategy,
  }));
}

main();
