'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SOURCE_STATES,
  buildObservationDates,
  evaluateAnchorEligibility,
  historicalIndustryObservation,
  loadMarginObservation,
  loadPriceObservation,
  loadTwseInstitutionalObservation,
  tdccHistoricalObservation,
} = require('../scripts/lib/institutional_accumulation_pit');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'accumulation-pit-'));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function writeJson(file, value) {
  write(file, JSON.stringify(value));
}

test('T offsets are trading-session offsets, not calendar-day offsets', () => {
  const dates = [];
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(2026, 7, day));
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(`202608${String(day).padStart(2, '0')}`);
  }
  const observed = buildObservationDates(dates, '20260831');
  assert.equal(observed.T0, '20260831');
  assert.equal(observed['T-1'], '20260828');
  assert.equal(observed['T-3'], '20260826');
  assert.equal(observed['T-5'], '20260824');
  assert.equal(observed['T-20'], '20260803');
});

test('explicit institutional zero remains available while missing row is missing', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_twse_investment_trust/20260827_twse_investment_trust.json'), {
    stat: 'OK',
    date: '20260827',
    fields: ['', '證券代號', '證券名稱', '買進股數', '賣出股數', '買賣超股數'],
    data: [[' ', '1101', '台泥', '0', '0', '0']],
  });
  const zero = loadTwseInstitutionalObservation('1101', '20260827', 'investment_trust', { root, sessionComplete: true });
  const missing = loadTwseInstitutionalObservation('1102', '20260827', 'investment_trust', { root, sessionComplete: true });
  assert.equal(zero.state, SOURCE_STATES.AVAILABLE);
  assert.equal(zero.value, 0);
  assert.equal(missing.state, SOURCE_STATES.MISSING);
  assert.equal(missing.value, null);
});

test('same-session EOD facts are withheld until session completion', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_twse_foreign_investors/20260827_twse_foreign_investors.json'), {
    stat: 'OK',
    date: '20260827',
    fields: ['', '證券代號', '證券名稱', '買進股數', '賣出股數', '買賣超股數'],
    data: [[' ', '1101', '台泥', '100', '20', '80']],
  });
  const observation = loadTwseInstitutionalObservation('1101', '20260827', 'foreign', { root, sessionComplete: false });
  assert.equal(observation.state, SOURCE_STATES.AVAILABILITY_UNSAFE);
  assert.equal(observation.value, null);
});

test('price observation uses unified provider and preserves provenance', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_twse_mi_index/20260827_twse_mi_index.json'), {
    tables: [{
      fields: ['證券代號', '成交股數', '開盤價', '最高價', '最低價', '收盤價'],
      data: [['1101', '12345', '20', '21', '19.5', '20.5']],
    }],
  });
  const observation = loadPriceObservation('1101', '20260827', { root, sessionComplete: true });
  assert.equal(observation.state, SOURCE_STATES.AVAILABLE);
  assert.equal(observation.value.close, 20.5);
  assert.equal(observation.provenance.source, 'twse_mi_index');
  assert.equal(observation.provenance.source_file, 'data_twse_mi_index/20260827_twse_mi_index.json');
});

test('margin explicit numeric zero is available and CSV quoted commas parse correctly', () => {
  const root = tmpRoot();
  write(path.join(root, 'data_twse_margin_balance/20260827_twse_margin_balance.csv'), [
    '股票代號,股票名稱,融資買進,融資賣出,融資現金償還,融資前日餘額,融資今日餘額,融資限額',
    '1101,台泥,"1,093",409,3,"36,387",0,"1,880,795"',
  ].join('\n'));
  const observation = loadMarginObservation('1101', '20260827', { root, sessionComplete: true });
  assert.equal(observation.state, SOURCE_STATES.AVAILABLE);
  assert.equal(observation.value, 0);
});

test('historical TDCC remains availability_unsafe without no-lookahead-safe provenance', () => {
  const observation = tdccHistoricalObservation({
    value: 42.5,
    sourceFile: 'data_tdcc_shareholding/history/2449/20260821.json',
    sessionDate: '20260821',
    productionNoLookaheadSafe: false,
  });
  assert.equal(observation.state, SOURCE_STATES.AVAILABILITY_UNSAFE);
  assert.equal(observation.value, null);
});

test('current industry mapping is not silently projected backward', () => {
  const observation = historicalIndustryObservation();
  assert.equal(observation.state, SOURCE_STATES.NOT_APPLICABLE);
  assert.equal(observation.value, null);
});

test('anchor eligibility fails closed on any required non-available observation', () => {
  const available = {
    state: SOURCE_STATES.AVAILABLE,
    value: 1,
    provenance: { source: 'test', availability_rule: 'test' },
  };
  const missing = {
    state: SOURCE_STATES.MISSING,
    value: null,
    provenance: { source: 'test', availability_rule: 'test' },
  };
  assert.deepEqual(evaluateAnchorEligibility({ price: available, foreign: available }, ['price', 'foreign']), { eligible: true, reasons: [] });
  assert.deepEqual(evaluateAnchorEligibility({ price: available, foreign: missing }, ['price', 'foreign']), { eligible: false, reasons: ['foreign:missing'] });
});
