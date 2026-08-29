#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

function main(argv = process.argv.slice(2)) {
  const inputPath = getArg(argv, '--input');
  if (!inputPath) throw new Error('--input is required');
  const result = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (result.complete === true && result.status === 'complete') {
    console.log('Workflow data completeness gate passed.');
    return;
  }
  console.error(`Workflow data completeness gate failed: ${result.status || 'unknown'} - ${result.reason || 'no reason'}`);
  process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Workflow data completeness gate error: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { main };
