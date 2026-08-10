#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const OUTPUT_DIR = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality');
const OUTPUT = path.join(OUTPUT_DIR, 'financial-quality-master.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function main() {
  if (!fs.existsSync(INPUT_ROOT)) throw new Error(`Missing ${path.relative(ROOT, INPUT_ROOT)}`);
  const stocks = [];
  let quarterlyRows = 0;
  let unsupported = 0;

  for (const entry of fs.readdirSync(INPUT_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4,6}$/.test(entry.name)) continue;
    const stockId = entry.name;
    const dir = path.join(INPUT_ROOT, stockId);
    const timeline = readJson(path.join(dir, 'financial-quality-score-timeline.json'));
    const coverage = readJson(path.join(dir, 'coverage-status.json'));
    if (!timeline || !Array.isArray(timeline.rows)) continue;
    const rows = timeline.rows.map((row, index) => {
      const prevScore = index > 0 ? Number(timeline.rows[index - 1]?.financial_quality_score) : null;
      const score = Number(row.financial_quality_score);
      return {
        fiscal_period: row.fiscal_period,
        conservative_known_date: row.conservative_known_date || null,
        financial_quality_score: Number.isFinite(score) ? score : null,
        financial_quality_max_score: row.financial_quality_max_score ?? 14,
        score_jump_qoq: Number.isFinite(score) && Number.isFinite(prevScore) ? score - prevScore : null,
        revenue: row.revenue ?? null,
        gross_margin_pct: row.gross_margin_pct ?? null,
        operating_margin_pct: row.operating_margin_pct ?? null,
        eps: row.eps ?? null,
        metrics: row.metrics || {},
        score_reasons: row.score_reasons || [],
      };
    });
    quarterlyRows += rows.length;
    if (coverage?.status === 'unsupported_financial_model') unsupported += 1;
    stocks.push({
      stock_id: stockId,
      coverage: coverage || null,
      rows,
    });
  }

  stocks.sort((a, b) => a.stock_id.localeCompare(b.stock_id));
  const payload = {
    schema_version: 1,
    dataset: 'financial_quality_master',
    generated_at: new Date().toISOString(),
    methodology: {
      status: 'research_only',
      source: 'per-stock FinMind financial-quality timelines',
      availability: 'each quarterly row keeps its conservative_known_date; later event joins must only use rows whose known date is not after the event date',
      score_jump_qoq: 'current financial quality score minus prior available fiscal-quarter score',
    },
    counts: {
      stocks: stocks.length,
      quarterly_rows: quarterlyRows,
      unsupported_financial_model: unsupported,
    },
    stocks,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), ...payload.counts }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
