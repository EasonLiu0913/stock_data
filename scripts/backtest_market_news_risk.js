#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NEWS_DIR = path.join(ROOT, 'data_market_news');
const MI_INDEX_DIR = path.join(ROOT, 'data_twse_mi_index');
const INSTITUTIONAL_DIR = path.join(ROOT, 'data_twse_institutional_investors');
const FUTURES_DIR = path.join(ROOT, 'data_taifex_major_institutional_traders_futures_options');
const MARGIN_DIR = path.join(ROOT, 'data_twse_margin_balance');
const INDUSTRY_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const OUTPUT_DIR = path.join(NEWS_DIR, 'backtests');

const RISK_KEYWORDS = [
  ['大跌', 10], ['重挫', 10], ['暴跌', 10], ['崩跌', 12], ['殺盤', 8], ['賣壓', 6],
  ['賣超', 6], ['調節', 5], ['提款', 5], ['外資', 3], ['三大法人', 3],
  ['美股', 5], ['科技股', 4], ['費城半導體', 8], ['費半', 8], ['Nasdaq', 7],
  ['ADR', 7], ['台積電', 5], ['TSMC', 5], ['中東', 5], ['地緣', 4],
  ['油價', 3], ['美債', 4], ['殖利率', 4], ['關稅', 5], ['匯率', 4],
  ['新台幣', 3], ['融資', 4], ['維持率', 5], ['借券', 4], ['估值', 3]
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

function normalizeDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid date: ${value}`);
  return text;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).replace(/<[^>]*>/g, '').replace(/,/g, '').replace(/"/g, '').trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function listTradeDates() {
  if (!fs.existsSync(MI_INDEX_DIR)) return [];
  return fs.readdirSync(MI_INDEX_DIR)
    .map((file) => file.match(/^(\d{8})_twse_mi_index\.json$/)?.[1])
    .filter(Boolean)
    .sort();
}

function parseMarketIndex(date) {
  const payload = readJson(path.join(MI_INDEX_DIR, `${date}_twse_mi_index.json`));
  if (!payload) return null;
  const rows = (payload.tables || []).flatMap((table) => table.data || []);
  const weighted = rows.find((row) => String(row[0] || '').includes('發行量加權股價指數'));
  if (!weighted) return null;
  const industryDeclines = rows
    .filter((row) => String(row[0] || '').endsWith('類指數'))
    .map((row) => ({
      name: String(row[0] || ''),
      close: parseNumber(row[1]),
      change_percent: parseNumber(row[4])
    }))
    .sort((left, right) => left.change_percent - right.change_percent)
    .slice(0, 8);
  return {
    date,
    close: parseNumber(weighted[1]),
    change_points: parseNumber(weighted[3]) * (String(weighted[2] || '').includes('green') ? -1 : 1),
    change_percent: parseNumber(weighted[4]),
    worst_industries: industryDeclines
  };
}

function institutionalSummary(date) {
  const payload = readJson(path.join(INSTITUTIONAL_DIR, `${date}_twse_institutional_investors.json`), {});
  if (Array.isArray(payload.data) && Array.isArray(payload.fields)) {
    const indexOf = (name) => payload.fields.findIndex((field) => field === name);
    const foreignIndex = indexOf('外陸資買賣超股數(不含外資自營商)');
    const trustIndex = indexOf('投信買賣超股數');
    const dealerIndex = indexOf('自營商買賣超股數');
    const totalIndex = indexOf('三大法人買賣超股數');
    const sumIndex = (index) => payload.data.reduce((total, row) => total + parseNumber(row[index]), 0);
    const foreign = foreignIndex >= 0 ? sumIndex(foreignIndex) : 0;
    return {
      date,
      stocks: payload.data.length,
      foreign_net_shares: foreign,
      foreign_net_lots: Math.round(foreign / 1000),
      trust_net_shares: trustIndex >= 0 ? sumIndex(trustIndex) : 0,
      dealer_net_shares: dealerIndex >= 0 ? sumIndex(dealerIndex) : 0,
      total_net_shares: totalIndex >= 0 ? sumIndex(totalIndex) : 0
    };
  }
  const stocks = Object.values(payload || {});
  const sum = (key) => stocks.reduce((total, item) => total + parseNumber(item[key]), 0);
  return {
    date,
    stocks: stocks.length,
    foreign_net_shares: sum('foreign'),
    foreign_net_lots: Math.round(sum('foreign') / 1000),
    trust_net_shares: sum('trust'),
    dealer_net_shares: sum('dealer'),
    total_net_shares: sum('total')
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.replace(/^\uFEFF/, '').trim());
}

function parseCsv(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function futuresSummary(date) {
  const rows = parseCsv(path.join(FUTURES_DIR, `${date}_taifex_major_institutional_traders_futures_options.csv`));
  const foreign = rows.find((row) => String(row['身份別'] || '').includes('外資'));
  if (!foreign) return { date, available: false };
  return {
    date,
    available: true,
    foreign_futures_trade_net_contracts: parseNumber(foreign['期貨多空交易口數淨額']),
    foreign_futures_oi_net_contracts: parseNumber(foreign['期貨多空未平倉口數淨額']),
    foreign_options_oi_net_contracts: parseNumber(foreign['選擇權多空未平倉口數淨額'])
  };
}

function marginSummary(date) {
  const rows = parseCsv(path.join(MARGIN_DIR, `${date}_twse_margin_balance.csv`));
  const marginChange = rows.reduce((total, row) => total + parseNumber(row['融資今日餘額']) - parseNumber(row['融資前日餘額']), 0);
  const shortChange = rows.reduce((total, row) => total + parseNumber(row['融券今日餘額']) - parseNumber(row['融券前日餘額']), 0);
  return { date, rows: rows.length, margin_balance_change: marginChange, short_balance_change: shortChange };
}

function publicationDate(article) {
  const time = Date.parse(article.published_at || '');
  if (!Number.isFinite(time)) return '';
  return new Date(time).toISOString().slice(0, 10).replaceAll('-', '');
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
  return {
    raw: raw * categoryMultiplier * trustedMultiplier,
    matches
  };
}

function normalizeRiskScore(raw) {
  return Math.round((100 * (1 - Math.exp(-raw / 180))) * 10) / 10;
}

function weightedArticleTotal(values, decay = 0.93, limit = 60) {
  return values
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
    .slice(0, limit)
    .reduce((total, value, index) => total + Math.min(value, 32) * Math.pow(decay, index), 0);
}

function normalizeNewsScore(raw, scale) {
  return Math.round((100 * (1 - Math.exp(-raw / scale))) * 10) / 10;
}

function loadIndustryMap() {
  const payload = readJson(INDUSTRY_FILE, {});
  return Object.entries(payload).map(([code, item]) => ({
    code,
    name: item.Name || item.name || '',
    industry: item.Industry || item.industry || ''
  })).filter((item) => item.name && item.industry);
}

function topEntries(map, limit = 12) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => right.score - left.score || right.count - left.count || left.key.localeCompare(right.key, 'zh-Hant'))
    .slice(0, limit);
}

function scoreNews(date, phase, articles, industryMap) {
  const totals = {
    raw: 0,
    article_count: articles.length,
    trusted_article_count: articles.filter((article) => article.trusted_domain).length
  };
  const categoryScores = new Map();
  const keywordCounts = new Map();
  const stockScores = new Map();
  const industryScores = new Map();
  const foreignArticles = [];
  const adrArticles = [];
  const articleRiskValues = [];

  for (const article of articles) {
    const risk = articleRisk(article);
    if (risk.raw <= 0) continue;
    totals.raw += risk.raw;
    articleRiskValues.push(risk.raw);
    for (const keyword of risk.matches) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }
    for (const category of article.categories || ['uncategorized']) {
      const current = categoryScores.get(category) || { score: 0, count: 0 };
      current.score += risk.raw;
      current.count += 1;
      categoryScores.set(category, current);
    }

    const text = `${article.title || ''} ${article.summary || ''}`;
    for (const stock of industryMap) {
      if (!text.includes(stock.name) && !text.includes(stock.code)) continue;
      const stockCurrent = stockScores.get(stock.code) || { name: stock.name, industry: stock.industry, score: 0, count: 0 };
      stockCurrent.score += risk.raw;
      stockCurrent.count += 1;
      stockScores.set(stock.code, stockCurrent);
      const industryCurrent = industryScores.get(stock.industry) || { score: 0, count: 0 };
      industryCurrent.score += risk.raw;
      industryCurrent.count += 1;
      industryScores.set(stock.industry, industryCurrent);
    }

    for (const stock of industryMap) {
      if (!stock.industry || !text.includes(stock.industry.replace(/工業|業/g, ''))) continue;
      const industryCurrent = industryScores.get(stock.industry) || { score: 0, count: 0 };
      industryCurrent.score += risk.raw * 0.2;
      industryCurrent.count += 1;
      industryScores.set(stock.industry, industryCurrent);
      break;
    }

    if (/外資/.test(text) && /(賣超|賣壓|調節|提款|賣出)/.test(text)) {
      foreignArticles.push({ title: article.title, source_name: article.source_name, published_at: article.published_at, risk: Math.round(risk.raw * 10) / 10 });
    }
    if (/(ADR|費半|費城半導體|Nasdaq|那斯達克|美股|科技股|台積電)/i.test(text)) {
      adrArticles.push({ title: article.title, source_name: article.source_name, published_at: article.published_at, risk: Math.round(risk.raw * 10) / 10 });
    }
  }

  const keywordRaw = weightedArticleTotal(articleRiskValues);
  const foreignRaw = weightedArticleTotal(foreignArticles.map((article) => article.risk), 0.9, 40);
  const adrRaw = weightedArticleTotal(adrArticles.map((article) => article.risk), 0.9, 40);
  return {
    date,
    phase,
    article_count: totals.article_count,
    trusted_article_count: totals.trusted_article_count,
    keyword_risk_score: normalizeNewsScore(keywordRaw, 420),
    keyword_risk_raw: Math.round(keywordRaw * 10) / 10,
    keyword_risk_linear_raw: Math.round(totals.raw * 10) / 10,
    foreign_selling_news_weight: normalizeNewsScore(foreignRaw, 190),
    adr_sox_nasdaq_overnight_risk: normalizeNewsScore(adrRaw, 210),
    category_scores: topEntries(categoryScores, 10),
    top_keywords: [...keywordCounts.entries()].map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    top_stocks: topEntries(stockScores, 15),
    top_industries: topEntries(industryScores, 12),
    top_foreign_selling_articles: foreignArticles.sort((left, right) => right.risk - left.risk).slice(0, 8),
    top_adr_sox_nasdaq_articles: adrArticles.sort((left, right) => right.risk - left.risk).slice(0, 8)
  };
}

function analyzeEvent(date, tradeDates, industryMap, lookbackDays) {
  const eventIndex = tradeDates.indexOf(date);
  if (eventIndex < 0) throw new Error(`No market index data for ${date}`);
  const preDates = tradeDates.slice(Math.max(0, eventIndex - lookbackDays), eventIndex);
  const eventDay = parseMarketIndex(date);
  const preMarket = preDates.map(parseMarketIndex).filter(Boolean);
  const institutions = preDates.map(institutionalSummary);
  const futures = preDates.map(futuresSummary);
  const margins = preDates.map(marginSummary);
  const news = readJson(path.join(NEWS_DIR, date, 'market_news.json'), { articles: [] });
  const articles = news.articles || [];
  const preArticles = articles.filter((article) => {
    const published = publicationDate(article);
    return published && published < date;
  });
  const eventArticles = articles.filter((article) => publicationDate(article) === date);
  const allWindowArticles = articles.filter((article) => {
    const published = publicationDate(article);
    return published && published <= date;
  });

  const foreign5dLots = institutions.reduce((total, item) => total + item.foreign_net_lots, 0);
  const market5dPct = preMarket.reduce((total, item) => total + item.change_percent, 0);
  const margin5dChange = margins.reduce((total, item) => total + item.margin_balance_change, 0);
  const lastFutures = futures.findLast((item) => item.available);
  const firstFutures = futures.find((item) => item.available);
  const futuresOiChange = lastFutures && firstFutures
    ? lastFutures.foreign_futures_oi_net_contracts - firstFutures.foreign_futures_oi_net_contracts
    : null;

  const preNews = scoreNews(date, 'pre_event', preArticles, industryMap);
  const eventNews = scoreNews(date, 'event_day', eventArticles, industryMap);
  const fullWindowNews = scoreNews(date, 'full_window_to_event_day', allWindowArticles, industryMap);
  const signalScore = Math.min(100, Math.max(0, Math.round((
    preNews.keyword_risk_score * 0.28 +
    preNews.foreign_selling_news_weight * 0.18 +
    preNews.adr_sox_nasdaq_overnight_risk * 0.18 +
    Math.min(100, Math.abs(Math.min(0, foreign5dLots)) / 2500) * 0.16 +
    Math.min(100, Math.abs(Math.min(0, lastFutures?.foreign_futures_oi_net_contracts || 0)) / 5000) * 0.14 +
    Math.min(100, Math.abs(Math.min(0, market5dPct)) * 18) * 0.06
  ) * 10) / 10));

  return {
    date,
    event_day_market: eventDay,
    lookback_trade_dates: preDates,
    pre_event_signal_score: signalScore,
    pre_event_market: {
      cumulative_change_percent_approx: Math.round(market5dPct * 100) / 100,
      down_days: preMarket.filter((item) => item.change_percent < 0).length,
      days: preMarket
    },
    pre_event_institutional: {
      foreign_net_lots: foreign5dLots,
      latest_foreign_futures_oi_net_contracts: lastFutures?.foreign_futures_oi_net_contracts ?? null,
      foreign_futures_oi_change: futuresOiChange,
      margin_balance_change: margin5dChange,
      daily_institutional: institutions,
      daily_futures: futures,
      daily_margin: margins
    },
    news: {
      source_file: `data_market_news/${date}/market_news.json`,
      crawler_article_count: news.article_count || articles.length,
      pre_event: preNews,
      event_day: eventNews,
      full_window_to_event_day: fullWindowNews
    },
    notes: [
      'pre_event_signal_score 只使用事件日前交易日與事件日前新聞，用來觀察是否有提前警訊。',
      'event_day 與 full_window_to_event_day 會包含當天新聞，較適合作為事後解釋，不適合視為提前預測。',
      '新聞分數是啟發式關鍵字權重，尚未經模型訓練或統計校準。'
    ]
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dates = String(args.get('dates') || '20260717,20260724').split(',').map(normalizeDate);
  const lookbackDays = Number(args.get('lookback-days') || 5);
  const tradeDates = listTradeDates();
  const industryMap = loadIndustryMap();
  const events = dates.map((date) => analyzeEvent(date, tradeDates, industryMap, lookbackDays));
  const output = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    dates,
    lookback_trade_days: lookbackDays,
    methodology: {
      keyword_risk_score: '新聞標題與摘要的風險關鍵字加權，可信來源與類別會提高權重，轉成 0-100 分。',
      foreign_selling_news_weight: '外資且賣超/調節/提款/賣壓相關新聞的子分數。',
      adr_sox_nasdaq_overnight_risk: 'ADR、費半、Nasdaq、美股科技股、台積電相關新聞的子分數。',
      stock_industry_linkage: '以股票名稱、代號、產業字串在新聞中出現次數與文章風險分數估算關聯。'
    },
    events
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputFile = path.join(OUTPUT_DIR, `${dates.join('_')}_market_risk_backtest.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, outputFile),
    events: events.map((event) => ({
      date: event.date,
      market_change_percent: event.event_day_market.change_percent,
      pre_event_signal_score: event.pre_event_signal_score,
      pre_event_keyword_risk_score: event.news.pre_event.keyword_risk_score,
      event_day_keyword_risk_score: event.news.event_day.keyword_risk_score
    }))
  }, null, 2));
}

main();
