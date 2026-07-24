const fs = require('fs');
const path = require('path');

const root = process.cwd();

// Load all fubon SMA files
const fubonFiles = fs.readdirSync(path.join(root, 'data_fubon'))
  .filter(f => f.startsWith('fubon_') && f.endsWith('_sma.json'))
  .sort();

console.log(`Found ${fubonFiles.length} Fubon data files.`);

// Load TWSE stock list to filter ordinary stocks
const stockListPath = path.join(root, 'data_twse/twse_industry_Stock.json');
let ordinaryStocks = new Set();
if (fs.existsSync(stockListPath)) {
  const json = JSON.parse(fs.readFileSync(stockListPath, 'utf8'));
  const list = Array.isArray(json) ? json : (json.data || Object.keys(json));
  list.forEach(s => {
    if (typeof s === 'string') ordinaryStocks.add(s);
    else if (typeof s === 'object' && s) ordinaryStocks.add(s.Code || s.stock_code || s['證券代號'] || s.code);
  });
}

console.log(`Loaded ${ordinaryStocks.size} ordinary stocks.`);

// Build price history map per stock: { code: [ { date, price, open, high, low, volume, sma20 }, ... ] }
let stockHistory = {};

fubonFiles.forEach(f => {
  const dateStr = f.replace('fubon_', '').replace('_sma.json', '');
  if (dateStr > '20260723') return; // Cutoff 0723
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data_fubon', f), 'utf8'));
  
  for (const code in data) {
    if (ordinaryStocks.size > 0 && !ordinaryStocks.has(code)) continue;
    const d = data[code];
    const key = Object.keys(d).find(k => k !== 'StockName');
    if (key && d[key]) {
      if (!stockHistory[code]) stockHistory[code] = [];
      stockHistory[code].push({
        date: dateStr,
        price: parseFloat(d[key].Price),
        open: parseFloat(d[key].Open),
        high: parseFloat(d[key].High),
        low: parseFloat(d[key].Low),
        volume: parseFloat(d[key].Volume),
        sma20: parseFloat(d[key].SMA20)
      });
    }
  }
});

// Sort each stock history by date
for (const code in stockHistory) {
  stockHistory[code].sort((a, b) => a.date.localeCompare(b.date));
}

// Find samples matching condition: r1 <= -3%, intraday_return <= -3%, price > sma20
let samples = [];

for (const code in stockHistory) {
  const hist = stockHistory[code];
  for (let i = 1; i < hist.length - 1; i++) {
    const curr = hist[i];
    const prev = hist[i - 1];
    const next = hist[i + 1];

    if (!curr.price || !prev.price || !next.price || curr.open === 0) continue;

    const r1 = ((curr.price / prev.price) - 1) * 100;
    const intraday_return = ((curr.price / curr.open) - 1) * 100;
    const next_return = ((next.price / curr.price) - 1) * 100;

    if (r1 <= -3 && intraday_return <= -3 && curr.price > curr.sma20) {
      samples.push({
        code,
        date: curr.date,
        r1: parseFloat(r1.toFixed(2)),
        intraday_return: parseFloat(intraday_return.toFixed(2)),
        next_return: parseFloat(next_return.toFixed(2))
      });
    }
  }
}

console.log(`\nFound ${samples.length} matching backtest samples.`);
if (samples.length > 0) {
  const downSamples = samples.filter(s => s.next_return < 0);
  const downRate = (downSamples.length / samples.length) * 100;
  const avgReturn = samples.reduce((a, b) => a + b.next_return, 0) / samples.length;

  console.log(`Next day drop rate: ${downRate.toFixed(1)}% (${downSamples.length}/${samples.length})`);
  console.log(`Next day avg return: ${avgReturn.toFixed(2)}%`);
}

// Save output json
const outputPath = path.join(root, 'public/predictions/backtest_1303_samples.json');
fs.writeFileSync(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  condition: "r1 <= -3%, intraday_return <= -3%, close > SMA20",
  totalSamples: samples.length,
  downRate: samples.length ? ((samples.filter(s => s.next_return < 0).length / samples.length) * 100).toFixed(1) + '%' : '0%',
  avgReturn: samples.length ? (samples.reduce((a, b) => a + b.next_return, 0) / samples.length).toFixed(2) + '%' : '0%',
  samples: samples
}, null, 2));

console.log(`Saved backtest output to ${outputPath}`);
