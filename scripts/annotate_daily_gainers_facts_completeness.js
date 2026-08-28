#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const REQUIRED_SOURCES = [
  'margin',
  'broker_details',
  'mi_index',
  'foreign',
  'investment_trust',
  'dealer',
];

function annotate(payload) {
  const sourceStatus = payload?.source_status && typeof payload.source_status === 'object'
    ? payload.source_status
    : {};
  const missing = REQUIRED_SOURCES.filter((key) => sourceStatus[key] !== 'available');
  return {
    ...payload,
    source_completeness: {
      status: missing.length === 0 ? 'complete' : 'partial',
      required_sources: REQUIRED_SOURCES,
      missing_sources: missing,
      complete_source_count: REQUIRED_SOURCES.length - missing.length,
      required_source_count: REQUIRED_SOURCES.length,
    },
  };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/annotate_daily_gainers_facts_completeness.js FACTS.json');
    process.exit(2);
  }
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = annotate(payload);
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(next.source_completeness));
}

module.exports = { annotate, REQUIRED_SOURCES };
