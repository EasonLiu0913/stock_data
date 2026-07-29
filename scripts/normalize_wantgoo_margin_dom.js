#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_ROOT = path.join(
  REPOSITORY_ROOT,
  'data_wantgoo_margin',
  'manual',
);
const INPUT_FILENAME_PATTERN = /^(\d{8})_wantgoo_margin_dom\.json$/;
const OUTPUT_FILENAME_PATTERN =
  /^(\d{8})_wantgoo_margin_dom_normalized\.json$/;

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeAtomic(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporaryFilename = `${filename}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryFilename, serialize(value), 'utf8');
  fs.renameSync(temporaryFilename, filename);
}

function compactDate(value) {
  const match = String(value || '').match(
    /^(20\d{2})-(\d{2})-(\d{2})$/,
  );
  if (!match) return '';

  const compact = `${match[1]}${match[2]}${match[3]}`;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) {
    return '';
  }
  return compact;
}

function requireFiniteNumber(record, field, sourceName) {
  const rawValue = record?.[field];
  const value = Number(rawValue);
  if (
    rawValue === null
    || rawValue === undefined
    || rawValue === ''
    || !Number.isFinite(value)
  ) {
    throw new Error(`${sourceName}.${field} must be a finite number`);
  }
  return value;
}

function approximatelyEqual(left, right, tolerance) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function validateInputFilename(inputFilename) {
  const basename = path.basename(inputFilename);
  const match = basename.match(INPUT_FILENAME_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid input filename: ${basename}. `
      + 'Expected YYYYMMDD_wantgoo_margin_dom.json.',
    );
  }
  return match[1];
}

