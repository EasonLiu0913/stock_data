#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const TAIPEI_TZ = 'Asia/Taipei';
const DEFAULT_TIMEOUT_MS = 30000;

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function taipeiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function taipeiIso(now = new Date()) {
  const p = taipeiParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
}

function autoRevenueMonth(now = new Date()) {
  const p = taipeiParts(now);
  let year = Number(p.year);
  let month = Number(p.month) - 1;
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  return `${year}${String(month).padStart(2, '0')}`;
}

function normalizeRevenueMonth(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{4}$/.test(compact)) throw new Error(`Invalid revenue month: ${value || '(empty)'}`);
  const month = Number(compact.slice(4, 6));
  if (month < 1 || month > 12) throw new Error(`Invalid revenue month: ${value}`);
  return compact;
}

function previousRevenueMonth(value) {
  const month = normalizeRevenueMonth(value);
  let year = Number(month.slice(0, 4));
  let m = Number(month.slice(4, 6)) - 1;
  if (m === 0) {
    year -= 1;
    m = 12;
  }
  return `${year}${String(m).padStart(2, '0')}`;
}

function buildSourceUrl(revenueMonth) {
  const month = normalizeRevenueMonth(revenueMonth);
  const year = Number(month.slice(0, 4));
  const rocYear = year - 1911;
  const m = Number(month.slice(4, 6));
  return `https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_${rocYear}_${m}_0.html`;
}

function decodeHtml(buffer, contentType = '') {
  const header = String(contentType).toLowerCase();
  const declaredBig5 = /charset\s*=\s*(big5|ms950|cp950)/i.test(header);
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!declaredBig5 && utf8.includes('上市公司') && !utf8.includes('\uFFFD')) return utf8;
  try {
    const big5 = new TextDecoder('big5').decode(buffer);
    if (big5.includes('上市公司') || declaredBig5) return big5;
  } catch {}
  return utf8;
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(text || '')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanCell(html) {
  return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  const text = String(value ?? '').replace(/,/g, '').replace(/％/g, '%').trim();
  if (!text || text === '-' || text === '—') return null;
  const numeric = Number(text.replace(/%$/, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseReportDate(html) {
  const text = cleanCell(html);
  const match = text.match(/出表日期[:：]\s*(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]) + 1911;
  return `${year}${String(match[2]).padStart(2, '0')}${String(match[3]).padStart(2, '0')}`;
}

function parseIndustryLabel(cells) {
  for (const cell of cells) {
    const match = cell.match(/產業別[:：]\s*(.+?)(?:\s+單位[:：]|$)/);
    if (match) return match[1].trim();
  }
  return null;
}

function parseMopsRevenueHtml(html, revenueMonth) {
  const normalizedMonth = normalizeRevenueMonth(revenueMonth);
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  let industry = null;
  const companies = [];
  for (const rowMatch of rows) {
    const cellMatches = [...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)];
    const cells = cellMatches.map((match) => cleanCell(match[1])).filter((value) => value !== '');
    if (!cells.length) continue;
    const detectedIndustry = parseIndustryLabel(cells);
    if (detectedIndustry) {
      industry = detectedIndustry;
      continue;
    }
    const codeIndex = cells.findIndex((value) => /^\d{4,6}$/.test(value));
    if (codeIndex < 0) continue;
    const values = cells.slice(codeIndex);
    if (values.length < 9) continue;
    const [stockCode, stockName] = values;
    const monthlyRevenue = parseNumber(values[2]);
    const previousMonthRevenue = parseNumber(values[3]);
    const lastYearMonthRevenue = parseNumber(values[4]);
    const momPct = parseNumber(values[5]);
    const yoyPct = parseNumber(values[6]);
    const ytdRevenue = parseNumber(values[7]);
    const lastYearYtdRevenue = parseNumber(values[8]);
    const ytdYoyPct = parseNumber(values[9]);
    const note = values.slice(10).join(' ').trim();
    if (!stockName || monthlyRevenue === null || ytdRevenue === null) continue;
    companies.push({
      stock_code: stockCode,
      stock_name: stockName,
      industry: industry || null,
      revenue_month: normalizedMonth,
      monthly_revenue_thousand_twd: monthlyRevenue,
      previous_month_revenue_thousand_twd: previousMonthRevenue,
      last_year_month_revenue_thousand_twd: lastYearMonthRevenue,
      mom_pct: momPct,
      yoy_pct: yoyPct,
      ytd_revenue_thousand_twd: ytdRevenue,
      last_year_ytd_revenue_thousand_twd: lastYearYtdRevenue,
      ytd_yoy_pct: ytdYoyPct,
      note: note && note !== '-' ? note : null,
    });
  }
  const unique = new Map();
  for (const row of companies) unique.set(row.stock_code, row);
  const result = [...unique.values()].sort((a, b) => a.stock_code.localeCompare(b.stock_code));
  if (!result.length) throw new Error('MOPS revenue page contained no company rows.');
  return { report_date: parseReportDate(html), companies: result };
}

async function fetchHtml(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 (compatible; stock-data-mops-monthly-revenue/1.0)',
      },
    });
    if (!response.ok) throw new Error(`MOPS HTTP ${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      html: decodeHtml(bytes, response.headers.get('content-type') || ''),
      bytes,
      content_type: response.headers.get('content-type') || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function monthOutputDir(revenueMonth) {
  return path.join(OUTPUT_ROOT, normalizeRevenueMonth(revenueMonth));
}

function compactTimestamp(now = new Date()) {
  const p = taipeiParts(now);
  return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}`;
}

