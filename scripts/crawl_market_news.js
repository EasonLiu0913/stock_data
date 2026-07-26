#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'market_news_sources.json');
const OUTPUT_DIR = path.join(ROOT, 'data_market_news');
const DEFAULT_TIMEOUT_MS = 30000;

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

function normalizeCompactDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid --date: ${value}`);
  return text;
}

function stripCdata(value) {
  return String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeXml(value) {
  return stripCdata(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return decodeXml(value);
}

function normalizeSummaryText(value) {
  return decodeHtml(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutSourceSuffix(value, sourceName) {
  let text = normalizeSummaryText(value);
  const source = normalizeSummaryText(sourceName);
  if (source) {
    text = text.replace(new RegExp(`\\s*-\\s*${escapeRegExp(source)}$`, 'i'), '');
    text = text.replace(new RegExp(`\\s+${escapeRegExp(source)}$`, 'i'), '');
  }
  return text.trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanSummary(item) {
  const summary = normalizeSummaryText(item.summary);
  if (!summary) return '';
  const title = withoutSourceSuffix(item.title, item.source_name);
  const summaryWithoutSource = withoutSourceSuffix(summary, item.source_name);
  if (title && summaryWithoutSource && (title === summaryWithoutSource || title.includes(summaryWithoutSource) || summaryWithoutSource.includes(title))) {
    return '';
  }
  return summary;
}

function absoluteUrl(url) {
  try {
    return new URL(url, 'https://tw.stock.yahoo.com').toString();
  } catch {
    return url;
  }
}

function xmlField(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function xmlSource(xml) {
  const match = xml.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/i);
  if (!match) return { name: '', url: '' };
  return { name: decodeXml(match[2]), url: decodeXml(match[1] || '') };
}

function parseRss(xml) {
  const items = [];
  const matches = xml.matchAll(/<item\b[\s\S]*?<\/item>/gi);
  for (const match of matches) {
    const itemXml = match[0];
    const source = xmlSource(itemXml);
    items.push({
      title: xmlField(itemXml, 'title'),
      link: xmlField(itemXml, 'link'),
      guid: xmlField(itemXml, 'guid'),
      published_at: xmlField(itemXml, 'pubDate'),
      source_name: source.name,
      source_url: source.url,
      summary: xmlField(itemXml, 'description')
    });
  }
  return items;
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isTrustedDomain(item, trustedDomains) {
  const hosts = [hostFromUrl(item.link), hostFromUrl(item.source_url)].filter(Boolean);
  return hosts.some((host) => trustedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
}

function googleNewsUrl(query, locale) {
  const params = new URLSearchParams({
    q: query,
    hl: locale.hl || 'zh-TW',
    gl: locale.gl || 'TW',
    ceid: locale.ceid || 'TW:zh-Hant'
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function addDays(compactDate, days) {
  const date = new Date(`${compactToIso(compactDate)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function addTime(baseDate, amount, unit) {
  const date = new Date(baseDate.getTime());
  if (unit === 'minute') date.setMinutes(date.getMinutes() + amount);
  if (unit === 'hour') date.setHours(date.getHours() + amount);
  if (unit === 'day') date.setDate(date.getDate() + amount);
  return date;
}

function parseYahooRelativeTime(value, baseDate) {
  const text = normalizeSummaryText(value);
  if (!text) return '';
  if (/剛剛|剛才/.test(text)) return baseDate.toUTCString();
  let match = text.match(/(\d+)\s*分鐘前/);
  if (match) return addTime(baseDate, -Number(match[1]), 'minute').toUTCString();
  match = text.match(/(\d+)\s*小時前/);
  if (match) return addTime(baseDate, -Number(match[1]), 'hour').toUTCString();
  match = text.match(/(\d+)\s*天前/);
  if (match) return addTime(baseDate, -Number(match[1]), 'day').toUTCString();
  if (/昨天/.test(text)) return addTime(baseDate, -1, 'day').toUTCString();
  return '';
}

function parsePublishedTimeFromHtml(html) {
  const patterns = [
    /property="article:published_time"\s+content="([^"]+)"/i,
    /name="pubdate"\s+content="([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
    /"datePublished"\s*:\s*"([^"]+)"/i
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    const timestamp = Date.parse(value || '');
    if (Number.isFinite(timestamp)) return new Date(timestamp).toUTCString();
  }
  return '';
}

function queryWithDateWindow(query, targetDate, windowDays) {
  const days = Number(windowDays);
  if (!Number.isFinite(days) || days <= 0) return query;
  const after = compactToIso(addDays(targetDate, -Math.floor(days)));
  const before = compactToIso(addDays(targetDate, 1));
  return `${query} after:${after} before:${before}`;
}

