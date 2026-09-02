'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAIN_FORCE_NAMES = [
  '上市主力買超1日排行', '上市主力買超2日排行', '上市主力買超3日排行', '上市主力買超4日排行',
  '上市主力買超5日排行', '上市主力買超10日排行', '上市主力買超20日排行', '上市主力買超30日排行',
  '上市主力賣超1日排行', '上市主力賣超2日排行', '上市主力賣超3日排行', '上市主力賣超4日排行',
  '上市主力賣超5日排行', '上市主力賣超10日排行', '上市主力賣超20日排行', '上市主力賣超30日排行',
];

const FOREIGN_NAMES = [
  '上市外資買超1日排行', '上市外資買超2日排行', '上市外資買超3日排行', '上市外資買超4日排行',
  '上市外資買超5日排行', '上市外資買超10日排行', '上市外資買超20日排行', '上市外資買超30日排行',
  '上市外資賣超1日排行', '上市外資賣超2日排行', '上市外資賣超3日排行', '上市外資賣超4日排行',
  '上市外資賣超5日排行', '上市外資賣超10日排行', '上市外資賣超20日排行', '上市外資賣超30日排行',
];

const OTHER_NAMES = ['上市值增排行', '上市值縮排行', '上市量增排行', '上市量縮排行'];
const EXPECTED_NAMES = [...MAIN_FORCE_NAMES, ...FOREIGN_NAMES, ...OTHER_NAMES];
const MAX_SOURCE_AGE_DAYS = 14;

function compactUtcDate(anchorValue) {
  const anchor = new Date(anchorValue);
  if (Number.isNaN(anchor.getTime())) throw new Error(`Invalid FUBON_DATE_ANCHOR: ${anchorValue}`);
  return anchor.toISOString().slice(0, 10).replaceAll('-', '');
}

function parseCompactDate(value) {
  if (!/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10).replaceAll('-', '') !== value) return null;
  return date;
}

function expectedFileNames(sourceDate) {
  return EXPECTED_NAMES.map((name) => `fubon_${sourceDate}_${name}.csv`);
}

function csvLooksComplete(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 20) return false;
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.length >= 2 && lines[0].startsWith('Rank,');
}

function markerPath(dataDir, occurrenceDate) {
  return path.join(dataDir, '.crawl-rankings-complete', `${occurrenceDate}.json`);
}

function writeGithubOutput(values, env = process.env) {
  const outputPath = env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function inspectMarker(dataDir, occurrenceDate) {
  const file = markerPath(dataDir, occurrenceDate);
  if (!fs.existsSync(file)) return { complete: false, reason: 'marker_missing' };

  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { complete: false, reason: `marker_invalid_json:${error.message}` };
  }

  if (marker.schema_version !== 1 || marker.occurrence_date !== occurrenceDate || !/^\d{8}$/.test(marker.source_date || '')) {
    return { complete: false, reason: 'marker_contract_mismatch' };
  }

  const expected = expectedFileNames(marker.source_date);
  const missingOrInvalid = expected.filter((name) => !csvLooksComplete(path.join(dataDir, name)));
  if (missingOrInvalid.length > 0) {
    return { complete: false, reason: 'marker_outputs_incomplete', sourceDate: marker.source_date, missingOrInvalid };
  }

  return { complete: true, reason: 'marker_and_outputs_complete', sourceDate: marker.source_date };
}

function candidateDatesForName(dataDir, name) {
  if (!fs.existsSync(dataDir)) return new Set();
  const suffix = `_${name}.csv`;
  const dates = new Set();
  for (const entry of fs.readdirSync(dataDir)) {
    if (!entry.startsWith('fubon_') || !entry.endsWith(suffix)) continue;
    const match = entry.match(/^fubon_(\d{8})_/);
    if (!match) continue;
    if (csvLooksComplete(path.join(dataDir, entry))) dates.add(match[1]);
  }
  return dates;
}

