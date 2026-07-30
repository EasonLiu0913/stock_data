#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  primaryExternalValidation,
} = require('./market_environment_lib');

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs();
  const expectedDate = compactDate(args.get('expected-date'), 'expected date');
  const suppliedFile = args.get('file');
  const file = suppliedFile
    ? path.resolve(ROOT, suppliedFile)
    : path.join(ROOT, 'data_external_market', expectedDate, 'external_market_indicators.json');
  const payload = readJson(file, null);
  const validation = primaryExternalValidation(payload, expectedDate);
  const ready = Boolean(payload && validation.exact);
  output('ready', ready ? 'true' : 'false');
  output('actual_date', validation.actual_date || '');
  output('agreement', validation.primary_indicator_agreement);
  output('file', path.relative(ROOT, file).replaceAll(path.sep, '/'));
  const result = { ready, expected_date: expectedDate, file: path.relative(ROOT, file), ...validation };
  console.log(JSON.stringify(result));
  if (args.has('strict') && !ready) process.exitCode = 1;
}

main();
