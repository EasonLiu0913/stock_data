#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  isWholeVideoDurationValid,
  isMarketOpeningDurationValid
} = require('../scripts/render_daily_gainers_video');

assert.equal(isWholeVideoDurationValid(636.831224), true, 'the observed 10.61-minute render passes without a maximum');
assert.equal(isWholeVideoDurationValid(299.999), false, 'durations below five minutes fail');
assert.equal(isWholeVideoDurationValid(300), true, 'exactly five minutes passes');
assert.equal(isWholeVideoDurationValid(Number.NaN), false, 'an invalid measured duration fails closed');

assert.equal(isMarketOpeningDurationValid(39.999), false, 'opening below 40 seconds fails');
assert.equal(isMarketOpeningDurationValid(40), true, 'exactly 40 seconds passes');
assert.equal(isMarketOpeningDurationValid(50.808), true, 'the measured 50.808-second opening passes');
assert.equal(isMarketOpeningDurationValid(90.001), true, 'there is no upper duration limit');
assert.equal(isMarketOpeningDurationValid(Number.MAX_VALUE), true, 'any finite duration above the floor passes');
assert.equal(isMarketOpeningDurationValid(undefined), false, 'a missing duration fails closed');
assert.equal(isMarketOpeningDurationValid(Number.NaN), false, 'NaN fails closed');
assert.equal(isMarketOpeningDurationValid(Infinity), false, 'an infinite duration fails closed');

console.log('Daily gainers whole-video and market-opening duration gates PASS');
