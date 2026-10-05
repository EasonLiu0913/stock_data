'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'daily-gainers-over-5.yml');
const RENDERER = 'scripts/write_workflow_schedule_summary.js';
const MIGRATOR = require('../scripts/migrate_workflow_schedule_summary');

function workflowText() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

test('schedule-summary v2 renderer exists', () => {
  assert.equal(fs.existsSync(path.join(ROOT, RENDERER)), true);
});

test('daily-gainers embeds schedule-summary v2 in generate job only', () => {
  const text = workflowText();
  assert.equal(MIGRATOR.EMBEDDED_TARGETS.get('daily-gainers-over-5.yml'), 'generate');
  assert.match(text, /# schedule-timing-summary:v2/);
  assert.match(text, /if: always\(\) && github\.event_name == 'schedule'/);
  assert.match(text, /run: node scripts\/write_workflow_schedule_summary\.js/);
  assert.doesNotMatch(text, /\n  schedule-timing-summary:\n/);
});

test('daily-gainers sparse checkout materializes schedule-summary renderer before use', () => {
  const text = workflowText();

  // The checkout action uses sparse-checkout initially.
  const checkoutBlock = text.match(/sparse-checkout:\s*\|([\s\S]*?)(?=\n\s{6}- name:|\n\s{4}[A-Za-z0-9_-]+:|$)/);
  assert.ok(checkoutBlock, 'expected sparse-checkout block');
  assert.match(
    checkoutBlock[1],
    /\/scripts\/write_workflow_schedule_summary\.js/,
    'initial sparse checkout must include schedule-summary renderer',
  );

  // Resolve dates later replaces the sparse-checkout set, so the renderer must
  // also be present in that replacement pattern list.
  const patternsBlock = text.match(/patterns=\(([\s\S]*?)\n\s*\)/);
  assert.ok(patternsBlock, 'expected dynamic sparse-checkout patterns list');
  assert.match(
    patternsBlock[1],
    /'\/scripts\/write_workflow_schedule_summary\.js'/,
    'dynamic sparse-checkout reset must preserve schedule-summary renderer',
  );
});

test('schedule-summary v2 contract stays independent of global scheduled-workflow registry', () => {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(source, /audit_scheduled_workflow_outputs/);
  assert.doesNotMatch(source, /scheduledWorkflowFiles/);
  assert.doesNotMatch(source, /buildRules/);
});
