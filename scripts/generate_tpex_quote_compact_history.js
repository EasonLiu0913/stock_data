const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'data_tpex_daily_quotes');
const OUTPUT_FILE = path.join(INPUT_DIR, 'compact-history.json');
const DEFAULT_LIMIT = 30;

function num(value) {
  const n = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}

function findIndex(fields, candidates) {
  for (const name of candidates) {
    const index = fields.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function extractSnapshot(payload, fallbackDate) {
  if (!payload || payload.stat !== 'ok') throw new Error('TPEx daily quote payload is not ok.');
  const table = payload.tables?.find(item => item.title === '上櫃股票行情')
    || payload.tables?.find(item => Array.isArray(item.fields) && item.fields.includes('代號') && item.fields.includes('收盤'));
  if (!table || !Array.isArray(table.fields) || !Array.isArray(table.data)) {
    throw new Error('TPEx daily quote payload has no usable quote table.');
  }

  const codeIndex = findIndex(table.fields, ['代號']);
  const nameIndex = findIndex(table.fields, ['名稱']);
  const closeIndex = findIndex(table.fields, ['收盤']);
  const volumeIndex = findIndex(table.fields, ['成交股數', '成交量']);
  if ([codeIndex, closeIndex].some(index => index < 0)) {
    throw new Error('TPEx daily quote table is missing code/close fields.');
  }

  const date = String(payload.date || fallbackDate || '').replaceAll('/', '').replaceAll('-', '');
  if (!/^20\d{6}$/.test(date)) throw new Error(`Invalid TPEx quote date: ${payload.date || fallbackDate}`);

  const stocks = new Map();
  for (const row of table.data) {
    const code = String(row?.[codeIndex] ?? '').trim();
    const close = num(row?.[closeIndex]);
    if (!/^\d{4,6}$/.test(code) || !Number.isFinite(close)) continue;
    stocks.set(code, {
      name: nameIndex >= 0 ? String(row?.[nameIndex] ?? '').trim() : '',
      close,
      volume: volumeIndex >= 0 ? num(row?.[volumeIndex]) : null
    });
  }
  if (!stocks.size) throw new Error(`TPEx quote snapshot ${date} contains no valid stock rows.`);
  return { date, stocks };
}

function buildCompactHistory(snapshots) {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const stocks = {};
  for (const snapshot of ordered) {
    for (const [code, value] of snapshot.stocks) {
      const entry = stocks[code] ||= { name: value.name || '', rows: [] };
      if (!entry.name && value.name) entry.name = value.name;
      entry.rows.push({ date: snapshot.date, close: value.close, volume: value.volume });
    }
  }
  return {
    schema_version: 1,
    source: 'tpex_official_afterTrading_dailyQuotes',
    latest_date: ordered.at(-1)?.date || null,
    dates: ordered.map(item => item.date),
    stocks
  };
}

function selfTest() {
  const payload = {
    stat: 'ok',
    date: '2026/09/21',
    tables: [{
      title: '上櫃股票行情',
      fields: ['代號', '名稱', '收盤', '成交股數'],
      data: [['8358', '金居', '230.5', '12,345'], ['XXXX', 'bad', '--', '0']]
    }]
  };
  const snap = extractSnapshot(payload, '20260921');
  if (snap.date !== '20260921' || snap.stocks.get('8358')?.close !== 230.5 || snap.stocks.get('8358')?.volume !== 12345) {
    throw new Error('extractSnapshot self-test failed');
  }
  const compact = buildCompactHistory([snap]);
  if (compact.latest_date !== '20260921' || compact.stocks['8358']?.rows?.length !== 1) {
    throw new Error('buildCompactHistory self-test failed');
  }
  console.log('TPEx compact history self-test passed.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  const limitFlag = args.indexOf('--limit');
  const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > 120) throw new Error(`Invalid --limit: ${limit}`);

  const filesIndex = path.join(INPUT_DIR, 'files.json');
  const files = JSON.parse(fs.readFileSync(filesIndex, 'utf8'))
    .filter(file => /^\d{8}_tpex_daily_quotes\.json$/.test(file))
    .sort()
    .slice(-limit);

  const snapshots = files.map(file => {
    const payload = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file), 'utf8'));
    return extractSnapshot(payload, file.slice(0, 8));
  });

  const output = buildCompactHistory(snapshots);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Generated ${path.relative(ROOT, OUTPUT_FILE)}: dates=${output.dates.length}, stocks=${Object.keys(output.stocks).length}, latest=${output.latest_date}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { extractSnapshot, buildCompactHistory };
