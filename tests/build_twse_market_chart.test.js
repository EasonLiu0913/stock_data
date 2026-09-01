const test = require('node:test');
const assert = require('node:assert/strict');

const {
  listMonths,
  previousMonthStart,
  selectMonthsToFetch
} = require('../scripts/build_twse_market_chart');

test('listMonths enumerates inclusive month starts', () => {
  assert.deepEqual(listMonths('20260115', '20260430'), [
    '20260101', '20260201', '20260301', '20260401'
  ]);
});

test('previousMonthStart crosses year boundary', () => {
  assert.equal(previousMonthStart('20260101'), '20251201');
});

test('incremental mode refreshes only previous and current month', () => {
  const existingOutput = {
    startDate: '20240101',
    endDate: '20260831',
    data: [{ date: '20240102' }, { date: '20260831' }]
  };
  assert.deepEqual(
    selectMonthsToFetch('20240101', '20260902', existingOutput, false),
    ['20260801', '20260901']
  );
});

test('incremental recovery fills every month after an execution gap', () => {
  const existingOutput = {
    startDate: '20240101',
    endDate: '20260831',
    data: [{ date: '20240102' }, { date: '20260831' }]
  };
  assert.deepEqual(
    selectMonthsToFetch('20240101', '20261215', existingOutput, false),
    ['20260801', '20260901', '20261001', '20261101', '20261201']
  );
});

test('full rebuild explicitly fetches the complete range', () => {
  const existingOutput = {
    startDate: '20240101',
    endDate: '20260831',
    data: [{ date: '20240102' }]
  };
  const months = selectMonthsToFetch('20240101', '20260902', existingOutput, true);
  assert.equal(months[0], '20240101');
  assert.equal(months.at(-1), '20260901');
  assert.equal(months.length, 33);
});

test('missing reusable history falls back to complete range', () => {
  assert.deepEqual(
    selectMonthsToFetch('20260701', '20260902', null, false),
    ['20260701', '20260801', '20260901']
  );
});
