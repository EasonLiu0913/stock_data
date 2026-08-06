'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  latestCompletedUsMarketDate,
  expectedUsMarketDate,
} = require('../scripts/generate_market_environment');

test('Taipei early morning uses the latest completed US session', () => {
  const taipeiEarlyMorning = new Date('2026-08-06T17:42:00.000Z');
  assert.equal(latestCompletedUsMarketDate(taipeiEarlyMorning), '20260805');
  assert.equal(expectedUsMarketDate('20260806', taipeiEarlyMorning), '20260805');
});

test('after the regular US close the same US market date becomes available', () => {
  const afterNewYorkClose = new Date('2026-08-06T20:45:00.000Z');
  assert.equal(latestCompletedUsMarketDate(afterNewYorkClose), '20260806');
  assert.equal(expectedUsMarketDate('20260806', afterNewYorkClose), '20260806');
});

test('historical base dates never advance to a newer completed US session', () => {
  const afterNewYorkClose = new Date('2026-08-06T20:45:00.000Z');
  assert.equal(expectedUsMarketDate('20260727', afterNewYorkClose), '20260727');
});
