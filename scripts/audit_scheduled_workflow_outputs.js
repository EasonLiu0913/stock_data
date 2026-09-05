#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  addDays,
  loadHolidaySet,
  previousTradingDate,
} = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
const DATE_RE = /^20\d{6}$/;

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function compact(iso) {
  return String(iso).replaceAll('-', '');
}

function iso(compactDate) {
  if (!DATE_RE.test(String(compactDate))) throw new Error(`Invalid compact date: ${compactDate}`);
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function resolveAuditDates({ now = new Date(), auditDate = '', holidays = loadHolidaySet() } = {}) {
  const auditIso = auditDate ? iso(String(auditDate).replace(/[^0-9]/g, '')) : taipeiDate(now);
  const targetIso = previousTradingDate(auditIso, holidays, false);
  return {
    audit_date: compact(auditIso),
    target_trade_date: compact(targetIso),
    target_trade_date_iso: targetIso,
  };
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

function listFiles(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function listDirectories(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function previousMonth(compactDate) {
  const d = new Date(Date.UTC(
    Number(compactDate.slice(0, 4)),
    Number(compactDate.slice(4, 6)) - 1,
    1,
  ));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function newestPeriodDirectory(rootRel, pattern) {
  return listDirectories(rootRel).filter((name) => pattern.test(name)).sort().at(-1) || null;
}

function exactRule(workflow, semantic, pathsFn, note = '') {
  return {
    workflow, semantic, note,
    check(ctx) {
      const expected = pathsFn(ctx);
      const missing = expected.filter((p) => !exists(p));
      return {
        expected,
        actual: expected.filter((p) => exists(p)),
        ok: missing.length === 0,
        missing,
      };
    },
  };
}

function prefixFilesRule(workflow, semantic, dir, predicateFn, expectedDescription, note = '') {
  return {
    workflow, semantic, note,
    check(ctx) {
      const files = listFiles(dir).filter((f) => predicateFn(f, ctx));
      return {
        expected: [`${dir}/${expectedDescription(ctx)}`],
        actual: files.map((f) => `${dir}/${f}`),
        ok: files.length > 0,
        missing: files.length ? [] : [`${dir}/${expectedDescription(ctx)}`],
      };
    },
  };
}

function sourceManifestRule(workflow, semantic, manifestRel, latestDateField, latestFileField, fallbackFileFn, note = '') {
  return {
    workflow, semantic, note,
    check(ctx) {
      const manifest = readJson(manifestRel);
      const latestDate = manifest?.[latestDateField] || null;
      const latestFile = manifest?.[latestFileField] || (latestDate ? fallbackFileFn(latestDate) : null);
      const dateOk = DATE_RE.test(String(latestDate || '')) && latestDate <= ctx.target_trade_date;
      const fileOk = Boolean(latestFile) && exists(latestFile);
      return {
        expected: [manifestRel, latestFile || fallbackFileFn('<source-date>')],
        actual: [manifestRel, latestFile].filter(Boolean).filter((p) => exists(p)),
        ok: Boolean(manifest) && dateOk && fileOk,
        missing: [
          ...(!manifest ? [manifestRel] : []),
          ...(manifest && !dateOk ? [`valid source date <= ${ctx.target_trade_date}`] : []),
          ...(manifest && dateOk && !fileOk ? [latestFile] : []),
        ],
        observed_date: latestDate,
      };
    },
  };
}

function rankingExpected(date) {
  const spans = [1,2,3,4,5,10,20,30];
  const names = [];
  for (const owner of ['上市主力', '上市外資']) {
    for (const side of ['買超', '賣超']) {
      for (const span of spans) names.push(`fubon_${date}_${owner}${side}${span}日排行.csv`);
    }
  }
  for (const suffix of ['上市值增排行.csv','上市值縮排行.csv','上市量增排行.csv','上市量縮排行.csv']) {
    names.push(`fubon_${date}_${suffix}`);
  }
  return names.map((name) => `data_fubon/${name}`);
}

function buildRules() {
  return [
    exactRule('analyze-daily-gainers-margin-flow-2200.yml', 'market_date',
      (c) => [`data_daily_gain_over_5/analysis-facts/${c.target_trade_date}.json`]),
    {
      workflow: 'backfill-oversold-rebound-coverage.yml',
      semantic: 'market_date',
      note: 'Coverage workflow is satisfied when all four canonical source datasets contain the target trade date.',
      check(c) {
        const expected = [
          `data_twse_investment_trust/${c.target_trade_date}_twse_investment_trust.json`,
          `data_twse_dealers/${c.target_trade_date}_twse_dealers.json`,
          `data_twse_margin_balance/${c.target_trade_date}_twse_margin_balance.csv`,
          `data_fubon_broker_details/fubon_${c.target_trade_date}_券商分點進出明細.json`,
        ];
        const missing = expected.filter((p) => !exists(p));
        return { expected, actual: expected.filter(exists), ok: missing.length === 0, missing };
      },
    },
    exactRule('build-etf-market-regime-analysis.yml', 'date_independent',
      () => ['public/data/etf-market-regime-analysis/data.json']),
    exactRule('build-twse-market-chart.yml', 'date_independent',
      () => ['data_twse_market_chart/market_chart.json']),
    exactRule('calculate-twse-margin-maintenance.yml', 'market_date',
      (c) => [`data_twse_margin_maintenance/${c.target_trade_date}_twse_margin_maintenance.json`]),
    exactRule('crawl-cnn-fear-and-greed.yml', 'source_observation_date',
      (c) => [`data_cnn_fear_and_greed/${c.target_trade_date}/cnn_fear_and_greed.json`],
      'CNN data_date is source-owned but normally matches the completed U.S. market date audited here.'),
    sourceManifestRule('crawl-eia-crude-spot.yml', 'source_observation_date',
      'data_eia_crude_spot/manifest.json', 'latest_date', 'latest_file',
      (d) => `data_eia_crude_spot/${d}/crude_spot.json`,
      'Do not require a folder named after the audit trade date; EIA publishes source observations in weekly batches.'),
    {
      workflow: 'crawl-external-market-indicators.yml',
      semantic: 'market_date',
      check(c) {
        const expected = [
          `data_external_market/${c.target_trade_date}/external_market_indicators.json`,
          `data_market_risk/${c.target_trade_date}/market_risk_snapshot.json`,
        ];
        const missing = expected.filter((p) => !exists(p));
        return { expected, actual: expected.filter(exists), ok: missing.length === 0, missing };
      },
    },
    exactRule('crawl-fubon-broker-details.yml', 'market_date',
      (c) => [`data_fubon_broker_details/fubon_${c.target_trade_date}_券商分點進出明細.json`]),
    {
      workflow: 'crawl-fubon-brokers-trade.yml',
      semantic: 'market_date',
      check(c) {
        const dir = `data_fubon_brokers_trade/${c.target_trade_date}`;
        const ok = exists(dir) && listFiles(dir).length > 0;
        return { expected: [`${dir}/<files>`], actual: ok ? [dir] : [], ok, missing: ok ? [] : [`${dir}/<files>`] };
      },
    },
    prefixFilesRule('crawl-institutional.yml', 'market_date', 'data_fubon',
      (f, c) => f.startsWith(`fubon_${c.target_trade_date}_institutional`),
      (c) => `fubon_${c.target_trade_date}_institutional*.json`),
    exactRule('crawl-market-news.yml', 'market_date',
      (c) => [`data_market_news/${c.target_trade_date}/market_news.json`, `data_market_risk/${c.target_trade_date}/market_risk_snapshot.json`]),
    exactRule('crawl-mops-monthly-revenue.yml', 'revenue_month',
      (c) => [`data_mops_monthly_revenue/${previousMonth(c.audit_date)}/monthly_revenue.json`],
      'Scheduled runs in the first half of the month collect the previous revenue month.'),
    exactRule('crawl-pocket-00981a.yml', 'latest_pointer',
      () => ['data_pocket/00981A_holdings_latest.json']),
    {
      workflow: 'crawl-rankings.yml',
      semantic: 'market_date',
      check(c) {
        const expected = rankingExpected(c.target_trade_date);
        const missing = expected.filter((p) => !exists(p));
        return { expected, actual: expected.filter(exists), ok: missing.length === 0, missing };
      },
    },
    sourceManifestRule('crawl-refined-product-tightness.yml', 'source_observation_date',
      'data_refined_product_tightness/manifest.json', 'latest_date', 'latest_file',
      (d) => `data_refined_product_tightness/${d}/refined_product_tightness.json`,
      'Aligned EIA observation_date is canonical; it may lag the audit trade date.'),
    prefixFilesRule('crawl-sma.yml', 'market_date', 'data_fubon',
      (f, c) => f.startsWith(`fubon_${c.target_trade_date}_sma`),
      (c) => `fubon_${c.target_trade_date}_sma*.json`),
    exactRule('crawl-taifex-major-institutional-traders-futures-contracts.yml', 'market_date',
      (c) => [`data_taifex_major_institutional_traders_futures_contracts/${c.target_trade_date}_taifex_major_institutional_traders_futures_contracts.json`]),
    exactRule('crawl-taifex-major-institutional-traders-futures-options.yml', 'market_date',
      (c) => [`data_taifex_major_institutional_traders_futures_options/${c.target_trade_date}_taifex_major_institutional_traders_futures_options.csv`]),
    {
      workflow: 'crawl-tdcc-shareholding-snapshot.yml',
      semantic: 'source_observation_date',
      note: 'TDCC weekly observed_date is source-owned; latest.json must point to an archived canonical weekly file available by audit time.',
      check(c) {
        const latest = readJson('data_tdcc_shareholding/latest.json');
        const observed = String(latest?.observed_date || '').replaceAll('-', '');
        const canonical = latest?.canonical_file ? `data_tdcc_shareholding/${latest.canonical_file}` : null;
        const available = latest?.available_at ? new Date(latest.available_at) : null;
        const auditBoundary = new Date(`${iso(c.audit_date)}T07:01:00+08:00`);
        const ok = DATE_RE.test(observed)
          && observed <= c.target_trade_date
          && Boolean(canonical)
          && exists(canonical)
          && available instanceof Date
          && !Number.isNaN(available.getTime())
          && available <= auditBoundary;
        return {
          expected: ['data_tdcc_shareholding/latest.json', canonical || 'data_tdcc_shareholding/weekly/<observed_date>.json'],
          actual: ['data_tdcc_shareholding/latest.json', canonical].filter(Boolean).filter(exists),
          ok,
          missing: ok ? [] : ['valid TDCC latest pointer and canonical weekly snapshot available by audit time'],
          observed_date: observed || null,
        };
      },
    },
    exactRule('crawl-twse-institutional-investors.yml', 'market_date',
      (c) => [`data_twse_institutional_investors/${c.target_trade_date}_twse_institutional_investors.json`]),
    exactRule('crawl-twse-institutional-summaries.yml', 'market_date',
      (c) => [
        `data_twse_foreign_investors/${c.target_trade_date}_twse_foreign_investors.json`,
        `data_twse_investment_trust/${c.target_trade_date}_twse_investment_trust.json`,
        `data_twse_dealers/${c.target_trade_date}_twse_dealers.json`,
      ]),
    exactRule('crawl-twse-margin-balance.yml', 'market_date',
      (c) => [`data_twse_margin_balance/${c.target_trade_date}_twse_margin_balance.csv`]),
    exactRule('crawl-twse-mi-index.yml', 'market_date',
      (c) => [`data_twse_mi_index/${c.target_trade_date}_twse_mi_index.json`]),
    {
      workflow: 'crawl-twse-quarterly-financial-quality.yml',
      semantic: 'fiscal_quarter',
      note: 'TWSE endpoint is a source-owned latest fiscal period snapshot, not a daily artifact.',
      check() {
        const period = newestPeriodDirectory('data_twse_quarterly_financial_quality', /^20\d{2}Q[1-4]$/);
        const file = period ? `data_twse_quarterly_financial_quality/${period}/income-statement-general.json` : null;
        const ok = Boolean(file) && exists(file);
        return {
          expected: [file || 'data_twse_quarterly_financial_quality/<YYYYQn>/income-statement-general.json'],
          actual: ok ? [file] : [],
          ok,
          missing: ok ? [] : ['latest quarterly income-statement-general.json'],
          fiscal_period: period,
        };
      },
    },
    exactRule('crawl-twse-twt49u.yml', 'market_date',
      (c) => [`data_twse_twt49u/${c.target_trade_date}_twt49u.json`]),
    exactRule('crawl-vix-index.yml', 'market_date',
      (c) => [`data_vix/${c.target_trade_date}/vix.json`]),
    exactRule('daily-gainers-over-5.yml', 'market_date',
      (c) => [`data_daily_gain_over_5/${c.target_trade_date}.json`, `data_daily_gain_over_5/market-summary/${c.target_trade_date}.json`]),
    {
      workflow: 'daily-prediction-replay.yml',
      semantic: 'forecast_date',
      check(c) {
        const expected = [
          `data_predictions/${c.target_trade_date}`,
          `data_predictions_v2/${c.target_trade_date}`,
          `data_prediction_comparisons/${c.target_trade_date}`,
        ];
        const missing = expected.filter((p) => !exists(p));
        return { expected, actual: expected.filter(exists), ok: missing.length === 0, missing };
      },
    },
    exactRule('daily-stock-prediction.yml', 'forecast_date',
      (c) => [`data_predictions/${c.target_trade_date}`, `data_predictions_v2/${c.target_trade_date}`]),
    {
      workflow: 'momentum-history-replay.yml',
      semantic: 'date_independent',
      check() {
        const files = listFiles('data_prediction_analysis').filter((f) => f.startsWith('momentum-'));
        return {
          expected: ['data_prediction_analysis/momentum-*'],
          actual: files.map((f) => `data_prediction_analysis/${f}`),
          ok: files.length > 0,
          missing: files.length ? [] : ['data_prediction_analysis/momentum-*'],
        };
      },
    },
    exactRule('prepare-market-environment.yml', 'forecast_date',
      (c) => [`data_market_environment/${c.target_trade_date}/market_environment.json`]),
    exactRule('publish-daily-gainers-ai-analysis.yml', 'market_date',
      (c) => [
        `data_daily_gain_over_5/analysis-ai/${c.target_trade_date}.json`,
        `data_daily_gain_over_5/analysis/${c.target_trade_date}.json`,
        `data_daily_gain_over_5/market-summary/${c.target_trade_date}.json`,
      ]),
    prefixFilesRule('retry-institutional.yml', 'market_date', 'data_fubon',
      (f, c) => f.startsWith(`fubon_${c.target_trade_date}_institutional`),
      (c) => `fubon_${c.target_trade_date}_institutional*.json`),
    prefixFilesRule('retry-sma.yml', 'market_date', 'data_fubon',
      (f, c) => f.startsWith(`fubon_${c.target_trade_date}_sma`),
      (c) => `fubon_${c.target_trade_date}_sma*.json`),
    exactRule('update-non-trading-days.yml', 'date_independent',
      () => ['data_history_sma/non_trading_days.json']),
    exactRule('update-official-market-constraints.yml', 'forecast_date',
      (c) => [
        `data_prediction_context/${c.target_trade_date}/latest.json`,
        `data_market_constraints/${c.target_trade_date}/snapshot.json`,
        `data_market_constraints/${c.target_trade_date}/disposition.json`,
        `data_market_constraints/${c.target_trade_date}/night-futures.json`,
      ]),
    {
      workflow: 'update-twse-industry.yml',
      semantic: 'date_independent',
      check() {
        const files = listFiles('data_twse').filter((f) => f.startsWith('twse_industry'));
        return {
          expected: ['data_twse/twse_industry*'],
          actual: files.map((f) => `data_twse/${f}`),
          ok: files.length > 0,
          missing: files.length ? [] : ['data_twse/twse_industry*'],
        };
      },
    },
    {
      workflow: 'warrant-scraper.yml',
      semantic: 'source_observation_date',
      note: 'Warrant canonical date is source-title-owned; audit validates that the date-independent TWSE output set exists rather than inventing a target-date filename.',
      check() {
        const files = listFiles('data_twse').filter((f) => /warrant|權證/i.test(f));
        return {
          expected: ['data_twse/<warrant canonical outputs>'],
          actual: files.map((f) => `data_twse/${f}`),
          ok: files.length > 0,
          missing: files.length ? [] : ['data_twse/<warrant canonical outputs>'],
        };
      },
    },
  ];
}

function audit({ now = new Date(), auditDate = '', holidays = loadHolidaySet() } = {}) {
  const ctx = resolveAuditDates({ now, auditDate, holidays });
  const results = buildRules().map((rule) => {
    const detail = rule.check(ctx);
    return {
      workflow: rule.workflow,
      semantic: rule.semantic,
      note: rule.note || '',
      ...detail,
    };
  });
  const missing = results.filter((r) => !r.ok);
  return {
    schema_version: 1,
    generated_at: now.toISOString(),
    time_zone: 'Asia/Taipei',
    ...ctx,
    workflow_count: results.length,
    missing_count: missing.length,
    ok_count: results.length - missing.length,
    status: missing.length ? 'missing_outputs' : 'complete',
    results,
    missing,
  };
}

function markdownSummary(report) {
  const lines = [
    '# Scheduled workflow output audit',
    '',
    `- Audit date (Taipei): **${report.audit_date}**`,
    `- Previous trading day: **${report.target_trade_date}**`,
    `- Workflows checked: **${report.workflow_count}**`,
    `- Missing: **${report.missing_count}**`,
    '',
    '| Workflow | Semantic | Status | Evidence |',
    '| --- | --- | --- | --- |',
  ];
  for (const row of report.results) {
    const evidence = row.ok
      ? (row.actual.slice(0, 3).join('<br>') || 'validated')
      : row.missing.join('<br>');
    lines.push(`| \`${row.workflow}\` | \`${row.semantic}\` | ${row.ok ? '✅' : '❌'} | ${evidence} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  const now = args.get('now') ? new Date(args.get('now')) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now: ${args.get('now')}`);
  const report = audit({ now, auditDate: args.get('audit-date') || '' });

  const output = args.get('output');
  if (output) {
    const abs = path.resolve(ROOT, output);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`);
  }

  const summary = markdownSummary(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  process.stdout.write(`${JSON.stringify({
    status: report.status,
    audit_date: report.audit_date,
    target_trade_date: report.target_trade_date,
    workflow_count: report.workflow_count,
    missing_count: report.missing_count,
    missing: report.missing.map((row) => ({ workflow: row.workflow, missing: row.missing })),
  }, null, 2)}\n`);

  if (report.missing_count > 0 && !args.has('no-fail')) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  audit,
  buildRules,
  markdownSummary,
  previousMonth,
  rankingExpected,
  resolveAuditDates,
};
