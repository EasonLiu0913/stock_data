#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, '概念股清單.html');
const CONCEPT_SOURCE_FILE = path.join(ROOT, '概念股清單2.html');
const ELECTRONICS_SOURCE_FILE = path.join(ROOT, '電子產業清單.html');
const OUTPUT_DIR = path.join(ROOT, 'data_concept_stocks');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'concept-stock-lists.json');
const ELECTRONICS_OUTPUT_FILE = path.join(OUTPUT_DIR, 'electronics-industry-lists.json');
const YAHOO_ORIGIN = 'https://tw.stock.yahoo.com';
const FETCH_DELAY_MS = 150;

function printUsage() {
  console.log(`Usage: node scripts/extract_concept_stock_lists.js

Reads:
  概念股清單.html
  概念股清單2.html
  電子產業清單.html

Writes:
  data_concept_stocks/concept-stock-lists.json
  data_concept_stocks/electronics-industry-lists.json

The second concept file and electronics file contain Yahoo class links, so this script needs network access.`);
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stableId(prefix, name) {
  return crypto.createHash('md5').update(`${prefix}:${name}`).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseConceptLists(html) {
  const headings = [...html.matchAll(/<span class="concept_sub" id="([^"]+)">([\s\S]*?)<\/span>/g)]
    .map((match) => ({
      source_id: match[1],
      name: stripTags(match[2]).replace(/概念股$/, '').trim(),
      index: match.index,
    }));

  return headings.map((heading, index) => {
    const block = html.slice(heading.index, headings[index + 1]?.index ?? html.length);
    const stocks = [];
    const seen = new Set();

    for (const row of block.matchAll(/<tr class="[^"]*">([\s\S]*?)<\/tr>/g)) {
      const firstCell = (row[1].match(/<td[\s\S]*?<\/td>/) || [])[0] || '';
      const stockMatch = firstCell.match(/<a href="\/stock\/(\d{4,6})"[^>]*>([\s\S]*?)<\/a>/);
      if (!stockMatch) continue;

      const code = stockMatch[1];
      if (seen.has(code)) continue;
      seen.add(code);
      stocks.push({ code, name: stripTags(stockMatch[2]) });
    }

    return {
      id: heading.source_id,
      name: heading.name,
      count: stocks.length,
      stocks,
    };
  }).filter((concept) => concept.count > 0);
}

function parseYahooClassLinks(html) {
  const rows = [];
  const seen = new Set();

  for (const match of html.matchAll(/<a[^>]+href="([^"]*class-quote[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = decodeHtml(match[1]);
    const name = stripTags(decodeHtml(match[2]));
    if (!href || !name) continue;
    const url = new URL(href, YAHOO_ORIGIN);
    const category = url.searchParams.get('category') || name;
    const categoryLabel = url.searchParams.get('categoryLabel') || '';
    const key = `${categoryLabel}:${category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: stableId(categoryLabel || 'class', category),
      name,
      category,
      category_label: categoryLabel,
      url: url.href,
    });
  }

  return rows;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      referer: 'https://tw.stock.yahoo.com/class',
      'user-agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) throw new Error(`Yahoo request failed ${response.status}: ${url}`);
  return response.json();
}

function classQuotesUrl(entry, offset) {
  const params = new URLSearchParams({
    category: entry.category,
    categoryLabel: entry.category_label,
    categoryName: entry.category,
    offset: String(offset),
  });
  const context = new URLSearchParams({
    bkt: '',
    device: 'desktop',
    ecma: 'default',
    feature: 'enableGAMAds,enableGAMEdgeToEdge,enableEvPlayer,enableTxnToken,useCG,useCGV2',
    intl: 'tw',
    lang: 'zh-Hant-TW',
    partner: 'none',
    region: 'TW',
    site: 'finance',
    tz: 'Asia/Taipei',
    ver: '1.4.898',
  });
  return `${YAHOO_ORIGIN}/_td-stock/api/resource/StockServices.getClassQuotes;${params.toString().replaceAll('&', ';')}?${context}`;
}

async function fetchClassStocks(entry) {
  const stocks = [];
  const seen = new Set();
  let offset = 0;
  let total = null;

  while (offset !== null) {
    const payload = await fetchJson(classQuotesUrl(entry, offset));
    const data = payload.data || payload;
    const list = data.list || [];
    total = data.pagination?.resultsTotal ?? total;

    for (const item of list) {
      const code = String(item.systexId || item.symbol || '').replace(/\.(TW|TWO)$/, '');
      const name = String(item.symbolName || '').trim();
      if (!/^\d{4,6}$/.test(code) || !name || seen.has(code)) continue;
      seen.add(code);
      stocks.push({ code, name });
    }

    const nextOffset = data.pagination?.nextOffset;
    offset = nextOffset ? Number(nextOffset) : null;
    if (offset !== null) await sleep(FETCH_DELAY_MS);
  }

  return {
    ...entry,
    source: 'yahoo_class_quote',
    expected_count: total,
    count: stocks.length,
    stocks,
  };
}

async function fetchYahooClassLists(sourceFile) {
  if (!fs.existsSync(sourceFile)) return [];
  const entries = parseYahooClassLinks(fs.readFileSync(sourceFile, 'utf8'));
  const lists = [];

  for (const [index, entry] of entries.entries()) {
    process.stderr.write(`fetch ${index + 1}/${entries.length} ${entry.category_label} ${entry.name}\n`);
    lists.push(await fetchClassStocks(entry));
    await sleep(FETCH_DELAY_MS);
  }

  return lists.filter((list) => list.count > 0);
}

function mergeLists(baseLists, extraLists) {
  const byName = new Map();

  for (const list of [...baseLists, ...extraLists]) {
    const key = list.name;
    const current = byName.get(key) || {
      id: list.id || stableId('concept', list.name),
      name: list.name,
      sources: [],
      stocks: [],
    };
    const stockByCode = new Map(current.stocks.map((stock) => [String(stock.code), stock]));
    for (const stock of list.stocks || []) {
      if (!stockByCode.has(String(stock.code))) {
        stockByCode.set(String(stock.code), { code: String(stock.code), name: stock.name });
      }
    }
    current.stocks = [...stockByCode.values()].sort((a, b) => String(a.code).localeCompare(String(b.code), 'zh-Hant', { numeric: true }));
    current.count = current.stocks.length;
    current.sources.push(list.source || list.source_id || list.category_label || 'local_html');
    byName.set(key, current);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}

function writeListFile(file, payload) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const html = fs.readFileSync(SOURCE_FILE, 'utf8');
  const oldConcepts = parseConceptLists(html).map((concept) => ({ ...concept, source: path.relative(ROOT, SOURCE_FILE) }));
  const yahooConcepts = await fetchYahooClassLists(CONCEPT_SOURCE_FILE);
  const electronics = await fetchYahooClassLists(ELECTRONICS_SOURCE_FILE);
  const concepts = mergeLists(oldConcepts, yahooConcepts);

  writeListFile(OUTPUT_FILE, {
    generated_at: new Date().toISOString(),
    source_files: [
      path.relative(ROOT, SOURCE_FILE),
      ...(fs.existsSync(CONCEPT_SOURCE_FILE) ? [path.relative(ROOT, CONCEPT_SOURCE_FILE)] : []),
    ],
    lists: concepts,
  });
  writeListFile(ELECTRONICS_OUTPUT_FILE, {
    generated_at: new Date().toISOString(),
    source_files: [path.relative(ROOT, ELECTRONICS_SOURCE_FILE)],
    lists: electronics,
  });

  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT_FILE),
    electronics_output: path.relative(ROOT, ELECTRONICS_OUTPUT_FILE),
    concepts: concepts.length,
    memberships: concepts.reduce((total, concept) => total + concept.count, 0),
    electronics: electronics.length,
    electronics_memberships: electronics.reduce((total, list) => total + list.count, 0),
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
