'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNarrationRepetition } = require('../scripts/daily_gainers_text_cleanup');

test('removes adjacent duplicated financial narration terms', () => {
  assert.equal(normalizeNarrationRepetition('接下來追蹤追蹤法人動向。'), '接下來追蹤法人動向。');
  assert.equal(normalizeNarrationRepetition('觀察觀察觀察、分析 分析、確認確認。'), '觀察、分析、確認。');
  assert.equal(normalizeNarrationRepetition('持續追蹤追蹤強勢股'), '持續追蹤強勢股');
});

test('preserves natural reduplication and distinct words', () => {
  assert.equal(normalizeNarrationRepetition('我們看看市場，慢慢研究研究趨勢。'), '我們看看市場，慢慢研究趨勢。');
  assert.equal(normalizeNarrationRepetition('追蹤、追蹤不同面向。'), '追蹤、追蹤不同面向。');
  assert.equal(normalizeNarrationRepetition('持續追蹤籌碼'), '持續追蹤籌碼');
});

test('keeps source values such as dates and slash expressions untouched', () => {
  const source = '10/7 法人/分點，追蹤追蹤 2330。';
  assert.equal(normalizeNarrationRepetition(source), '10/7 法人/分點，追蹤 2330。');
});
