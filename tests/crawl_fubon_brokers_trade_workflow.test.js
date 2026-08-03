'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'crawl-fubon-brokers-trade.yml'),
  'utf8',
);

test('automatically retries resumable broker crawl incompleteness', () => {
  assert.match(workflow, /first_status=\$\{PIPESTATUS\[0\]\}/);
  assert.match(workflow, /if \[ "\$first_status" = "2" \]; then/);
  assert.match(workflow, /Automatic pending retry pass/);
  assert.match(workflow, /node scripts\/scraper_json_driven\.js "\$target"/);
  assert.match(workflow, /status=\$\{PIPESTATUS\[0\]\}/);
});

test('reserves time and reuses completed CSV files for the retry pass', () => {
  assert.match(workflow, /270m/);
  assert.match(workflow, /25m/);
  assert.match(workflow, /after the automatic retry pass/);
  assert.doesNotMatch(workflow, /node scripts\/scraper_json_driven\.js "\$target" --force/);
});
