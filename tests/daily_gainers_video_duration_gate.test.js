#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { isWholeVideoDurationValid } = require('../scripts/render_daily_gainers_video');

assert.equal(isWholeVideoDurationValid(636.831224), true, 'the observed 10.61-minute render passes without a maximum');
assert.equal(isWholeVideoDurationValid(299.999), false, 'durations below five minutes fail');
assert.equal(isWholeVideoDurationValid(300), true, 'exactly five minutes passes');
assert.equal(isWholeVideoDurationValid(Number.NaN), false, 'an invalid measured duration fails closed');

console.log('Daily gainers whole-video duration gate regression PASS');
