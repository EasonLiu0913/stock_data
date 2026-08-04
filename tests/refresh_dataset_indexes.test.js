'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DATASETS } = require('../scripts/refresh_dataset_indexes');

test('dataset index definitions use stable latest-date ordering', () => {
  const manifest = DATASETS.vix.manifest({ dates: ['20251103', '20251104'], generatedAt: 'now' });
  assert.equal(manifest.latest_date, '20251104');
  assert.equal(manifest.latest_file, 'data_vix/20251104/vix.json');
});
