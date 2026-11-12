'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { preflight } = require('../scripts/preflight_daily_gainers_m5_private_preview');
test('M5 research is not yet actual media proof', () => {
  const p = preflight();
  assert.equal(p.date, '20261008');
  assert.equal(p.scene_count, 7);
  assert.deepEqual(p.market_opening_target_seconds, [60, 90]);
  assert.equal(p.whole_video_duration_minimum_seconds, 300);
  assert.equal(p.whole_video_duration_maximum_seconds, null);
  assert.equal(p.media_proof_complete, false);
  assert.equal(p.publication_authorized, false);
});
