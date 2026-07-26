#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const NEWS_DIR = path.join(ROOT, 'data_market_news');
const EXTERNAL_DIR = path.join(ROOT, 'data_external_market');
const INDUSTRY_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const ALIAS_FILE = path.join(ROOT, 'config', 'stock_news_aliases.json');
const OUTPUT_DIR = path.join(ROOT, 'data_market_risk');

const RISK_KEYWORDS = [
  ['大跌', 10], ['重挫', 10], ['暴跌', 10], ['崩跌', 12], ['殺盤', 8], ['賣壓', 6],
  ['賣超', 6], ['調節', 5], ['提款', 5], ['外資', 3], ['三大法人', 3],
  ['美股', 5], ['科技股', 4], ['費城半導體', 8], ['費半', 8], ['SOX', 8],
  ['Nasdaq', 7], ['那斯達克', 7], ['ADR', 7], ['台積電', 5], ['TSMC', 5],
  ['中東', 5], ['地緣', 4], ['油價', 5], ['原油', 5], ['美債', 4],
  ['殖利率', 4], ['關稅', 5], ['匯率', 4], ['新台幣', 3], ['融資', 4],
  ['維持率', 5], ['借券', 4], ['估值', 3]
];

const CATEGORY_WEIGHTS = {
  taiwan_market: 1.15,
  institutional_flows: 1.1,
  semiconductor_adr: 1.2,
  global_risk: 1.05,
  asia_markets: 1.0,
  fx_rates: 0.95,
  credit_margin: 0.95
};

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function taipeiCompactDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function normalizeDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid --date: ${value}`);
  return text;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function topicKey(article) {
  const title = String(article.title || '').replace(/\s-\s.*$/, '');
  const text = normalizeText(title);
  const tokens = text.split(' ').filter((token) => token.length > 1 && !['台股', '今日', '新聞', '經濟日報'].includes(token));
  return crypto.createHash('sha1').update(tokens.slice(0, 12).join(' ')).digest('hex');
}

function clusterArticles(articles) {
  const clusters = new Map();
  for (const article of articles) {
    const key = topicKey(article);
    const current = clusters.get(key) || {
      id: key,
      representative_title: article.title,
      source_names: new Set(),
      categories: new Set(),
      article_ids: [],
      trusted_count: 0
    };
    current.article_ids.push(article.id);
    if (article.source_name) current.source_names.add(article.source_name);
    for (const category of article.categories || []) current.categories.add(category);
    if (article.trusted_domain) current.trusted_count += 1;
    clusters.set(key, current);
  }
  return [...clusters.values()].map((cluster) => ({
    ...cluster,
    source_names: [...cluster.source_names].sort(),
    categories: [...cluster.categories].sort(),
    article_count: cluster.article_ids.length
  }));
}

function articleRisk(article) {
  const text = `${article.title || ''} ${article.summary || ''}`;
  let raw = 0;
  const matches = [];
  for (const [keyword, weight] of RISK_KEYWORDS) {
    if (new RegExp(keyword, 'i').test(text)) {
      raw += weight;
      matches.push(keyword);
    }
  }
  const categoryMultiplier = Math.max(...(article.categories || []).map((category) => CATEGORY_WEIGHTS[category] || 1), 1);
  const trustedMultiplier = article.trusted_domain ? 1.2 : 1;
  return { raw: raw * categoryMultiplier * trustedMultiplier, matches };
}

function weightedArticleTotal(values, decay = 0.93, limit = 60) {
  return values
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
    .slice(0, limit)
    .reduce((total, value, index) => total + Math.min(value, 32) * Math.pow(decay, index), 0);
}

function normalizeScore(raw, scale) {
  return round(100 * (1 - Math.exp(-raw / scale)), 1);
}

function topEntries(map, limit = 12) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value, score: round(value.score, 2) }))
    .sort((left, right) => right.score - left.score || right.count - left.count || left.key.localeCompare(right.key, 'zh-Hant'))
    .slice(0, limit);
}

function loadAliasMap() {
  const stocks = readJson(INDUSTRY_FILE, {});
  const aliases = readJson(ALIAS_FILE, { stockAliases: {}, industryKeywords: {} });
  const stockMap = Object.entries(stocks).map(([code, item]) => ({
    code,
    name: item.Name || item.name || '',
    industry: item.Industry || item.industry || '',
    aliases: [...new Set([code, item.Name || item.name || '', ...(aliases.stockAliases?.[code] || [])].filter(Boolean))]
  }));
  return {
    stocks: stockMap,
    industryKeywords: aliases.industryKeywords || {}
  };
}

function scoreNews(articles, aliasMap) {
  const clusters = clusterArticles(articles);
  const byArticleId = new Map(articles.map((article) => [article.id, article]));
  const clusterRisks = [];
  const keywordCounts = new Map();
  const categoryScores = new Map();
  const stockScores = new Map();
  const industryScores = new Map();
  const foreignArticleScores = [];
  const adrArticleScores = [];
  const oilArticleScores = [];

  for (const cluster of clusters) {
    const clusterArticles = cluster.article_ids.map((id) => byArticleId.get(id)).filter(Boolean);
    const risks = clusterArticles.map(articleRisk);
    const topRisk = risks.reduce((best, risk) => risk.raw > best.raw ? risk : best, { raw: 0, matches: [] });
    if (topRisk.raw <= 0) continue;
    const clusterBoost = Math.min(1.35, 1 + Math.log2(cluster.article_count) * 0.08);
    const score = topRisk.raw * clusterBoost;
    clusterRisks.push(score);
    for (const keyword of topRisk.matches) keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    for (const category of cluster.categories.length ? cluster.categories : ['uncategorized']) {
      const current = categoryScores.get(category) || { score: 0, count: 0 };
      current.score += score;
      current.count += 1;
      categoryScores.set(category, current);
    }
    const text = normalizeText(clusterArticles.map((article) => `${article.title} ${article.summary}`).join(' '));
    for (const stock of aliasMap.stocks) {
      if (!stock.aliases.some((alias) => text.includes(normalizeText(alias)))) continue;
      const current = stockScores.get(stock.code) || { name: stock.name, industry: stock.industry, score: 0, count: 0 };
      current.score += score;
      current.count += 1;
      stockScores.set(stock.code, current);
      const industry = industryScores.get(stock.industry) || { score: 0, count: 0 };
      industry.score += score;
      industry.count += 1;
      industryScores.set(stock.industry, industry);
    }
    for (const [industry, keywords] of Object.entries(aliasMap.industryKeywords)) {
      if (!keywords.some((keyword) => text.includes(normalizeText(keyword)))) continue;
      const current = industryScores.get(industry) || { score: 0, count: 0 };
      current.score += score;
      current.count += 1;
      industryScores.set(industry, current);
    }
    if (/外資/.test(text) && /(賣超|賣壓|調節|提款|賣出)/.test(text)) foreignArticleScores.push(score);
    if (/(adr|費半|費城半導體|sox|nasdaq|那斯達克|美股|科技股|台積電|tsmc)/i.test(text)) adrArticleScores.push(score);
    if (/(油價|原油|wti|brent|布蘭特|西德州|中東|能源)/i.test(text)) oilArticleScores.push(score);
  }

  const keywordRaw = weightedArticleTotal(clusterRisks);
  return {
    article_count: articles.length,
    cluster_count: clusters.length,
    keyword_risk_score: normalizeScore(keywordRaw, 420),
    keyword_risk_raw: round(keywordRaw, 1),
    foreign_selling_news_weight: normalizeScore(weightedArticleTotal(foreignArticleScores, 0.9, 40), 190),
    adr_sox_nasdaq_news_risk: normalizeScore(weightedArticleTotal(adrArticleScores, 0.9, 40), 210),
    oil_news_risk: normalizeScore(weightedArticleTotal(oilArticleScores, 0.9, 30), 160),
    top_keywords: [...keywordCounts.entries()].map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    top_categories: topEntries(categoryScores, 10),
    top_stocks: topEntries(stockScores, 20),
    top_industries: topEntries(industryScores, 15),
    largest_clusters: clusters.sort((left, right) => right.article_count - left.article_count).slice(0, 15)
  };
}

function externalRisk(indicators) {
  const byId = Object.fromEntries(indicators.map((item) => [item.id, item]));
  const negative = (id, multiplier = 1) => Math.max(0, -(byId[id]?.change_percent ?? 0)) * multiplier;
  const positive = (id, multiplier = 1) => Math.max(0, byId[id]?.change_percent ?? 0) * multiplier;
  const raw =
    negative('nasdaq', 12) +
    negative('sox', 16) +
    negative('tsm_adr', 14) +
    negative('sp500', 8) +
    positive('usd_twd', 8) +
    positive('wti_crude_oil', 7) +
    positive('brent_crude_oil', 7);
  return {
    external_market_risk_score: normalizeScore(raw, 55),
    external_market_risk_raw: round(raw, 2),
    adr_sox_nasdaq_market_risk: normalizeScore(negative('nasdaq', 12) + negative('sox', 16) + negative('tsm_adr', 14), 45),
    oil_futures_risk: normalizeScore(positive('wti_crude_oil', 7) + positive('brent_crude_oil', 7), 35),
    tracked_indicators: indicators.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      market_date: item.market_date,
      close: item.close,
      change_percent: item.change_percent
    }))
  };
}

function latestFileAtOrBefore(rootDir, date, fileName) {
  if (!fs.existsSync(rootDir)) return null;
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name) && entry.name <= date)
    .map((entry) => entry.name)
    .sort();
  const latest = dirs.at(-1);
  return latest ? path.join(rootDir, latest, fileName) : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDate = normalizeDate(args.get('date') || taipeiCompactDate());
  const newsFile = latestFileAtOrBefore(NEWS_DIR, targetDate, 'market_news.json');
  const externalFile = latestFileAtOrBefore(EXTERNAL_DIR, targetDate, 'external_market_indicators.json');
  const news = readJson(newsFile, { articles: [] });
  const external = readJson(externalFile, { indicators: [] });
  const aliasMap = loadAliasMap();
  const newsRisk = scoreNews(news.articles || [], aliasMap);
  const marketRisk = externalRisk(external.indicators || []);
  const total = round(
    newsRisk.keyword_risk_score * 0.28 +
    newsRisk.foreign_selling_news_weight * 0.16 +
    newsRisk.adr_sox_nasdaq_news_risk * 0.16 +
    newsRisk.oil_news_risk * 0.08 +
    marketRisk.external_market_risk_score * 0.18 +
    marketRisk.adr_sox_nasdaq_market_risk * 0.10 +
    marketRisk.oil_futures_risk * 0.04,
    1
  );
  const payload = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    date: targetDate,
    source_files: {
      news: newsFile ? path.relative(ROOT, newsFile) : null,
      external_market: externalFile ? path.relative(ROOT, externalFile) : null,
      stock_aliases: path.relative(ROOT, ALIAS_FILE)
    },
    market_risk_score: total,
    risk_label: total >= 65 ? '高' : total >= 40 ? '中' : '低',
    news: newsRisk,
    external_market: marketRisk,
    notes: [
      '新聞已用簡單主題聚類降低重複新聞放大效果。',
      '外部市場風險包含 Nasdaq、SOX、TSM ADR、USD/TWD、WTI 與 Brent 油價期貨。',
      '分數仍為啟發式，需累積更多大跌日與非大跌日後校準。'
    ]
  };

  const outputDir = path.join(OUTPUT_DIR, targetDate);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'market_risk_snapshot.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const dateDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(dateDirs.map((date) => `${date}/market_risk_snapshot.json`), null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: payload.generated_at,
    latest_date: targetDate,
    latest_file: `data_market_risk/${targetDate}/market_risk_snapshot.json`,
    available_dates: dateDirs
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    date: targetDate,
    market_risk_score: payload.market_risk_score,
    risk_label: payload.risk_label,
    output: `data_market_risk/${targetDate}/market_risk_snapshot.json`
  }));
}

main();
