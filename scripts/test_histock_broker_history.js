#!/usr/bin/env node

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const stock = getArg('stock', '2449');
const datesArg = getArg('dates', getArg('date', '2026-05-15,2026-05-22,2026-06-12,2026-06-18'));
const dates = [...new Set(datesArg.split(',').map((value) => value.trim()).filter(Boolean))];

if (!/^[0-9A-Za-z]{4,6}$/.test(stock)) {
  throw new Error(`Invalid stock code: ${stock}`);
}
if (dates.length === 0 || dates.some((date) => !/^20\d{2}-\d{2}-\d{2}$/.test(date))) {
  throw new Error(`Invalid dates: ${datesArg}`);
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripHtml(value) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractRows(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((match) => stripHtml(match[1]))
      .filter(Boolean);
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

function parseNumber(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/,/g, '').replace(/\+/g, '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function parseBrokerRows(rows) {
  const records = [];
  for (const cells of rows) {
    if (cells.length < 10 || cells[0] === '券商名稱') continue;
    const groups = [cells.slice(0, 5), cells.slice(5, 10)];
    for (const [broker, buyRaw, sellRaw, netRaw, avgRaw] of groups) {
      if (!broker || broker === '券商名稱') continue;
      const buy = parseNumber(buyRaw);
      const sell = parseNumber(sellRaw);
      const net = parseNumber(netRaw);
      const avgPrice = parseNumber(avgRaw);
      if (![buy, sell, net].every(Number.isFinite)) continue;
      records.push({ broker, buy, sell, net, avg_price: avgPrice });
    }
  }
  return records;
}

async function fetchDate(date) {
  const yyyymmdd = date.replaceAll('-', '');
  const url = `https://histock.tw/stock/branch.aspx?from=${yyyymmdd}&no=${encodeURIComponent(stock)}&to=${yyyymmdd}`;
  console.log(`\n=== ${date} ===`);
  console.log(`Requesting: ${url}`);

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; stock_data research probe/2.0)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
    },
  });

  const html = await response.text();
  console.log(`HTTP: ${response.status}`);
  console.log(`Bytes: ${Buffer.byteLength(html)}`);
  if (!response.ok) throw new Error(`HiStock HTTP ${response.status} for ${date}`);

  const rows = extractRows(html);
  const pageText = stripHtml(html);
  const requestedDateTokens = [yyyymmdd, date, `${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}`];
  const dateSeen = requestedDateTokens.some((token) => pageText.includes(token) || html.includes(token));
  const brokerKeywordsSeen = /券商|買進|賣出|買超|賣超/.test(pageText);
  const records = parseBrokerRows(rows);

  console.log(`Requested date visible: ${dateSeen}`);
  console.log(`Broker records parsed: ${records.length}`);
  if (!brokerKeywordsSeen || rows.length === 0 || records.length === 0) {
    throw new Error(`HiStock page did not expose parseable broker data for ${date}`);
  }
  if (!dateSeen) {
    throw new Error(`Requested historical date was not visible for ${date}; date parameters may have been ignored.`);
  }

  const topSellers = [...records].sort((a, b) => a.net - b.net).slice(0, 5);
  const topBuyers = [...records].sort((a, b) => b.net - a.net).slice(0, 5);
  console.log('Top sellers:');
  topSellers.forEach((row) => console.log(`- ${row.broker}: ${row.net}`));
  console.log('Top buyers:');
  topBuyers.forEach((row) => console.log(`- ${row.broker}: +${row.net}`));

  return { date, records };
}

function aggregate(results) {
  const map = new Map();
  for (const { date, records } of results) {
    for (const row of records) {
      const item = map.get(row.broker) || {
        broker: row.broker,
        total_net: 0,
        total_buy: 0,
        total_sell: 0,
        appearances: 0,
        sell_days: 0,
        buy_days: 0,
        dates: [],
      };
      item.total_net += row.net;
      item.total_buy += row.buy;
      item.total_sell += row.sell;
      item.appearances += 1;
      if (row.net < 0) item.sell_days += 1;
      if (row.net > 0) item.buy_days += 1;
      item.dates.push({ date, net: row.net });
      map.set(row.broker, item);
    }
  }

  const items = [...map.values()].map((item) => ({
    ...item,
    sell_ratio: item.appearances ? item.sell_days / item.appearances : 0,
    buy_ratio: item.appearances ? item.buy_days / item.appearances : 0,
  }));
  return items;
}

async function main() {
  const results = [];
  for (const date of dates) {
    results.push(await fetchDate(date));
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const aggregated = aggregate(results);
  const persistentSellers = aggregated
    .filter((item) => item.sell_days >= 2)
    .sort((a, b) => a.total_net - b.total_net);
  const persistentBuyers = aggregated
    .filter((item) => item.buy_days >= 2)
    .sort((a, b) => b.total_net - a.total_net);

  console.log('\n=== Cross-date persistent sellers ===');
  for (const item of persistentSellers.slice(0, 20)) {
    console.log(`- ${item.broker}: net=${item.total_net}, sell_days=${item.sell_days}/${item.appearances}, ${item.dates.map((d) => `${d.date}:${d.net}`).join(', ')}`);
  }

  console.log('\n=== Cross-date persistent buyers ===');
  for (const item of persistentBuyers.slice(0, 20)) {
    console.log(`- ${item.broker}: net=+${item.total_net}, buy_days=${item.buy_days}/${item.appearances}, ${item.dates.map((d) => `${d.date}:${d.net}`).join(', ')}`);
  }

  const result = {
    source: 'histock',
    source_type: 'third_party_public_page',
    stock,
    requested_dates: dates,
    parsed_dates: results.length,
    unique_brokers: aggregated.length,
    persistent_sellers: persistentSellers.slice(0, 20),
    persistent_buyers: persistentBuyers.slice(0, 20),
  };

  console.log('\nProbe result:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
