#!/usr/bin/env node

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const stock = getArg('stock', '2449');
const date = getArg('date', '2026-05-15');

if (!/^[0-9A-Za-z]{4,6}$/.test(stock)) {
  throw new Error(`Invalid stock code: ${stock}`);
}
if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) {
  throw new Error(`Invalid date: ${date}`);
}

const yyyymmdd = date.replaceAll('-', '');
const url = `https://histock.tw/stock/branch.aspx?from=${yyyymmdd}&no=${encodeURIComponent(stock)}&to=${yyyymmdd}`;

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

async function main() {
  console.log(`Requesting: ${url}`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; stock_data research probe/1.0)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
    },
  });

  const html = await response.text();
  console.log(`HTTP: ${response.status}`);
  console.log(`Final URL: ${response.url}`);
  console.log(`Bytes: ${Buffer.byteLength(html)}`);

  if (!response.ok) {
    throw new Error(`HiStock HTTP ${response.status}`);
  }

  const rows = extractRows(html);
  const pageText = stripHtml(html);
  const requestedDateTokens = [yyyymmdd, date, `${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}`];
  const dateSeen = requestedDateTokens.some((token) => pageText.includes(token) || html.includes(token));
  const brokerKeywordsSeen = /券商|買進|賣出|買超|賣超/.test(pageText);

  console.log(`Requested date visible: ${dateSeen}`);
  console.log(`Broker keywords visible: ${brokerKeywordsSeen}`);
  console.log(`HTML table rows with >=2 cells: ${rows.length}`);

  const interestingRows = rows.filter((cells) => {
    const text = cells.join(' | ');
    return /買進|賣出|買超|賣超|券商|摩根|瑞銀|美林|高盛|凱基|元大|富邦|統一|永豐|群益|兆豐|第一金|台新|元富|國泰/.test(text);
  });

  console.log('\nSample candidate rows:');
  for (const cells of interestingRows.slice(0, 20)) {
    console.log(`- ${cells.join(' | ')}`);
  }

  if (!brokerKeywordsSeen || rows.length === 0) {
    console.log('\nPage text sample:');
    console.log(pageText.slice(0, 2000));
    throw new Error('HiStock page did not expose parseable broker-table content.');
  }

  const result = {
    source: 'histock',
    stock,
    requested_date: date,
    request_url: url,
    final_url: response.url,
    http_status: response.status,
    response_bytes: Buffer.byteLength(html),
    requested_date_visible: dateSeen,
    table_row_count: rows.length,
    candidate_row_count: interestingRows.length,
  };

  console.log('\nProbe result:');
  console.log(JSON.stringify(result, null, 2));

  if (!dateSeen) {
    throw new Error('HiStock returned broker content, but the requested historical date was not visible. Date parameters may have been ignored.');
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
