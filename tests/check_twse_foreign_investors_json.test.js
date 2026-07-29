'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  inferTargetDate,
  scanDirectory,
} = require('../scripts/check_twse_foreign_investors_json');

function makePayload(date, row) {
  const rocYear = Number(date.slice(0, 4)) - 1911;
  return {
    stat: 'OK',
    date,
    title: `${rocYear}年${date.slice(4, 6)}月${date.slice(6, 8)}日 外資及陸資買賣超彙總表`,
    fields: [
      '',
      '證券代號',
      '證券名稱',
      '買進股數',
      '賣出股數',
      '買賣超股數',
      '買進股數',
      '賣出股數',
      '買賣超股數',
      '買進股數',
      '賣出股數',
      '買賣超股數',
    ],
    data: [row],
    groups: [
      { start: 0, span: 3, title: '' },
      { start: 3, span: 3, title: '外資及陸資(不含外資自營商)' },
      { start: 6, span: 3, title: '外資自營商' },
      { start: 9, span: 3, title: '外資及陸資' },
    ],
  };
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'twse-foreign-check-'));
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('inferTargetDate prefers filename date and falls back to payload date', () => {
  assert.equal(
    inferTargetDate('/tmp/20260525_twse_foreign_investors.json', { date: '20260526' }),
    '20260525',
  );
  assert.equal(
    inferTargetDate('/tmp/custom.json', { date: '20260526' }),
    '20260526',
  );
});

test('scanDirectory recursively reports invalid and malformed JSON files', async () => {
  await withTemporaryDirectory(async (directory) => {
    const inputDir = path.join(directory, 'data');
    const outputFile = path.join(directory, 'report.json');
    const validRow = [
      ' ', '2330', '台積電',
      '10', '4', '6',
      '0', '0', '0',
      '10', '4', '6',
    ];
    const invalidRow = [
      ' ', '9914', '美利達',
      '685,000', '467,000', '218,000',
    ];

    writeJson(
      path.join(inputDir, '20260524_twse_foreign_investors.json'),
      makePayload('20260524', validRow),
    );
    writeJson(
      path.join(inputDir, 'nested', '20260525_twse_foreign_investors.json'),
      makePayload('20260525', invalidRow),
    );
    fs.writeFileSync(
      path.join(inputDir, '20260526_twse_foreign_investors.json'),
      '{ invalid json',
      'utf8',
    );
    writeJson(path.join(inputDir, 'files.json'), [
      '20260524_twse_foreign_investors.json',
    ]);

    const report = scanDirectory({
      inputDir,
      outputFile,
      minRows: 1,
    });

    assert.equal(report.counts.discovered_json_files, 4);
    assert.equal(report.counts.scanned_data_files, 3);
    assert.equal(report.counts.valid_files, 1);
    assert.equal(report.counts.invalid_files, 2);
    assert.equal(report.counts.skipped_metadata_files, 1);

    const invalidRowFile = report.invalid_files.find((item) => (
      item.target_date === '20260525'
    ));
    assert.equal(invalidRowFile.error_type, 'validation_error');
    assert.equal(invalidRowFile.row_context.row_index, 0);
    assert.equal(invalidRowFile.row_context.field_count, 6);
    assert.equal(invalidRowFile.row_context.expected_field_count, 12);
    assert.equal(invalidRowFile.row_context.stock_code, '9914');
    assert.equal(invalidRowFile.row_context.stock_name, '美利達');

    const malformedFile = report.invalid_files.find((item) => (
      item.target_date === '20260526'
    ));
    assert.equal(malformedFile.error_type, 'json_parse_error');
    assert.equal(fs.existsSync(outputFile), true);

    const savedReport = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    assert.equal(savedReport.counts.invalid_files, 2);
  });
});
