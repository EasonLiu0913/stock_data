'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  filterInstitutionalDataToUniverse,
  isEligibleInstitutionalStockCode,
  readEligibleStockUniverse,
} = require('../scripts/lib/institutional_data_common');

test('eligible institutional universe accepts four-digit numeric security codes', () => {
  for (const code of ['0050', '1101', '2330', '2882', '9999']) assert.equal(isEligibleInstitutionalStockCode(code), true);
  for (const code of ['00631L', '01001T', '12345', 'ABC1', '']) assert.equal(isEligibleInstitutionalStockCode(code), false);
});

test('CSV universe follows the existing four-digit numeric contract before crawling', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'institutional-universe-'));
  const csv = path.join(root, 'twse_industry.csv');
  fs.writeFileSync(csv, [
    'code,name,category',
    '1101,台泥,股票',
    '2330,台積電,股票',
    '0050,元大台灣50,ETF',
    '00631L,元大台灣50正2,ETF',
    '01001T,土銀富邦R1,受益證券',
  ].join('\n'));
  const universe = readEligibleStockUniverse(csv);
  assert.deepEqual([...universe.keys()], ['1101', '2330', '0050']);
});

test('institutional data is sanitized to the same eligible universe', () => {
  const universe = new Map([['0050', '元大台灣50'], ['1101', '台泥'], ['2330', '台積電']]);
  const row = { ForeignInvestors: {'115/08/24': 1}, InvestmentTrust: {'115/08/24': 0}, Dealers: {'115/08/24': 0}, DailyTotal: {'115/08/24': 1} };
  const filtered = filterInstitutionalDataToUniverse({
    '0050': row,
    '1101': row,
    '2330': row,
    '00631L': row,
    '01001T': row,
  }, universe);
  assert.deepEqual(Object.keys(filtered).sort(), ['0050', '1101', '2330']);
});
