'use strict';

const fs = require('node:fs');
const os = require('node:os');
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

function removeEmptyDirectories(directory, stopAt) {
  if (!fs.existsSync(directory) || path.resolve(directory) === path.resolve(stopAt)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(path.join(directory, entry.name), stopAt);
  }
  if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
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
  for (const relative of listed) {
    if (relative === 'files.json' || keptSet.has(relative)) continue;
    const absolute = path.join(datasetDir, relative);
    if (!fs.existsSync(absolute)) continue;
    const stats = fs.lstatSync(absolute);
    if (!stats.isFile() && !stats.isSymbolicLink()) continue;
    fs.rmSync(absolute, { force: true });
    removedFiles += 1;
  }

  for (const entry of fs.readdirSync(datasetDir, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const relative = entry.name;
    if (relative === 'files.json' || keptSet.has(relative)) continue;
    const date = extractDate(relative);
    if (!date || keepDates.has(date)) continue;
    fs.rmSync(path.join(datasetDir, relative), { force: true });
    removedFiles += 1;
  }

  for (const entry of fs.readdirSync(datasetDir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(path.join(datasetDir, entry.name), datasetDir);
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

function trimPredictionDates(siteRoot, maxDates = 3) {
  const dataset = 'data_predictions';
  const datasetDir = path.join(siteRoot, dataset);
  const manifestFile = path.join(datasetDir, 'manifest.json');
  if (!fs.existsSync(datasetDir)) return { dataset, skipped: true, reason: 'dataset_missing' };
  if (!fs.existsSync(manifestFile)) throw new Error(`${dataset}/manifest.json is required`);

  const manifest = readJson(manifestFile);
  const dateDirectories = fs.readdirSync(datasetDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  const declaredDates = Array.isArray(manifest.available_dates)
    ? manifest.available_dates.map(value => String(value).replace(/[^0-9]/g, '')).filter(value => /^20\d{6}$/.test(value))
    : [];
  const allDates = [...new Set([...dateDirectories, ...declaredDates])].sort();
  const latest = String(manifest.forecast_date_compact || manifest.latest_date || '').replace(/[^0-9]/g, '');
  const keepDates = new Set(allDates.slice(-maxDates));
  if (/^20\d{6}$/.test(latest)) keepDates.add(latest);

  let removedDirectories = 0;
  for (const date of dateDirectories) {
    if (keepDates.has(date)) continue;
    fs.rmSync(path.join(datasetDir, date), { recursive: true, force: true });
    removedDirectories += 1;
  }

  const publishedDates = [...keepDates]
    .filter(date => fs.existsSync(path.join(datasetDir, date)))
    .sort();
  manifest.available_dates = publishedDates;
  if (publishedDates.length) {
    manifest.latest_date = publishedDates.at(-1);
    if (!/^20\d{6}$/.test(String(manifest.forecast_date_compact || ''))) {
      manifest.forecast_date_compact = publishedDates.at(-1);
    }
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    dataset,
    max_dates: maxDates,
    original_dates: allDates.length,
    published_dates: publishedDates.length,
    removed_directories: removedDirectories,
    first_published_date: publishedDates[0] || null,
    last_published_date: publishedDates.at(-1) || null,
  };
}

function trimNonPublishedWorkfiles(siteRoot) {
  // These are repository research/checkpoint assets, not browser runtime dependencies.
  // Remove them only from the prepared Pages artifact; source files remain in git/main.
  const removals = [
    'data_prediction_analysis/eps-valuation/valuation-batches',
    'data_prediction_analysis/eps-valuation/formal-report-backfill-runs',
    'data_prediction_analysis/eps-valuation/valuation-batch-plan.json',
    'data_prediction_analysis/eps-valuation/formal-report-event-gap-report.json',
    'data_prediction_analysis/quarterly-financial-quality',
    'data_prediction_analysis/relative-leadership',
  ];
  const removed = [];
  let removedBytes = 0;
  for (const relative of removals) {
    const absolute = path.join(siteRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    removedBytes += directoryBytes(absolute);
    fs.rmSync(absolute, { recursive: true, force: true });
    removed.push(relative);
  }
  return {
    dataset: 'pages_workfiles',
    removed_entries: removed.length,
    removed_bytes: removedBytes,
    removed_mebibytes: Number((removedBytes / 1024 / 1024).toFixed(1)),
    removed,
  };
}

function directoryBytes(root) {
  if (!fs.existsSync(root)) return 0;
  const stats = fs.statSync(root);
  if (stats.isFile()) return stats.size;
  let total = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) total += directoryBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-trim-'));
  const dataset = path.join(root, 'data_sample');
  fs.mkdirSync(path.join(dataset, 'nested'), { recursive: true });
  const files = ['files.json'];
  for (const date of ['20260102', '20260103', '20260104']) {
    for (const suffix of ['a.json', 'b.csv']) {
      const name = `nested/sample_${date}_${suffix}`;
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
  if (fs.existsSync(path.join(dataset, 'nested/sample_20260102_a.json'))) throw new Error('self-test retained nested expired file');
  if (!fs.existsSync(path.join(dataset, 'nested/sample_20260104_a.json'))) throw new Error('self-test dropped latest nested file');

  const predictions = path.join(root, 'data_predictions');
  fs.mkdirSync(predictions);
  for (const date of ['20260102', '20260103', '20260104', '20260105']) {
    fs.mkdirSync(path.join(predictions, date));
    fs.writeFileSync(path.join(predictions, date, 'summary.json'), '{}');
  }
  fs.writeFileSync(path.join(predictions, 'manifest.json'), JSON.stringify({
    forecast_date_compact: '20260105',
    latest_date: '20260105',
    available_dates: ['20260102', '20260103', '20260104', '20260105'],
  }));
  const predictionResult = trimPredictionDates(root, 2);
  const predictionManifest = readJson(path.join(predictions, 'manifest.json'));
  if (predictionResult.published_dates !== 2) throw new Error('prediction self-test expected two dates');
  if (fs.existsSync(path.join(predictions, '20260102'))) throw new Error('prediction self-test retained expired directory');
  if (predictionManifest.available_dates.join(',') !== '20260104,20260105') throw new Error('prediction manifest was not trimmed');

  const epsRoot = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  const quarterlyResearchRoot = path.join(root, 'data_prediction_analysis', 'quarterly-financial-quality');
  const relativeLeadershipRoot = path.join(root, 'data_prediction_analysis', 'relative-leadership');
  fs.mkdirSync(path.join(epsRoot, 'valuation-batches'), { recursive: true });
  fs.mkdirSync(path.join(epsRoot, 'formal-report-backfill-runs'), { recursive: true });
  fs.mkdirSync(quarterlyResearchRoot, { recursive: true });
  fs.mkdirSync(relativeLeadershipRoot, { recursive: true });
  fs.writeFileSync(path.join(epsRoot, 'valuation-batches', 'batch.json'), 'checkpoint');
  fs.writeFileSync(path.join(epsRoot, 'formal-report-backfill-runs', 'run.json'), 'run');
  fs.writeFileSync(path.join(epsRoot, 'valuation-batch-plan.json'), '{}');
  fs.writeFileSync(path.join(epsRoot, 'formal-report-event-gap-report.json'), 'gap');
  fs.writeFileSync(path.join(epsRoot, 'valuation-backtest.json'), '{}');
  fs.writeFileSync(path.join(epsRoot, 'coverage-report.json'), '{}');
  fs.writeFileSync(path.join(quarterlyResearchRoot, 'experiment.json'), 'research-only');
  fs.writeFileSync(path.join(relativeLeadershipRoot, 'analysis.json'), 'research-only');
  const workfileResult = trimNonPublishedWorkfiles(root);
  if (workfileResult.removed_entries !== 6) throw new Error('workfile self-test expected six removals');
  if (fs.existsSync(path.join(epsRoot, 'valuation-batches'))) throw new Error('workfile self-test retained valuation batches');
  if (fs.existsSync(path.join(epsRoot, 'valuation-batch-plan.json'))) throw new Error('workfile self-test retained batch plan');
  if (fs.existsSync(path.join(epsRoot, 'formal-report-event-gap-report.json'))) throw new Error('workfile self-test retained non-public gap report');
  if (fs.existsSync(quarterlyResearchRoot)) throw new Error('workfile self-test retained non-public quarterly research');
  if (fs.existsSync(relativeLeadershipRoot)) throw new Error('workfile self-test retained non-public relative leadership research');
  if (!fs.existsSync(path.join(epsRoot, 'valuation-backtest.json'))) throw new Error('workfile self-test removed published valuation output');
  if (!fs.existsSync(path.join(epsRoot, 'coverage-report.json'))) throw new Error('workfile self-test removed published coverage output');
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
    ['data_fubon', 15],
    ['data_twse_mi_index', 10],
    ['data_twse_institutional_investors', 10],
    ['data_twse_dealers', 10],
    ['data_twse_foreign_investors', 10],
    ['data_normalized', 10],
  ];
  const results = policies.map(([dataset, maxDates]) => trimDataset(siteRoot, dataset, maxDates));
  results.push(trimPredictionDates(siteRoot, 3));
  results.push(trimNonPublishedWorkfiles(siteRoot));
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

module.exports = { directoryBytes, extractDate, trimDataset, trimPredictionDates, trimNonPublishedWorkfiles };