function normalizeDomCapture(capture, options = {}) {
  const {
    expectedDate,
    sourceFile = '',
  } = options;

  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
    throw new Error('Wantgoo DOM capture must be a JSON object');
  }

  const tradeDate = String(capture.tradeDate || '');
  const tradeDateCompact = compactDate(tradeDate);
  if (!tradeDateCompact) {
    throw new Error('tradeDate must be a real YYYY-MM-DD date');
  }
  if (capture.tradeDateCompact !== tradeDateCompact) {
    throw new Error(
      `tradeDateCompact does not match tradeDate: `
      + `${capture.tradeDateCompact} !== ${tradeDateCompact}`,
    );
  }
  if (expectedDate && expectedDate !== tradeDateCompact) {
    throw new Error(
      `Filename date ${expectedDate} does not match JSON date `
      + `${tradeDateCompact}`,
    );
  }

  if (!Array.isArray(capture.table) || capture.table.length === 0) {
    throw new Error('table must be a non-empty array');
  }
  if (!Array.isArray(capture.chartHistory) || capture.chartHistory.length === 0) {
    throw new Error('chartHistory must be a non-empty array');
  }

  const latest = capture.latest;
  if (!latest || typeof latest !== 'object' || Array.isArray(latest)) {
    throw new Error('latest must be an object');
  }
  const latestTableRow = capture.table[0];
  if (latestTableRow?.date !== tradeDate) {
    throw new Error(
      `Latest table date ${latestTableRow?.date || 'missing'} `
      + `does not match ${tradeDate}`,
    );
  }

  const chartRow = capture.chartHistory.find(
    (record) => record?.date === tradeDate,
  );
  if (!chartRow) {
    throw new Error(`chartHistory has no record for ${tradeDate}`);
  }

  const latestMetrics = {
    financingBalance100M:
      requireFiniteNumber(latest, 'financingBalance100M', 'latest'),
    financingChange100M:
      requireFiniteNumber(latest, 'financingChange100M', 'latest'),
    marginMaintenanceRatePercent:
      requireFiniteNumber(latest, 'marginMaintenanceRatePercent', 'latest'),
    shortBalanceLots:
      requireFiniteNumber(latest, 'shortBalanceLots', 'latest'),
    shortChangeLots:
      requireFiniteNumber(latest, 'shortChangeLots', 'latest'),
    shortFinancingRatioPercent:
      requireFiniteNumber(latest, 'shortFinancingRatioPercent', 'latest'),
    financingBalanceLotsEstimated:
      requireFiniteNumber(latest, 'financingBalanceLotsEstimated', 'latest'),
    close: requireFiniteNumber(latest, 'close', 'latest'),
    changePercent: requireFiniteNumber(latest, 'changePercent', 'latest'),
    volume: requireFiniteNumber(latest, 'volume', 'latest'),
  };

  const chartMetrics = {
    financingBalance100M:
      requireFiniteNumber(chartRow, 'financingBalance100M', 'chartHistory'),
    marginMaintenanceRatePercent:
      requireFiniteNumber(
        chartRow,
        'marginMaintenanceRatePercent',
        'chartHistory',
      ),
    shortBalanceLots:
      requireFiniteNumber(chartRow, 'shortBalanceLots', 'chartHistory'),
    close: requireFiniteNumber(chartRow.taiex, 'close', 'chartHistory.taiex'),
  };

  const comparisons = [
    ['financingBalance100M', 0.011],
    ['marginMaintenanceRatePercent', 0.011],
    ['shortBalanceLots', 0],
    ['close', 0.011],
  ];
  for (const [field, tolerance] of comparisons) {
    if (!approximatelyEqual(
      latestMetrics[field],
      chartMetrics[field],
      tolerance,
    )) {
      throw new Error(
        `latest.${field} does not match chartHistory: `
        + `${latestMetrics[field]} !== ${chartMetrics[field]}`,
      );
    }
  }

  if (
    capture.metadata?.tableRowCount !== undefined
    && Number(capture.metadata.tableRowCount) !== capture.table.length
  ) {
    throw new Error('metadata.tableRowCount does not match table length');
  }
  if (
    capture.metadata?.chartRowCount !== undefined
    && Number(capture.metadata.chartRowCount) !== capture.chartHistory.length
  ) {
    throw new Error(
      'metadata.chartRowCount does not match chartHistory length',
    );
  }

  return {
    schemaVersion: 1,
    date: tradeDateCompact,
    tradeDate,
    observedAt: capture.scrapedAt || null,
    sourceType: 'manual_dom',
    sourceFile,
    metrics: {
      // Prefer the chart values because the rendered table rounds these fields.
      marginMaintenanceRatePercent:
        chartMetrics.marginMaintenanceRatePercent,
      financingBalance100M: chartMetrics.financingBalance100M,
      financingChange100M: latestMetrics.financingChange100M,
      financingBalanceLots: null,
      financingChangeLots: null,
      financingBalanceLotsEstimated:
        latestMetrics.financingBalanceLotsEstimated,
      shortBalanceLots: chartMetrics.shortBalanceLots,
      shortChangeLots: latestMetrics.shortChangeLots,
      shortFinancingRatioPercent:
        latestMetrics.shortFinancingRatioPercent,
    },
    market: {
      taiex: chartRow.taiex,
      changePercent: latestMetrics.changePercent,
      volume: latestMetrics.volume,
    },
    source: capture.source || null,
    quality: {
      captureMethod: 'browser_dom_manual',
      exactFields: [
        'shortBalanceLots',
        'shortChangeLots',
      ],
      roundedFields: [
        'financingBalance100M',
        'financingChange100M',
        'shortFinancingRatioPercent',
      ],
      estimatedFields: [
        'financingBalanceLotsEstimated',
      ],
      unavailableFields: [
        'financingBalanceLots',
        'financingChangeLots',
      ],
      notes: [
        'marginMaintenanceRatePercent uses the Highcharts value.',
        'financingBalanceLotsEstimated is derived from a ratio rounded to two decimals.',
        'This record must not be treated as an exact API raw/normalized pair.',
      ],
    },
    evidence: {
      tableRowCount: capture.table.length,
      chartRowCount: capture.chartHistory.length,
      latestTableDate: latestTableRow.date,
      matchedChartDate: chartRow.date,
    },
  };
}

