'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalizeTextArray(value, field, code) {
  if (Array.isArray(value)) {
    if (!value.every(nonEmptyText)) throw new Error(`${field} invalid ${code}`);
    return value;
  }
  if (nonEmptyText(value)) return [value.trim()];
  throw new Error(`${field} invalid ${code}`);
}

function sourceTitleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

function canonicalizeSources(value, code) {
  if (!Array.isArray(value)) throw new Error(`sources invalid ${code}`);
  return value.map((source) => {
    if (nonEmptyText(source)) {
      const url = source.trim();
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error(`source invalid ${code}`); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`source invalid ${code}`);
      return { title: sourceTitleFromUrl(url), url };
    }
    if (source && typeof source === 'object') return source;
    throw new Error(`source invalid ${code}`);
  });
}

function canonicalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.analyses)) {
    throw new Error('Invalid daily gainers news analysis payload');
  }
  let changed = false;
  const analyses = payload.analyses.map((analysis) => {
    const code = String(analysis && analysis.code || '(unknown)');
    const evidence = canonicalizeTextArray(analysis.evidence, 'evidence', code);
    const followUp = canonicalizeTextArray(analysis.follow_up, 'follow_up', code);
    const sources = canonicalizeSources(analysis.sources, code);
    if (!Array.isArray(analysis.evidence) || !Array.isArray(analysis.follow_up) ||
        analysis.sources.some((source) => typeof source === 'string')) changed = true;
    return { ...analysis, evidence, follow_up: followUp, sources };
  });
  return { payload: { ...payload, analyses }, changed };
}

function main() {
  const date = process.argv[2];
  if (!/^20\d{6}$/.test(String(date || ''))) throw new Error('date must be YYYYMMDD');
  const file = path.join(ROOT, 'data_daily_gain_over_5', 'analysis-news', `${date}.json`);
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { payload, changed } = canonicalizePayload(original);
  if (changed) fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ date, changed, stock_count: payload.analyses.length }));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { canonicalizePayload };
