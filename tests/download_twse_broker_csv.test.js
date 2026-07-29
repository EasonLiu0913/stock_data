'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildOutputPath,
  normalizeStockCode,
  parseOfficialDataDate,
  validateDownloadLink,
  validateDownloadedFile,
} = require('../scripts/download_twse_broker_csv');

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'twse-broker-csv-test-'),
  );
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('normalizeStockCode accepts TWSE stock and security codes', () => {
  assert.equal(normalizeStockCode('2330'), '2330');
  assert.equal(normalizeStockCode(' 00632r '), '00632R');
  assert.throws(() => normalizeStockCode(''), /Invalid stock code/);
  assert.throws(() => normalizeStockCode('../2330'), /Invalid stock code/);
});

test('parseOfficialDataDate extracts and validates the TWSE data date', () => {
  assert.equal(
    parseOfficialDataDate('資料日期:2026/07/29 歡迎使用'),
    '20260729',
  );
  assert.equal(
    parseOfficialDataDate('資料日期：2026-7-9'),
    '20260709',
  );
  assert.throws(
    () => parseOfficialDataDate('資料日期:2026/02/30'),
    /invalid data date/,
  );
});

test('validateDownloadLink only accepts the expected TWSE CSV link', () => {
  assert.deepEqual(
    validateDownloadLink(
      'bsContent.aspx?StkNo=2330&RecCount=157',
      '2330',
    ),
    {
      url: 'https://bsr.twse.com.tw/bshtm/bsContent.aspx?StkNo=2330&RecCount=157',
      recordCount: 157,
    },
  );
  assert.throws(
    () => validateDownloadLink(
      'https://example.com/bsContent.aspx?StkNo=2330&RecCount=157',
      '2330',
    ),
    /Unexpected TWSE CSV download URL/,
  );
  assert.throws(
    () => validateDownloadLink(
      'bsContent.aspx?StkNo=2317&RecCount=157',
      '2330',
    ),
    /does not match/,
  );
  assert.throws(
    () => validateDownloadLink(
      'bsContent.aspx?StkNo=2330&RecCount=0',
      '2330',
    ),
    /invalid RecCount/,
  );
});

test('buildOutputPath uses official date and normalized stock code', () => {
  assert.equal(
    buildOutputPath('/tmp/raw', '20260729', '2330'),
    path.join('/tmp/raw', '20260729_2330_twse_broker_trades.csv'),
  );
});

test('validateDownloadedFile rejects empty and HTML responses', async () => {
  await withTemporaryDirectory(async (directory) => {
    const csvFile = path.join(directory, 'data.csv');
    const htmlFile = path.join(directory, 'error.csv');
    const emptyFile = path.join(directory, 'empty.csv');
    fs.writeFileSync(
      csvFile,
      'broker,price,buy,sell\n9A00,1000,2000,1000\n',
      'utf8',
    );
    fs.writeFileSync(
      htmlFile,
      '<html><body>session expired</body></html>',
      'utf8',
    );
    fs.writeFileSync(emptyFile, '', 'utf8');

    assert.equal(validateDownloadedFile(csvFile), 42);
    assert.throws(
      () => validateDownloadedFile(htmlFile),
      /HTML page instead of CSV/,
    );
    assert.throws(
      () => validateDownloadedFile(emptyFile),
      /empty or too small/,
    );
  });
});
