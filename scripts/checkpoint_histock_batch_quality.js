#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const tasksCsv = getArg('tasks');
const batch = Number(getArg('batch', '0'));
const runId = getArg('run-id', process.env.GITHUB_RUN_ID || 'local');
if (!tasksCsv) throw new Error('--tasks is required');

const tasks = tasksCsv.split(',').filter(Boolean).map((value) => {
  const at = value.indexOf('@');
  if (at <= 0) throw new Error(`Invalid task: ${value}`);
  return { stock: value.slice(0, at), date: value.slice(at + 1) };
});

const result = { quality_version: QUALITY_VERSION, batch, run_id: runId, valid: [], rejected: [], missing: [] };
for (const task of tasks) {
  const root = path.join('data_research', 'institutional-flow', 'histock', task.stock);
  const file = path.join(root, 'daily', `${task.date.replaceAll('-', '')}.json`);
  const statusDir = path.join(root, 'batch-status');
  fs.mkdirSync(statusDir, { recursive: true });
  if (!fs.existsSync(file)) {
    result.missing.push(task);
    continue;
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    const rejection = { ...task, reasons: ['invalid_json'], error: error.message };
    result.rejected.push(rejection);
    fs.unlinkSync(file);
    fs.writeFileSync(path.join(statusDir, `run-${runId}-batch-${String(batch).padStart(3, '0')}-${task.date.replaceAll('-', '')}-quality.json`), `${JSON.stringify({ schema_version: 1, type: 'data_quality_rejected', quality_version: QUALITY_VERSION, ...rejection, generated_at: new Date().toISOString() }, null, 2)}\n`);
    continue;
  }
  const check = validateDailyPayload(payload, task);
  if (!check.valid) {
    const rejection = { ...task, reasons: check.reasons, record_quality: check.record_quality };
    result.rejected.push(rejection);
    fs.unlinkSync(file);
    fs.writeFileSync(path.join(statusDir, `run-${runId}-batch-${String(batch).padStart(3, '0')}-${task.date.replaceAll('-', '')}-quality.json`), `${JSON.stringify({ schema_version: 1, type: 'data_quality_rejected', quality_version: QUALITY_VERSION, ...rejection, generated_at: new Date().toISOString() }, null, 2)}\n`);
    continue;
  }
  result.valid.push(task);
}

console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `quality_valid=${result.valid.length}\nquality_rejected=${result.rejected.length}\nquality_missing=${result.missing.length}\n`);
}
