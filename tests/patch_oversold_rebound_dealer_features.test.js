'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDealerPayload } = require('../scripts/patch_oversold_rebound_dealer_features');

test('dealer parser reads stock code from column zero and total net from final numeric column', () => {
  const parsed = parseDealerPayload({
    data: [
      ['2330', '台積電', '10', '2', '8', '5', '1', '4', '15', '3', '12'],
      ['', '合計', '1', '2', '3'],
    ],
  });
  assert.deepEqual(parsed.get('2330'), { stock_name: '台積電', net_shares: 12 });
  assert.equal(parsed.size, 1);
});