function derivedForCompany(row, priorMonth) {
  const priorYoy = Number(priorMonth?.yoy_pct);
  const yoyAcceleration = Number.isFinite(row.yoy_pct) && Number.isFinite(priorYoy)
    ? Number((row.yoy_pct - priorYoy).toFixed(4))
    : null;
  return {
    yoy_positive: Number.isFinite(row.yoy_pct) ? row.yoy_pct > 0 : null,
    yoy_ge_10: Number.isFinite(row.yoy_pct) ? row.yoy_pct >= 10 : null,
    yoy_ge_20: Number.isFinite(row.yoy_pct) ? row.yoy_pct >= 20 : null,
    yoy_ge_30: Number.isFinite(row.yoy_pct) ? row.yoy_pct >= 30 : null,
    mom_positive: Number.isFinite(row.mom_pct) ? row.mom_pct > 0 : null,
    ytd_yoy_positive: Number.isFinite(row.ytd_yoy_pct) ? row.ytd_yoy_pct > 0 : null,
    yoy_and_mom_positive: Number.isFinite(row.yoy_pct) && Number.isFinite(row.mom_pct)
      ? row.yoy_pct > 0 && row.mom_pct > 0
      : null,
    previous_month_yoy_pct: Number.isFinite(priorYoy) ? priorYoy : null,
    yoy_acceleration_pct_points: yoyAcceleration,
    yoy_accelerating: Number.isFinite(yoyAcceleration) ? yoyAcceleration > 0 : null,
  };
}

function enrichCompanies(companies, previousPayload, existingPayload, collectedAt) {
  const previousMap = new Map((previousPayload?.companies || []).map((row) => [row.stock_code, row]));
  const existingMap = new Map((existingPayload?.companies || []).map((row) => [row.stock_code, row]));
  return companies.map((row) => {
    const priorSeen = existingMap.get(row.stock_code);
    return {
      ...row,
      first_seen_at: priorSeen?.first_seen_at || collectedAt,
      last_seen_at: collectedAt,
      derived: derivedForCompany(row, previousMap.get(row.stock_code)),
    };
  });
}

function rebuildDerivedCompanies(companies, previousPayload) {
  const previousMap = new Map((previousPayload?.companies || []).map((row) => [row.stock_code, row]));
  return (companies || []).map((row) => ({
    ...row,
    derived: derivedForCompany(row, previousMap.get(row.stock_code)),
  }));
}

function completionSummary(companyCount, previousPayload, { baselineMonth = null, calculatedAt = null } = {}) {
  const previousCount = Number(previousPayload?.collection?.company_count);
  const hasBaseline = Boolean(previousPayload) && Number.isFinite(previousCount) && previousCount > 0;
  const resolvedBaselineMonth = hasBaseline
    ? (baselineMonth || previousPayload?.revenue_month || null)
    : null;
  const baselineCompanyCount = hasBaseline ? previousCount : null;
  const coverageRatio = baselineCompanyCount
    ? Number((companyCount / baselineCompanyCount).toFixed(4))
    : null;
  let status = 'baseline_seed';
  let isComplete = false;
  if (coverageRatio !== null) {
    if (coverageRatio >= 0.98) {
      status = 'likely_complete';
      isComplete = true;
    } else {
      status = 'collecting';
    }
  }
  return {
    company_count: companyCount,
    baseline_month: resolvedBaselineMonth,
    baseline_company_count: baselineCompanyCount,
    expected_company_count: baselineCompanyCount,
    coverage_ratio: coverageRatio,
    status,
    is_complete: isComplete,
    status_calculated_at: calculatedAt,
    completeness_rule: 'baseline_seed when the immediately previous revenue month is unavailable; otherwise likely_complete when current company count reaches at least 98% of previous month baseline',
  };
}

