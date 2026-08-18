#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const TARGET = path.join(__dirname, 'backfill_daily_gainers_research.js');
const source = fs.readFileSync(TARGET, 'utf8');
const mainMarker = "try{main();}catch(error){console.error(error.stack||error);process.exit(1);}";

assert.ok(source.includes(mainMarker), 'Cannot instrument backfill_daily_gainers_research.js: main marker changed');

const instrumented = source.replace(
  mainMarker,
  'globalThis.__parserTestExports = { findFieldIndex, mapInstitutional };'
);

const context = vm.createContext({
  require,
  console,
  process: {
    ...process,
    argv: ['node', TARGET],
    exit(code) {
      throw new Error(`Unexpected process.exit(${code}) while loading parser`);
    },
  },
  __dirname: path.dirname(TARGET),
  __filename: TARGET,
});

new vm.Script(instrumented, { filename: TARGET }).runInContext(context);
const { findFieldIndex, mapInstitutional } = context.__parserTestExports || {};
assert.equal(typeof findFieldIndex, 'function');
assert.equal(typeof mapInstitutional, 'function');

// Structural guard: institutional parsers must resolve the stock-code column from
// fields metadata. Do not regress to a hard-coded row[1] assumption.
const parserSource = String(mapInstitutional);
assert.match(parserSource, /findFieldIndex\(fields/);
assert.match(parserSource, /row\?\.\[codeIndex\]/);
assert.doesNotMatch(parserSource, /row\?\.\[1\]/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-gainers-parser-'));
try {
  // Dealer format: stock code is the FIRST column (row[0]). This is the
  // regression case that previously produced dealer_net = 0 for most stocks.
  const dealerFile = path.join(tempDir, 'dealer.json');
  fs.writeFileSync(dealerFile, JSON.stringify({
    fields: ['證券代號', '證券名稱', '買進股數', '賣出股數', '買賣超股數'],
    data: [
      ['2330', '台積電', '10,000', '3,000', '7,000'],
      ['2317', '鴻海', '2,000', '5,000', '-3,000'],
    ],
  }));
  const dealer = mapInstitutional(dealerFile, 4);
  assert.equal(dealer.get('2330'), 7, 'dealer row[0] stock code must parse correctly');
  assert.equal(dealer.get('2317'), -3, 'dealer negative net must parse correctly');

  // Foreign/trust-style format: stock code may be in a later column. The same
  // parser must still work by following the fields metadata.
  const foreignFile = path.join(tempDir, 'foreign.json');
  fs.writeFileSync(foreignFile, JSON.stringify({
    fields: ['日期', '證券代號', '證券名稱', '買進股數', '賣出股數', '買賣超股數'],
    data: [
      ['20260818', '2454', '聯發科', '9,000', '4,000', '5,000'],
    ],
  }));
  const foreign = mapInstitutional(foreignFile, 5);
  assert.equal(foreign.get('2454'), 5, 'non-dealer stock-code column must be discovered from fields');

  assert.equal(findFieldIndex([' 證券代號 ', '名稱'], ['證券代號']), 0, 'field matching should tolerate whitespace');

  const invalidFile = path.join(tempDir, 'invalid.json');
  fs.writeFileSync(invalidFile, JSON.stringify({ fields: ['名稱', '買賣超股數'], data: [['台積電', '1000']] }));
  assert.throws(() => mapInstitutional(invalidFile, 1), /Cannot locate institutional stock-code field/);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('PASS: institutional parser resolves dealer row[0] and non-dealer code columns from fields metadata');
