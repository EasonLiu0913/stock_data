'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  directoryBytes,
  trimDataset,
  trimPredictionDates,
} = require('./trim_pages_artifact');

const MIB = 1024 * 1024;

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

function mib(bytes) {
  return Number((bytes / MIB).toFixed(1));
}

function removePath(siteRoot, relative) {
  const absolute = path.join(siteRoot, relative);
  if (!fs.existsSync(absolute)) return null;
  const before = directoryBytes(absolute);
  fs.rmSync(absolute, { recursive: true, force: true });
  return {
    path: relative,
    removed_bytes: before,
    removed_mebibytes: mib(before),
  };
}

function trimPredictionAnalysisDates(siteRoot, maxDates) {
  const root = path.join(siteRoot, 'data_prediction_analysis');
  if (!fs.existsSync(root)) {
    return { dataset: 'data_prediction_analysis_dates', skipped: true, reason: 'dataset_missing' };
  }

  const dates = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const keep = new Set(dates.slice(-maxDates));
  let removedDirectories = 0;
  let removedBytes = 0;

  for (const date of dates) {
    if (keep.has(date)) continue;
    const absolute = path.join(root, date);
    removedBytes += directoryBytes(absolute);
    fs.rmSync(absolute, { recursive: true, force: true });
    removedDirectories += 1;
  }

  const manifestFile = path.join(root, 'manifest.json');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const publishedDates = [...keep].filter((date) => fs.existsSync(path.join(root, date))).sort();
    if (Array.isArray(manifest.available_volume_filter_dates)) {
      manifest.available_volume_filter_dates = manifest.available_volume_filter_dates
        .map(String)
        .filter((date) => publishedDates.includes(date));
    }
    if (manifest.latest_date && !publishedDates.includes(String(manifest.latest_date))) {
      manifest.latest_date = publishedDates.at(-1) || null;
    }
    if (manifest.latest_volume_filter_date && !publishedDates.includes(String(manifest.latest_volume_filter_date))) {
      manifest.latest_volume_filter_date = publishedDates.at(-1) || null;
    }
    if (manifest.latest_json && manifest.latest_date) {
      manifest.latest_json = `data_prediction_analysis/${manifest.latest_date}/industry-factor-ranges.json`;
    }
    if (manifest.latest_markdown && manifest.latest_date) {
      manifest.latest_markdown = `data_prediction_analysis/${manifest.latest_date}/industry-factor-ranges.md`;
    }
    if (manifest.latest_volume_filter_analysis && manifest.latest_volume_filter_date) {
      manifest.latest_volume_filter_analysis = `data_prediction_analysis/${manifest.latest_volume_filter_date}/volume-filter-impact.json`;
    }
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  return {
    dataset: 'data_prediction_analysis_dates',
    max_dates: maxDates,
    original_dates: dates.length,
    published_dates: keep.size,
    removed_directories: removedDirectories,
    removed_bytes: removedBytes,
    removed_mebibytes: mib(removedBytes),
    first_published_date: [...keep].sort()[0] || null,
    last_published_date: [...keep].sort().at(-1) || null,
  };
}