function updateRootIndexes(revenueMonth, payload) {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const monthDirs = fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const files = monthDirs
    .map((month) => `${month}/monthly_revenue.json`)
    .filter((relative) => fs.existsSync(path.join(OUTPUT_ROOT, relative)));
  writeJson(path.join(OUTPUT_ROOT, 'files.json'), files);
  const manifestPath = path.join(OUTPUT_ROOT, 'manifest.json');
  const oldManifest = readJson(manifestPath, {});
  writeJson(manifestPath, {
    schema_version: 2,
    dataset: 'mops_monthly_revenue',
    market: 'TWSE',
    updated_at: payload.collection.last_collected_at,
    latest_revenue_month: revenueMonth,
    months: monthDirs,
    files,
    previous_updated_at: oldManifest.updated_at || null,
  });
}

async function crawlMonth(revenueMonth, { now = new Date(), forceSnapshot = false } = {}) {
  const month = normalizeRevenueMonth(revenueMonth);
  const url = buildSourceUrl(month);
  const collectedAt = taipeiIso(now);
  const outputDir = monthOutputDir(month);
  const outputFile = path.join(outputDir, 'monthly_revenue.json');
  const existing = readJson(outputFile, null);
  const previousMonth = previousRevenueMonth(month);
  const previousPayload = readJson(path.join(monthOutputDir(previousMonth), 'monthly_revenue.json'), null);
  const response = await fetchHtml(url);
  const parsed = parseMopsRevenueHtml(response.html, month);
  const companies = enrichCompanies(parsed.companies, previousPayload, existing, collectedAt);
  const collection = completionSummary(companies.length, previousPayload, {
    baselineMonth: previousMonth,
    calculatedAt: collectedAt,
  });
  const payload = {
    schema_version: 2,
    market: 'TWSE',
    revenue_month: month,
    roc_year: Number(month.slice(0, 4)) - 1911,
    month: Number(month.slice(4, 6)),
    unit: 'TWD_thousand',
    source: {
      provider: 'MOPS',
      url,
      report_date: parsed.report_date,
      content_type: response.content_type,
      sha256: crypto.createHash('sha256').update(response.bytes).digest('hex'),
    },
    collection: {
      first_collected_at: existing?.collection?.first_collected_at || collectedAt,
      last_collected_at: collectedAt,
      snapshot_count: Number(existing?.collection?.snapshot_count || 0) + 1,
      ...collection,
    },
    companies,
  };
  writeJson(outputFile, payload);
  const snapshotDir = path.join(outputDir, 'snapshots');
  const snapshotFile = path.join(snapshotDir, `${compactTimestamp(now)}.json`);
  if (forceSnapshot || !fs.existsSync(snapshotFile)) writeJson(snapshotFile, payload);
  updateRootIndexes(month, payload);
  return {
    revenue_month: month,
    source_url: url,
    report_date: parsed.report_date,
    company_count: companies.length,
    baseline_month: collection.baseline_month,
    coverage_ratio: collection.coverage_ratio,
    completion_status: collection.status,
    output_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    snapshot_file: path.relative(ROOT, snapshotFile).replaceAll(path.sep, '/'),
  };
}

async function main() {
  const args = parseArgs();
  const requested = args.get('month') || args.get('revenue-month') || autoRevenueMonth();
  const months = String(requested).split(',').map((value) => normalizeRevenueMonth(value.trim()));
  const summaries = [];
  for (const month of months) summaries.push(await crawlMonth(month, { forceSnapshot: args.has('force-snapshot') }));
  console.log(JSON.stringify({ ok: true, summaries }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ROOT,
  OUTPUT_ROOT,
  autoRevenueMonth,
  buildSourceUrl,
  completionSummary,
  crawlMonth,
  decodeHtml,
  derivedForCompany,
  enrichCompanies,
  monthOutputDir,
  normalizeRevenueMonth,
  parseMopsRevenueHtml,
  previousRevenueMonth,
  readJson,
  rebuildDerivedCompanies,
  taipeiIso,
  updateRootIndexes,
  writeJson,
};