function findLatestCompleteSourceDate(dataDir, occurrenceDate) {
  let common = null;
  for (const name of EXPECTED_NAMES) {
    const dates = candidateDatesForName(dataDir, name);
    common = common === null ? dates : new Set([...common].filter((date) => dates.has(date)));
    if (common.size === 0) return null;
  }

  const occurrence = parseCompactDate(occurrenceDate);
  return [...common]
    .filter((value) => {
      const source = parseCompactDate(value);
      if (!source || !occurrence || source > occurrence) return false;
      const ageDays = Math.floor((occurrence.getTime() - source.getTime()) / 86400000);
      return ageDays <= MAX_SOURCE_AGE_DAYS;
    })
    .sort()
    .at(-1) || null;
}

function finalize(dataDir, occurrenceDate) {
  const sourceDate = findLatestCompleteSourceDate(dataDir, occurrenceDate);
  if (!sourceDate) {
    throw new Error(`Cannot finalize Fubon ranking occurrence ${occurrenceDate}: no complete ${EXPECTED_NAMES.length}-file source-date set found within ${MAX_SOURCE_AGE_DAYS} days.`);
  }

  const expected = expectedFileNames(sourceDate);
  const file = markerPath(dataDir, occurrenceDate);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const marker = {
    schema_version: 1,
    occurrence_date: occurrenceDate,
    source_date: sourceDate,
    expected_file_count: expected.length,
    expected_files: expected,
    completed_at_utc: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return { sourceDate, file };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-ranking-completion-'));
  try {
    const occurrenceDate = '20260903';
    const sourceDate = '20260903';
    if (inspectMarker(root, occurrenceDate).complete) throw new Error('missing marker must not be complete');

    for (const name of expectedFileNames(sourceDate)) {
      fs.writeFileSync(path.join(root, name), 'Rank,Stock\n1,2330 台積電\n', 'utf8');
    }
    const result = finalize(root, occurrenceDate);
    if (result.sourceDate !== sourceDate) throw new Error('finalize selected wrong source date');
    if (!inspectMarker(root, occurrenceDate).complete) throw new Error('complete marker was not accepted');

    fs.unlinkSync(path.join(root, expectedFileNames(sourceDate)[0]));
    if (inspectMarker(root, occurrenceDate).complete) throw new Error('missing output must invalidate marker');

    console.log('check_fubon_ranking_completion self-test passed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const mode = process.argv[2] || 'check';
  if (mode === '--self-test' || mode === 'self-test') return selfTest();

  const anchor = String(process.env.FUBON_DATE_ANCHOR || '').trim();
  if (!anchor) throw new Error('FUBON_DATE_ANCHOR is required');
  const occurrenceDate = compactUtcDate(anchor);
  const dataDir = path.resolve(process.env.FUBON_DATA_DIR || path.join(__dirname, '../data_fubon'));

  if (mode === 'check') {
    const result = inspectMarker(dataDir, occurrenceDate);
    console.log(`Fubon ranking precheck: occurrence=${occurrenceDate}, complete=${result.complete}, reason=${result.reason}${result.sourceDate ? `, source_date=${result.sourceDate}` : ''}`);
    if (result.missingOrInvalid?.length) console.log(`Missing/invalid outputs: ${result.missingOrInvalid.join(', ')}`);
    writeGithubOutput({ complete: result.complete ? 'true' : 'false', source_date: result.sourceDate || '' });
    return;
  }

  if (mode === 'finalize') {
    const result = finalize(dataDir, occurrenceDate);
    console.log(`Fubon ranking completion marker written: occurrence=${occurrenceDate}, source_date=${result.sourceDate}, files=${EXPECTED_NAMES.length}`);
    writeGithubOutput({ complete: 'true', source_date: result.sourceDate });
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = { EXPECTED_NAMES, expectedFileNames, inspectMarker, findLatestCompleteSourceDate, finalize, csvLooksComplete };
