'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  inspectRequiredFiles,
  normalizeCompactDate,
  requiredFiles
} = require('../scripts/check_forecast_required_files');

test('normalizeCompactDate accepts compact and ISO dates', () => {
  assert.equal(normalizeCompactDate('20260724'), '20260724');
  assert.equal(normalizeCompactDate('2026-07-24'), '20260724');
  assert.throws(() => normalizeCompactDate(''), /未設定/);
});

test('inspectRequiredFiles reports every missing or empty file', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forecast-preflight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const files = requiredFiles('20260724');
  for (const file of files) {
    const absolutePath = path.join(root, file.relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'ok\n');
  }

  assert.deepEqual(inspectRequiredFiles(root, '20260724'), []);

  fs.rmSync(path.join(root, files[0].relativePath));
  fs.writeFileSync(path.join(root, files[1].relativePath), '');
  assert.deepEqual(
    inspectRequiredFiles(root, '20260724').map(({ relativePath, reason }) => ({ relativePath, reason })),
    [
      { relativePath: files[0].relativePath, reason: '檔案不存在' },
      { relativePath: files[1].relativePath, reason: '檔案是空的' }
    ]
  );
});
