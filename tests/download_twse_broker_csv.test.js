'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_UTF8_OUTPUT_DIR,
  buildOutputPath,
  convertCsvToUtf8,
  getDefaultUtf8OutputDir,
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

test('getDefaultUtf8OutputDir uses utf8 sibling for raw output', () => {
  assert.equal(getDefaultUtf8OutputDir(DEFAULT_OUTPUT_DIR), DEFAULT_UTF8_OUTPUT_DIR);
  assert.equal(
    getDefaultUtf8OutputDir('/tmp/downloads/raw'),
    path.join('/tmp/downloads', 'utf8'),
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

test('convertCsvToUtf8 converts TWSE CP950 CSV text', async () => {
  await withTemporaryDirectory(async (directory) => {
    const rawFile = path.join(directory, 'raw.csv');
    const utf8File = path.join(directory, 'utf8', 'data.csv');
    fs.writeFileSync(
      rawFile,
      Buffer.from([
        0xa8, 0xe9, 0xb0, 0xd3, 0x2c, 0xa6, 0x58, 0xae, 0x77, 0x0a,
        0x31, 0x2c, 0x31, 0x30, 0x32, 0x30, 0xa6, 0x58, 0xa1, 0x40,
        0xa1, 0x40, 0xae, 0x77, 0x0a,
      ]),
    );

    assert.equal(convertCsvToUtf8(rawFile, utf8File), 33);
    assert.equal(
      fs.readFileSync(utf8File, 'utf8'),
      '券商,合庫\n1,1020合　　庫\n',
    );
  });
});
