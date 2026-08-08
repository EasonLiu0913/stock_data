'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result.set(key, true);
    else { result.set(key, next); i += 1; }
  }
  return result;
}

function extractDate(file) {
  const match = String(file || '').match(/(?:^|[^0-9])(20\d{6})(?:[^0-9]|$)/);
  return match ? match[1] : '';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeListedFile(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe files.json entry: ${value}`);
  }
  return normalized;
}

function trimDataset(siteRoot, dataset, maxDates) {
  const datasetDir = path.join(siteRoot, dataset);
  const filesJson = path.join(datasetDir, 'files.json');
  if (!fs.existsSync(datasetDir)) return { dataset, skipped: true, reason: 'dataset_missing' };
  if (!fs.existsSync(filesJson)) throw new Error(`${dataset}/files.json is required for windowed Pages publishing`);

  const original = readJson(filesJson);
  if (!Array.isArray(original)) throw new Error(`${dataset}/files.json must be an array`);

  const listed = original.map(normalizeListedFile);
  const dated = listed
    .map(file => ({ file, date: extractDate(file) }))
    .filter(item => item.date);
  const dates = [...new Set(dated.map(item => item.date))].sort();
  const keepDates = new Set(dates.slice(-maxDates));
  const kept = listed.filter(file => {
    if (file === 'files.json') return true;
    const date = extractDate(file);
    return !date || keepDates.has(date);
  });
  const keptSet = new Set(kept);

  let removedFiles = 0;
  for (const entry of fs.readdirSync(datasetDir, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const relative = entry.name;
    if (relative === 'files.json' || keptSet.has(relative)) continue;
    const date = extractDate(relative);
    if (!date || keepDates.has(date)) continue;
    fs.rmSync(path.join(datasetDir, relative), { force: true });
    removedFiles += 1;
  }

  const published = kept.filter(file => file !== 'files.json' && fs.existsSync(path.join(datasetDir, file)));
  const outputList = original.includes('files.json') ? ['files.json', ...published] : published;
  fs.writeFileSync(filesJson, `${JSON.stringify(outputList, null, 2)}\n`, 'utf8');

  return {
    dataset,
    max_dates: maxDates,
    original_dates: dates.length,
    published_dates: keepDates.size,
    original_entries: listed.length,
    published_entries: outputList.length,
    removed_files: removedFiles,
    first_published_date: [...keepDates].sort()[0] || null,
    last_published_date: [...keepDates].sort().at(-1) || null,
  };
}

function directoryBytes(root) {
  let total = 0;
  if (!fs.existsSync(root)) return 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) total += directoryBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function runSelfTest() {
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-trim-'));
  const dataset = path.join(root, 'data_sample');
  fs.mkdirSync(dataset);
  const files = ['files.json'];
  for (const date of ['20260102', '20260103', '20260104']) {
    for (const suffix of ['a.json', 'b.csv']) {
      const name = `sample_${date}_${suffix}`;
      files.push(name);
      fs.writeFileSync(path.join(dataset, name), date);
    }
  }
  fs.writeFileSync(path.join(dataset, 'meta.json'), '{}');
  files.push('meta.json');
  fs.writeFileSync(path.join(dataset, 'files.json'), JSON.stringify(files));
  const result = trimDataset(root, 'data_sample', 2);
  const published = readJson(path.join(dataset, 'files.json'));
  if (result.published_dates !== 2) throw new Error('self-test expected two published dates');
  if (published.some(file => file.includes('20260102'))) throw new Error('self-test retained an expired date');
  if (!published.includes('meta.json')) throw new Error('self-test dropped undated metadata');
  if (!fs.existsSync(path.join(dataset, 'sample_20260104_a.json'))) throw new Error('self-test dropped latest file');
  console.log('trim_pages_artifact self-test passed');
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--self-test') {
    runSelfTest();
    return;
  }
  const args = parseArgs(argv);
  const siteRoot = path.resolve(String(args.get('site') || '_site'));
  const policies = [
    ['data_fubon', 45],
    ['data_twse_mi_index', 90],
  ];
  const results = policies.map(([dataset, maxDates]) => trimDataset(siteRoot, dataset, maxDates));
  const bytes = directoryBytes(siteRoot);
  const summary = { site: siteRoot, bytes, mebibytes: Number((bytes / 1024 / 1024).toFixed(1)), results };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to trim Pages artifact: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { directoryBytes, extractDate, trimDataset };
