#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const OUTPUT_DIR = path.join(ROOT, 'data_cnn_fear_and_greed');
const FILE_NAME = 'cnn_fear_and_greed.json';
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

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json, text/plain, */*',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        referer: 'https://www.cnn.com/markets/fear-and-greed',
        'user-agent': 'Mozilla/5.0 (compatible; stock-data-cnn-fear-greed-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function readInputFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function validatePayload(payload) {
  const fearAndGreed = payload?.fear_and_greed;
  if (!fearAndGreed || typeof fearAndGreed !== 'object') {
    throw new Error('CNN response does not contain fear_and_greed.');
  }
  if (!Number.isFinite(Number(fearAndGreed.score))) {
    throw new Error('CNN fear_and_greed.score is missing or invalid.');
  }
  if (typeof fearAndGreed.rating !== 'string' || !fearAndGreed.rating.trim()) {
    throw new Error('CNN fear_and_greed.rating is missing or invalid.');
  }
  if (typeof fearAndGreed.timestamp !== 'string') {
    throw new Error('CNN fear_and_greed.timestamp is missing or invalid.');
  }

  const match = fearAndGreed.timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!match || Number.isNaN(Date.parse(fearAndGreed.timestamp))) {
    throw new Error(`CNN fear_and_greed.timestamp is not a valid ISO timestamp: ${fearAndGreed.timestamp}`);
  }

  const dataDate = `${match[1]}${match[2]}${match[3]}`;
  return { fearAndGreed, dataDate };
}

function writeIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (previous === content) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function listDataDates() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .filter((entry) => fs.existsSync(path.join(OUTPUT_DIR, entry.name, FILE_NAME)))
    .map((entry) => entry.name)
    .sort();
}

function refreshIndexes() {
  const dates = listDataDates();
  const files = dates.map((date) => `${date}/${FILE_NAME}`);
  const filesChanged = writeIfChanged(
    path.join(OUTPUT_DIR, 'files.json'),
    JSON.stringify(files, null, 2)
  );

  const latestDate = dates.at(-1) || null;
  let latestTimestamp = null;
  if (latestDate) {
    const latestPayload = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, latestDate, FILE_NAME), 'utf8'));
    latestTimestamp = latestPayload?.fear_and_greed?.timestamp || null;
  }

  const manifestChanged = writeIfChanged(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      source_url: SOURCE_URL,
      latest_date: latestDate,
      latest_file: latestDate ? `data_cnn_fear_and_greed/${latestDate}/${FILE_NAME}` : null,
      latest_timestamp: latestTimestamp,
      available_dates: dates
    }, null, 2)}\n`
  );

  return { filesChanged, manifestChanged, dates };
}

function writeGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = args.get('input-file')
    ? readInputFile(args.get('input-file'))
    : await fetchJson(SOURCE_URL);
  const { fearAndGreed, dataDate } = validatePayload(payload);

  const outputFile = path.join(OUTPUT_DIR, dataDate, FILE_NAME);
  const relativeOutput = path.relative(ROOT, outputFile).replaceAll(path.sep, '/');
  const dataChanged = writeIfChanged(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  const indexes = refreshIndexes();
  const changed = dataChanged || indexes.filesChanged || indexes.manifestChanged;

  writeGitHubOutput('data_date', dataDate);
  writeGitHubOutput('timestamp', fearAndGreed.timestamp);
  writeGitHubOutput('output_file', relativeOutput);
  writeGitHubOutput('changed', changed ? 'true' : 'false');

  console.log(JSON.stringify({
    data_date: dataDate,
    timestamp: fearAndGreed.timestamp,
    score: fearAndGreed.score,
    rating: fearAndGreed.rating,
    changed,
    output: relativeOutput
  }));
}

main().catch((error) => {
  console.error(`Failed to crawl CNN Fear & Greed Index: ${error.message}`);
  process.exitCode = 1;
});
