'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWarrantFilename } = require('../scripts/extract_warrant_data');

test('warrant filename is derived from the source title end date', () => {
    assert.equal(
        buildWarrantFilename('114年12月01日 ~ 114年12月05日 發行之標的證券排行'),
        '20251205發行之標的證券排行.csv'
    );
});

test('single-digit source month/day are normalized without using runner time', () => {
    assert.equal(
        buildWarrantFilename('115年1月2日 ~ 115年1月9日 發行之標的證券排行'),
        '20260109發行之標的證券排行.csv'
    );
});

test('missing source title fails closed instead of fabricating a runner date', () => {
    assert.throws(
        () => buildWarrantFilename(''),
        /refusing to fabricate an artifact date from runner time/
    );
});

test('malformed source title fails closed instead of inventing a filename', () => {
    assert.throws(
        () => buildWarrantFilename('發行之標的證券排行'),
        /does not contain the expected source date range/
    );
});
