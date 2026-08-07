'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  getDailyPrice,
  loadFromHistorySma,
  loadFromLegacyFubon,
  loadFromTwseMiIndex,
} = require('../scripts/lib/stock_price_provider');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stock-price-provider-'));
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
}

test('TWSE MI_INDEX is the first canonical source and parses OHLCV', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_twse_mi_index/20251215_twse_mi_index.json'), {
    tables: [{
      fields: ['證券代號', '證券名稱', '成交股數', '開盤價', '最高價', '最低價', '收盤價'],
      data: [['2330', '台積電', '12,345', '1000', '1020', '995', '1015']],
    }],
  });
  const price = loadFromTwseMiIndex('2330', '20251215', root);
  assert.deepEqual(price, {
    open: 1000, high: 1020, low: 995, close: 1015, volume: 12345,
    source: 'twse_mi_index', source_file: 'data_twse_mi_index/20251215_twse_mi_index.json',
  });
});

test('history SMA fallback supports lowercase historical schema', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_history_sma/1101.json'), {
    '2025/12/15': { price: 22.1, open: 22, high: 22.3, low: 21.9, volume: 1000, sma5: 22 },
  });
  const price = loadFromHistorySma('1101', '20251215', root);
  assert.equal(price.close, 22.1);
  assert.equal(price.source, 'data_history_sma');
});

test('legacy Fubon remains the last fallback', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_fubon/fubon_20251215_sma.json'), {
    '1101': { StockName: '台泥', '2025/12/15': { Price: '22.10', Open: '22.00', High: '22.30', Low: '21.90', Volume: '1000' } },
  });
  const price = loadFromLegacyFubon('1101', '20251215', root);
  assert.equal(price.close, 22.1);
  assert.equal(price.source, 'legacy_data_fubon');
});

test('provider falls back when an earlier source is present but lacks a usable close', () => {
  const root = tmpRoot();
  writeJson(path.join(root, 'data_twse_mi_index/20251215_twse_mi_index.json'), {
    tables: [{ fields: ['證券代號', '開盤價', '最高價', '最低價', '收盤價'], data: [['1101', '--', '--', '--', '--']] }],
  });
  writeJson(path.join(root, 'data_history_sma/1101.json'), {
    '2025/12/15': { price: 22.1, open: 22, high: 22.3, low: 21.9, volume: 1000 },
  });
  const price = getDailyPrice('1101', '20251215', { root });
  assert.equal(price.close, 22.1);
  assert.equal(price.source, 'data_history_sma');
});
