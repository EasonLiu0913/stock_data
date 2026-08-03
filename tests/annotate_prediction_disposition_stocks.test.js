'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  annotatePredictionDispositionStocks,
} = require('../scripts/annotate_prediction_disposition_stocks');
const { ROOT } = require('../scripts/market_environment_lib');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('annotator marks complete disposition data and active stocks', () => {
  const rootDir = path.relative(ROOT, fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-disposition-root-')));
  const date = '20990104';
  const predictionDir = path.join(ROOT, rootDir, date);
  const constraintDir = path.join(ROOT, 'data_market_constraints', date);
  try {
    writeJson(path.join(predictionDir, 'summary.json'), {
      stocks: [
        { stock_code: '2330' },
        { stock_code: '6477' },
      ],
    });
    writeJson(path.join(constraintDir, 'disposition.json'), {
      complete_market_coverage: true,
      active_stock_codes: ['6477'],
    });
    const result = annotatePredictionDispositionStocks({ rootDir, date });
    const summary = JSON.parse(fs.readFileSync(path.join(predictionDir, 'summary.json'), 'utf8'));
    assert.equal(result.calculation_status, 'completed');
    assert.equal(summary.stocks[0].disposition_data_complete, 1);
    assert.equal(summary.stocks[0].is_disposition_stock, false);
    assert.equal(summary.stocks[1].disposition_data_complete, 1);
    assert.equal(summary.stocks[1].is_disposition_stock, true);
  } finally {
    fs.rmSync(path.join(ROOT, rootDir), { recursive: true, force: true });
    fs.rmSync(constraintDir, { recursive: true, force: true });
  }
});

test('annotator marks incomplete official data as unavailable for strategy use', () => {
  const rootDir = path.relative(ROOT, fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-disposition-root-')));
  const date = '20990105';
  const predictionDir = path.join(ROOT, rootDir, date);
  const constraintDir = path.join(ROOT, 'data_market_constraints', date);
  try {
    writeJson(path.join(predictionDir, 'summary.json'), { stocks: [{ stock_code: '2330' }] });
    writeJson(path.join(constraintDir, 'disposition.json'), {
      complete_market_coverage: false,
      active_stock_codes: ['2330'],
    });
    const result = annotatePredictionDispositionStocks({ rootDir, date });
    const stock = JSON.parse(fs.readFileSync(path.join(predictionDir, 'summary.json'), 'utf8')).stocks[0];
    assert.equal(result.calculation_status, 'incomplete');
    assert.equal(stock.disposition_data_complete, null);
    assert.equal(stock.is_disposition_stock, false);
    assert.equal(stock.disposition_stock_status, 'incomplete');
  } finally {
    fs.rmSync(path.join(ROOT, rootDir), { recursive: true, force: true });
    fs.rmSync(constraintDir, { recursive: true, force: true });
  }
});