function validateNormalizedRecord(record, expectedDate) {
  if (record?.schemaVersion !== 1 || record?.sourceType !== 'manual_dom') {
    throw new Error('Invalid manual normalized schema');
  }
  if (record.date !== expectedDate) {
    throw new Error(
      `Normalized record date ${record.date} does not match ${expectedDate}`,
    );
  }
  requireFiniteNumber(
    record.metrics,
    'marginMaintenanceRatePercent',
    'metrics',
  );
  requireFiniteNumber(record.metrics, 'financingBalance100M', 'metrics');
  requireFiniteNumber(record.metrics, 'shortBalanceLots', 'metrics');
}

function refreshManualFilesJson(outputRoot = DEFAULT_OUTPUT_ROOT) {
  const normalizedDir = path.join(outputRoot, 'normalized');
  const files = fs.existsSync(normalizedDir)
    ? fs.readdirSync(normalizedDir)
      .filter((filename) => OUTPUT_FILENAME_PATTERN.test(filename))
      .sort()
    : [];

  for (const filename of files) {
    const expectedDate = filename.match(OUTPUT_FILENAME_PATTERN)[1];
    const record = JSON.parse(
      fs.readFileSync(path.join(normalizedDir, filename), 'utf8'),
    );
    validateNormalizedRecord(record, expectedDate);
  }

  const indexedFiles = files.map((filename) => `normalized/${filename}`);
  writeAtomic(path.join(outputRoot, 'files.json'), indexedFiles);
  return indexedFiles;
}

function normalizeFile(inputFilename, options = {}) {
  const {
    outputRoot = DEFAULT_OUTPUT_ROOT,
    force = false,
    repositoryRoot = REPOSITORY_ROOT,
  } = options;
  const resolvedInput = path.resolve(inputFilename);
  const expectedDate = validateInputFilename(resolvedInput);
  const capture = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  const relativeSourceFile = path.relative(repositoryRoot, resolvedInput)
    .split(path.sep)
    .join('/');
  const normalized = normalizeDomCapture(capture, {
    expectedDate,
    sourceFile: relativeSourceFile,
  });

  const outputFilename =
    `${expectedDate}_wantgoo_margin_dom_normalized.json`;
  const outputFile = path.join(outputRoot, 'normalized', outputFilename);

  let status = 'saved';
  if (fs.existsSync(outputFile)) {
    const existing = fs.readFileSync(outputFile, 'utf8');
    const proposed = serialize(normalized);
    if (existing === proposed) {
      status = 'unchanged';
    } else if (!force) {
      throw new Error(
        `${outputFilename} already exists with different content. `
        + 'Review it and rerun with --force to replace it.',
      );
    }
  }

  if (status !== 'unchanged') {
    writeAtomic(outputFile, normalized);
  }
  validateNormalizedRecord(
    JSON.parse(fs.readFileSync(outputFile, 'utf8')),
    expectedDate,
  );
  const files = refreshManualFilesJson(outputRoot);

  return {
    status,
    date: expectedDate,
    outputFile,
    indexFile: path.join(outputRoot, 'files.json'),
    files,
  };
}

function getInputFilename(args) {
  return args.find((argument) => !argument.startsWith('--')) || '';
}

function main(args = process.argv.slice(2)) {
  const inputFilename = getInputFilename(args);
  if (!inputFilename) {
    throw new Error(
      'Usage: node scripts/normalize_wantgoo_margin_dom.js '
      + '<YYYYMMDD_wantgoo_margin_dom.json> [--force]',
    );
  }

  const result = normalizeFile(inputFilename, {
    force: args.includes('--force'),
  });
  console.log(
    `✅ Wantgoo manual DOM normalization ${result.status}: ${result.date}`,
  );
  console.log(`📁 ${result.outputFile}`);
  console.log(`📚 ${result.indexFile} (${result.files.length} files)`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ Failed to normalize Wantgoo DOM data: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  compactDate,
  normalizeDomCapture,
  normalizeFile,
  refreshManualFilesJson,
  validateInputFilename,
  validateNormalizedRecord,
};
