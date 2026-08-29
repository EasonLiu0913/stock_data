'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts', 'build_institutional_distribution_score.js');
const fixture = path.join(root, 'data_research', 'institutional-flow', 'tdcc-fixtures', '2449-2026Q2.json');
const rank = { watch: 0, yellow: 1, orange: 2, red: 3 };

test('2449 replay reaches the expected evidence milestones without date special-cases', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'institutional-distribution-'));
  const output = path.join(tmp, '2449.json');
  execFileSync(process.execPath, [script,
    '--stock', '2449',
    '--start', '2026-04-01',
    '--end', '2026-07-31',
    '--tdcc-fixture', fixture,
    '--output', output,
  ], { cwd: root, stdio: 'pipe' });

  const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(payload.research_only, true);
  assert.equal(payload.production_safe, false);
  assert.equal(payload.no_lookahead_contract.action_gate, 'available_at');

  const byDate = new Map(payload.timeline.map((x) => [x.observed_date, x]));
  assert.ok(rank[byDate.get('2026-04-17').level] >= rank.yellow, '2026-04-17 should be at least Yellow');
  assert.ok(rank[byDate.get('2026-04-24').level] >= rank.orange, '2026-04-24 should be at least Orange');
  assert.equal(byDate.get('2026-05-15').level, 'red', '2026-05-15 should be Red');

  for (const row of payload.timeline) {
    assert.ok(Date.parse(row.action_eligible_after) > Date.parse(`${row.observed_date}T23:59:59+08:00`), `${row.observed_date} must not become actionable on the observation day when using the fixture proxy`);
  }
});

test('research fixture declares that its availability timestamps are not production-safe', () => {
  const payload = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  assert.equal(payload.research_only, true);
  assert.equal(payload.production_safe, false);
  assert.match(payload.availability_policy, /proxy/);
  assert.ok(payload.observations.length >= 10);
  for (const row of payload.observations) assert.ok(row.available_at, `available_at missing for ${row.observed_date}`);
});