function mergeArticle(byKey, item, category, sourceId) {
  if (!item.title || !item.link) return;
  const key = itemKey(item);
  const existing = byKey.get(key);
  const categories = new Set(existing?.categories || []);
  categories.add(category);
  byKey.set(key, {
    id: key,
    title: item.title,
    link: item.link,
    guid: item.guid,
    published_at: item.published_at,
    source_name: item.source_name,
    source_url: item.source_url,
    trusted_domain: item.trusted_domain,
    categories: [...categories].sort(),
    matched_queries: [...new Set([...(existing?.matched_queries || []), sourceId])].sort(),
    summary: cleanSummary(item)
  });
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml, */*',
        'user-agent': 'Mozilla/5.0 (compatible; stock-market-news-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function hydratePublishedAt(items) {
  for (const item of items) {
    if (item.published_at || !/^https:\/\/tw\.(?:news|stock)\.yahoo\.com\/news\//.test(item.link || '')) continue;
    try {
      const html = await fetchText(item.link);
      item.published_at = parsePublishedTimeFromHtml(html);
    } catch {
      item.published_at = '';
    }
  }
  return items;
}

function itemKey(item) {
  return crypto
    .createHash('sha1')
    .update(`${item.link || item.guid || ''}\n${item.title || ''}`)
    .digest('hex');
}

function parseYahooStockPage(html, sourceConfig, trustedDomains, baseDate = new Date()) {
  const items = [];
  const streamStart = html.indexOf('<div id="YDC-Stream"');
  const streamEnd = streamStart >= 0 ? html.indexOf('</ul>', streamStart) : -1;
  const streamHtml = streamStart >= 0 && streamEnd > streamStart ? html.slice(streamStart, streamEnd) : html;
  const rows = streamHtml.match(/<li class="js-stream-content[\s\S]*?<\/li>/g) || [];
  for (const row of rows) {
    if (/gemini-ad|native-ad-item|data-test-locator="ad"|>\s*Ad\s*</i.test(row)) continue;
    const articleMatch = row.match(/<h3[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
    if (!articleMatch) continue;
    const link = absoluteUrl(decodeHtml(articleMatch[1]));
    if (!/^https:\/\/tw\.(?:news|stock)\.yahoo\.com\/news\//.test(link) || /[?&]bcmt=/.test(link)) continue;
    const metaMatch = row.match(/<span[^>]*>([\s\S]*?)<\/span>\s*<i[^>]*>\s*•\s*<\/i>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    const sourceMatch = row.match(/<div class="[^"]*C\(#959595\)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const summaryMatch = row.match(/<p class="[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const sourceName = decodeHtml(metaMatch?.[1] || sourceMatch?.[1] || sourceConfig.source_name || '');
    const relativeTime = decodeHtml(metaMatch?.[2] || '');
    const item = {
      title: decodeHtml(articleMatch[2]),
      link,
      guid: link,
      published_at: parseYahooRelativeTime(relativeTime, baseDate),
      source_name: sourceName,
      source_url: sourceConfig.url,
      summary: decodeHtml(summaryMatch?.[1] || ''),
    };
    item.trusted_domain = isTrustedDomain(item, trustedDomains);
    items.push(item);
  }
  return items;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDate = normalizeCompactDate(args.get('date') || taipeiCompactDate());
  const crawledAt = new Date();
  const searchDateWindowDays = args.get('search-date-window-days') || args.get('historical-window-days') || 0;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const outputDir = path.join(OUTPUT_DIR, targetDate);
  const byKey = new Map();
  const queryResults = [];
  const direct_source_results = [];

  for (const queryConfig of config.queries || []) {
    const query = queryWithDateWindow(queryConfig.query, targetDate, searchDateWindowDays);
    const url = googleNewsUrl(query, config.locale || {});
    const result = {
      id: queryConfig.id,
      category: queryConfig.category,
      query,
      base_query: queryConfig.query,
      url,
      status: 'ok',
      item_count: 0,
      error: null
    };
    try {
      const xml = await fetchText(url);
      const items = parseRss(xml);
      result.item_count = items.length;
      for (const item of items) {
        item.trusted_domain = isTrustedDomain(item, config.trustedDomains || []);
        mergeArticle(byKey, item, queryConfig.category, queryConfig.id);
      }
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }
    queryResults.push(result);
  }

  for (const sourceConfig of config.directSources || []) {
    const result = {
      id: sourceConfig.id,
      category: sourceConfig.category,
      url: sourceConfig.url,
      status: 'ok',
      item_count: 0,
      error: null
    };
    try {
      const html = await fetchText(sourceConfig.url);
      const items = await hydratePublishedAt(parseYahooStockPage(html, sourceConfig, config.trustedDomains || [], crawledAt));
      result.item_count = items.length;
      for (const item of items) mergeArticle(byKey, item, sourceConfig.category, sourceConfig.id);
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }
    direct_source_results.push(result);
  }

  const articles = [...byKey.values()].sort((left, right) => {
    const time = Date.parse(right.published_at || '') - Date.parse(left.published_at || '');
    if (Number.isFinite(time) && time !== 0) return time;
    return left.title.localeCompare(right.title, 'zh-Hant');
  });

  const payload = {
    schemaVersion: 1,
    generated_at: crawledAt.toISOString(),
    collection_date: targetDate,
    source_config: path.relative(ROOT, CONFIG_PATH),
    crawler: path.relative(ROOT, __filename),
    query_results: queryResults,
    direct_source_results,
    article_count: articles.length,
    trusted_article_count: articles.filter((article) => article.trusted_domain).length,
    articles
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'market_news.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const dateDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(dateDirs.map((date) => `${date}/market_news.json`), null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: payload.generated_at,
    latest_date: targetDate,
    latest_file: `data_market_news/${targetDate}/market_news.json`,
    available_dates: dateDirs
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    collection_date: targetDate,
    queries: queryResults.length,
    direct_sources: direct_source_results.length,
    articles: payload.article_count,
    trusted_articles: payload.trusted_article_count,
    output: `data_market_news/${targetDate}/market_news.json`
  }));
}

main().catch((error) => {
  console.error(`Failed to crawl market news: ${error.message}`);
  process.exitCode = 1;
});
