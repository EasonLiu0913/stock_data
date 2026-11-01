'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertNoDepositaryReceiptsInCandidates } = require('../scripts/generate_daily_gainers_over_5');

test('known DR may satisfy >=5% but must not enter a publishable candidate universe', () => {
  const stocks = [{code:'9103',name:'美德醫療-DR',change_pct:9.91},{code:'1301',name:'台塑',change_pct:7.82}];
  assert.throws(() => assertNoDepositaryReceiptsInCandidates(stocks), /MVP10_NON_ORDINARY_DR_CANDIDATES: 9103 美德醫療-DR.*regenerate date-matched/);
  assert.equal(stocks.length,2,'candidate array must not be silently filtered');
});

test('a dated 20261008 legacy candidate snapshot is rejected without altering it', () => {
  const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_daily_gain_over_5/20261008.json'),'utf8'));
  const before=JSON.stringify(snapshot);
  assert.equal(snapshot.target_date,'20261008');
  assert.equal(snapshot.stock_count,35);
  assert.throws(() => assertNoDepositaryReceiptsInCandidates(snapshot.stocks),/9103 美德醫療-DR/);
  assert.equal(JSON.stringify(snapshot),before,'preserve original evidence unchanged');
});

test('negative and missing universes fail closed', () => {
  assert.throws(() => assertNoDepositaryReceiptsInCandidates(null),/MVP10_CANDIDATE_UNIVERSE_MISSING/);
});

test('KY/innovation are NOT guessed to be DR; they need their own dated classification evidence', () => {
  const stocks=[{code:'6672',name:'騰輝電子-KY'},{code:'6645',name:'金萬林-創'},{code:'1301',name:'台塑'}];
  assert.equal(assertNoDepositaryReceiptsInCandidates(stocks),stocks);
});

test('fullwidth hyphen and lowercase DR are also rejected', () => {
  assert.throws(() => assertNoDepositaryReceiptsInCandidates([{code:'9103',name:'美德醫療－dr'}]),/MVP10_NON_ORDINARY_DR_CANDIDATES/);
});
