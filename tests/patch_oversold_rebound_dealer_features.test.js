'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseDealerPayload } = require('../scripts/patch_oversold_rebound_dealer_features');
const { createInvalidReplacingCrawlDate } = require('../scripts/crawl_twse_dealers');

test('dealer parser reads stock code from column zero and total net from final numeric column', () => {
  const parsed = parseDealerPayload({
    data: [
      ['2330', '台積電', '10', '2', '8', '5', '1', '4', '15', '3', '12'],
      ['', '合計', '1', '2', '3'],
    ],
  });
  assert.deepEqual(parsed.get('2330'), { stock_name: '台積電', net_shares: 12 });
  assert.equal(parsed.size, 1);
});

test('dealer crawler replaces an invalid existing file only after a successful crawl', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealer-replace-'));
  const outputPath = path.join(outputDir, '20260731_twse_dealers.json');
  fs.writeFileSync(outputPath, '', 'utf8');

  const baseCrawler = {
    normalizeDateInput: value => value,
    validateExistingFile: () => { throw new Error('empty existing file'); },
    crawlDate: async options => {
      assert.equal(fs.existsSync(outputPath), false);
      fs.writeFileSync(outputPath, JSON.stringify({ stat: 'OK', date: options.targetDate, data: [['2330']] }), 'utf8');
      return { status: 'created', outputPath };
    },
  };
  const crawlDate = createInvalidReplacingCrawlDate(baseCrawler, {
    endpointId: 'TWT43U',
    outputDir,
    fileSuffix: 'twse_dealers',
    minRows: 1,
  });

  const result = await crawlDate({ targetDate: '20260731', outputDir });
  assert.equal(result.replaced_invalid_existing, true);
  assert.match(fs.readFileSync(outputPath, 'utf8'), /"stat":"OK"/);
  assert.equal(fs.readdirSync(outputDir).some(file => file.includes('invalid-backup')), false);
});

test('dealer crawler restores the invalid file when replacement download fails', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealer-restore-'));
  const outputPath = path.join(outputDir, '20260731_twse_dealers.json');
  const original = 'legacy-empty-placeholder';
  fs.writeFileSync(outputPath, original, 'utf8');

  const baseCrawler = {
    normalizeDateInput: value => value,
    validateExistingFile: () => { throw new Error('invalid existing file'); },
    crawlDate: async () => { throw new Error('network failed'); },
  };
  const crawlDate = createInvalidReplacingCrawlDate(baseCrawler, {
    endpointId: 'TWT43U',
    outputDir,
    fileSuffix: 'twse_dealers',
    minRows: 1,
  });

  await assert.rejects(() => crawlDate({ targetDate: '20260731', outputDir }), /network failed/);
  assert.equal(fs.readFileSync(outputPath, 'utf8'), original);
  assert.equal(fs.readdirSync(outputDir).some(file => file.includes('invalid-backup')), false);
});