function trimStrategySnapshots(siteRoot, maxDates) {
  const root = path.join(siteRoot, 'data_prediction_analysis', 'strategy-snapshots');
  const manifestFile = path.join(root, 'manifest.json');
  if (!fs.existsSync(root)) {
    return { dataset: 'strategy_snapshots', skipped: true, reason: 'dataset_missing' };
  }
  if (!fs.existsSync(manifestFile)) {
    throw new Error('data_prediction_analysis/strategy-snapshots/manifest.json is required');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const manifestDates = manifest.dates && typeof manifest.dates === 'object'
    ? Object.keys(manifest.dates).filter((date) => /^20\d{6}$/.test(date)).sort()
    : [];
  const keepDates = new Set(manifestDates.slice(-maxDates));
  let removedBytes = 0;
  let removedEntries = 0;

  const datedSubtrees = [
    ['historical_recalculation', 'directory'],
    ['live_snapshot_history', 'directory'],
    ['live_snapshot', 'file'],
  ];

  for (const [subtree, mode] of datedSubtrees) {
    const subtreeRoot = path.join(root, subtree);
    if (!fs.existsSync(subtreeRoot)) continue;
    for (const entry of fs.readdirSync(subtreeRoot, { withFileTypes: true })) {
      const date = mode === 'file'
        ? String(entry.name).match(/^(20\d{6})\.json$/)?.[1]
        : (/^20\d{6}$/.test(entry.name) ? entry.name : null);
      if (!date || keepDates.has(date)) continue;
      const absolute = path.join(subtreeRoot, entry.name);
      removedBytes += directoryBytes(absolute);
      fs.rmSync(absolute, { recursive: true, force: true });
      removedEntries += 1;
    }
  }

  if (manifest.dates && typeof manifest.dates === 'object') {
    manifest.dates = Object.fromEntries(
      Object.entries(manifest.dates).filter(([date]) => keepDates.has(date))
    );
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    dataset: 'strategy_snapshots',
    max_dates: maxDates,
    original_dates: manifestDates.length,
    published_dates: keepDates.size,
    removed_entries: removedEntries,
    removed_bytes: removedBytes,
    removed_mebibytes: mib(removedBytes),
    first_published_date: [...keepDates].sort()[0] || null,
    last_published_date: [...keepDates].sort().at(-1) || null,
  };
}

function applyAggressiveWindows(siteRoot) {
  const policies = [
    ['data_fubon', 6],
    ['data_twse_mi_index', 5],
    ['data_twse_institutional_investors', 6],
    ['data_twse_dealers', 6],
    ['data_twse_foreign_investors', 6],
    ['data_normalized', 2],
  ];
  const results = [];
  for (const [dataset, maxDates] of policies) {
    results.push(trimDataset(siteRoot, dataset, maxDates));
  }
  results.push(trimPredictionDates(siteRoot, 1));
  results.push(trimPredictionAnalysisDates(siteRoot, 5));
  return results;
}

function applySecondaryResearchCuts(siteRoot) {
  const candidates = [
    'data_prediction_analysis/momentum-history',
    'data_prediction_analysis/momentum-replay',
    'data_prediction_analysis/momentum-research',
    'data_prediction_analysis/tag-strategy-recalculation',
  ];
  return candidates.map((relative) => removePath(siteRoot, relative)).filter(Boolean);
}

function runSelfTest() {
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-budget-'));
  const analysis = path.join(root, 'data_prediction_analysis');
  fs.mkdirSync(analysis, { recursive: true });
  for (const date of ['20260101', '20260102', '20260103', '20260104', '20260105', '20260106']) {
    fs.mkdirSync(path.join(analysis, date));
    fs.writeFileSync(path.join(analysis, date, 'industry-factor-ranges.json'), '{}');
  }
  fs.writeFileSync(path.join(analysis, 'manifest.json'), JSON.stringify({
    latest_date: '20260106',
    latest_json: 'data_prediction_analysis/20260106/industry-factor-ranges.json',
    available_volume_filter_dates: ['20260106', '20260105', '20260104', '20260103', '20260102', '20260101'],
  }));
  const result = trimPredictionAnalysisDates(root, 3);
  if (result.published_dates !== 3) throw new Error('budget self-test expected three analysis dates');
  if (fs.existsSync(path.join(analysis, '20260103'))) throw new Error('budget self-test retained expired analysis date');
  const manifest = JSON.parse(fs.readFileSync(path.join(analysis, 'manifest.json'), 'utf8'));
  if (manifest.available_volume_filter_dates.length !== 3) throw new Error('budget self-test did not trim manifest dates');

  const snapshotRoot = path.join(analysis, 'strategy-snapshots');
  fs.mkdirSync(path.join(snapshotRoot, 'historical_recalculation'), { recursive: true });
  fs.mkdirSync(path.join(snapshotRoot, 'live_snapshot'), { recursive: true });
  fs.mkdirSync(path.join(snapshotRoot, 'live_snapshot_history'), { recursive: true });
  const snapshotDates = ['20260101', '20260102', '20260103', '20260104', '20260105', '20260106'];
  for (const date of snapshotDates) {
    fs.mkdirSync(path.join(snapshotRoot, 'historical_recalculation', date));
    fs.writeFileSync(path.join(snapshotRoot, 'historical_recalculation', date, 'snapshot.json'), date);
    fs.writeFileSync(path.join(snapshotRoot, 'live_snapshot', `${date}.json`), date);
    fs.mkdirSync(path.join(snapshotRoot, 'live_snapshot_history', date));
    fs.writeFileSync(path.join(snapshotRoot, 'live_snapshot_history', date, 'history.json'), date);
  }
  fs.writeFileSync(path.join(snapshotRoot, 'manifest.json'), JSON.stringify({
    schema_version: 2,
    dates: Object.fromEntries(snapshotDates.map((date) => [date, {
      live_snapshot: { file: `data_prediction_analysis/strategy-snapshots/live_snapshot/${date}.json` },
    }])),
  }));
  const snapshotResult = trimStrategySnapshots(root, 2);
  if (snapshotResult.published_dates !== 2) throw new Error('budget self-test expected two strategy snapshot dates');
  if (fs.existsSync(path.join(snapshotRoot, 'live_snapshot', '20260104.json'))) throw new Error('budget self-test retained expired live snapshot');
  if (!fs.existsSync(path.join(snapshotRoot, 'live_snapshot', '20260106.json'))) throw new Error('budget self-test removed latest live snapshot');
  const snapshotManifest = JSON.parse(fs.readFileSync(path.join(snapshotRoot, 'manifest.json'), 'utf8'));
  if (Object.keys(snapshotManifest.dates).join(',') !== '20260105,20260106') throw new Error('budget self-test did not trim snapshot manifest dates');
  console.log('apply_pages_size_budget self-test passed');
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--self-test') {
    runSelfTest();
    return;
  }

  const args = parseArgs(argv);
  const siteRoot = path.resolve(String(args.get('site') || '_site'));
  const targetMiB = Number(args.get('target-mib') || 800);
  const triggerMiB = Number(args.get('trigger-mib') || 850);
  if (!Number.isFinite(targetMiB) || targetMiB <= 0) throw new Error('target-mib must be a positive number');
  if (!Number.isFinite(triggerMiB) || triggerMiB < targetMiB) throw new Error('trigger-mib must be >= target-mib');

  const beforeBytes = directoryBytes(siteRoot);
  const summary = {
    site: siteRoot,
    target_mebibytes: targetMiB,
    stage2_trigger_mebibytes: triggerMiB,
    before_mebibytes: mib(beforeBytes),
    stage: 1,
    aggressive_window_results: [],
    secondary_research_removals: [],
    strategy_snapshot_trim: null,
  };

  if (beforeBytes <= triggerMiB * MIB) {
    summary.after_mebibytes = summary.before_mebibytes;
    summary.message = 'Stage 1 artifact is within the normal publication budget; no secondary data was discarded.';
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  summary.stage = 2;
  summary.aggressive_window_results = applyAggressiveWindows(siteRoot);
  let currentBytes = directoryBytes(siteRoot);
  summary.after_aggressive_windows_mebibytes = mib(currentBytes);

  if (currentBytes > targetMiB * MIB) {
    summary.secondary_research_removals = applySecondaryResearchCuts(siteRoot);
    currentBytes = directoryBytes(siteRoot);
  }

  if (currentBytes > targetMiB * MIB) {
    summary.stage = 3;
    summary.strategy_snapshot_trim = trimStrategySnapshots(siteRoot, 5);
    currentBytes = directoryBytes(siteRoot);
  }

  summary.after_mebibytes = mib(currentBytes);
  summary.reclaimed_mebibytes = mib(beforeBytes - currentBytes);
  summary.target_met = currentBytes <= targetMiB * MIB;
  summary.message = summary.target_met
    ? `Stage ${summary.stage} reduced the Pages artifact to the target budget.`
    : `Stage ${summary.stage} completed but the target budget was not met; the deployment hard cap remains the final safety guard.`;
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Failed to apply Pages size budget: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  applyAggressiveWindows,
  applySecondaryResearchCuts,
  trimPredictionAnalysisDates,
  trimStrategySnapshots,
};
