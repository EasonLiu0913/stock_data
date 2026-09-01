'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseUniverse } = require('../scripts/audit_institutional_accumulation_pit_coverage');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'accumulation-pit-coverage-'));
}

test('coverage universe excludes leading-zero ETF codes and protected 2454', () => {
  const root = tmpRoot();
  const file = path.join(root, 'data_twse', 'twse_industry.csv');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    'Code,Name,Industry',
    '0050,元大台灣50,ETF',
    '0051,元大中型100,ETF',
    '0052,富邦科技,ETF',
    '1101,台泥,水泥工業',
    '1102,亞泥,水泥工業',
    '1103,嘉泥,水泥工業',
    '2454,聯發科,半導體業',
  ].join('\n'), 'utf8');

  assert.deepEqual(parseUniverse(root, 3), ['1101', '1102', '1103']);
});
