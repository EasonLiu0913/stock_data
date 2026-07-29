#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const foreignInvestors = require('./crawl_twse_foreign_investors');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT_DIR = path.join(ROOT, 'data_twse_foreign_investors');
const DEFAULT_OUTPUT_FILE = path.join(
  ROOT,
  'reports',
  'twse_foreign_investors_validation_report.json',
);
const METADATA_FILENAMES = new Set([
  'files.json',
  'manifest.json',
]);

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getIntegerArg(args, flag, fallback) {
  const value = getArg(args, flag);
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${flag}: ${value}`);
  }
  return number;
}

function toProjectPath(file) {
  const relative = path.relative(ROOT, file);
  return relative && !relative.startsWith('..')
    ? relative.replaceAll(path.sep, '/')
    : path.resolve(file).replaceAll(path.sep, '/');
}

function listJsonFilesRecursive(directory) {
  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function inferTargetDate(file, payload) {
  const filenameMatch = path.basename(file).match(/(?:^|\D)(20\d{6})(?:\D|$)/);
  if (filenameMatch) return filenameMatch[1];
  const payloadDate = String(payload?.date || '').trim();
  return /^20\d{6}$/.test(payloadDate) ? payloadDate : '';
}

function classifyError(error) {
  if (error instanceof SyntaxError) return 'json_parse_error';
  if (error.code === 'MISSING_TARGET_DATE') return 'missing_target_date';
  return 'validation_error';
}

function extractRowContext(payload, message) {
  const match = String(message || '').match(/(?:row|index)\s+(\d+)/i);
  if (!match) return null;

  const rowIndex = Number(match[1]);
  const row = Array.isArray(payload?.data) ? payload.data[rowIndex] : null;
  if (!Array.isArray(row)) {
    return {
      row_index: rowIndex,
      row_found: false,
    };
  }

  return {
    row_index: rowIndex,
    row_found: true,
    field_count: row.length,
    expected_field_count: foreignInvestors.CONFIG.fieldCount,
    stock_code: String(row[foreignInvestors.CONFIG.codeIndex] || '').trim() || null,
    stock_name: String(row[foreignInvestors.CONFIG.nameIndex] || '').trim() || null,
    row,
  };
}

function validateFile(file, options = {}) {
  const minRows = options.minRows ?? foreignInvestors.CONFIG.minRows;
  let payload = null;
  let targetDate = '';

  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    targetDate = inferTargetDate(file, payload);
    if (!targetDate) {
      const error = new Error('Cannot infer YYYYMMDD from filename or payload.date');
      error.code = 'MISSING_TARGET_DATE';
      throw error;
    }
    foreignInvestors.validatePayload(payload, targetDate, { minRows });
    return {
      valid: true,
      file: toProjectPath(file),
      target_date: targetDate,
      payload_date: payload?.date || null,
      row_count: Array.isArray(payload?.data) ? payload.data.length : null,
    };
  } catch (error) {
    return {
      valid: false,
      file: toProjectPath(file),
      target_date: targetDate || inferTargetDate(file, payload) || null,
      payload_date: payload?.date || null,
      error_type: classifyError(error),
      error: error.message,
      row_context: extractRowContext(payload, error.message),
    };
  }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryFile, file);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function scanDirectory(options = {}) {
  const inputDir = path.resolve(options.inputDir || DEFAULT_INPUT_DIR);
  const outputFile = path.resolve(options.outputFile || DEFAULT_OUTPUT_FILE);
  const minRows = options.minRows ?? foreignInvestors.CONFIG.minRows;

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }
  if (!fs.statSync(inputDir).isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const outputAbsolute = path.resolve(outputFile);
  const allJsonFiles = listJsonFilesRecursive(inputDir);
  const skippedFiles = [];
  const dataFiles = allJsonFiles.filter((file) => {
    const basename = path.basename(file);
    const shouldSkip = (
      METADATA_FILENAMES.has(basename)
      || path.resolve(file) === outputAbsolute
    );
    if (shouldSkip) skippedFiles.push(toProjectPath(file));
    return !shouldSkip;
  });

  const results = dataFiles.map((file) => validateFile(file, { minRows }));
  const invalidFiles = results.filter((result) => !result.valid);

  const report = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    input_directory: toProjectPath(inputDir),
    output_file: toProjectPath(outputFile),
    validator: {
      endpoint_id: foreignInvestors.CONFIG.endpointId,
      expected_field_count: foreignInvestors.CONFIG.fieldCount,
      minimum_rows: minRows,
      numeric_triples: foreignInvestors.CONFIG.numericTriples,
      required_groups: foreignInvestors.CONFIG.requiredGroups,
    },
    counts: {
      discovered_json_files: allJsonFiles.length,
      scanned_data_files: dataFiles.length,
      valid_files: results.length - invalidFiles.length,
      invalid_files: invalidFiles.length,
      skipped_metadata_files: skippedFiles.length,
    },
    skipped_files: skippedFiles,
    invalid_files: invalidFiles,
  };

  writeJsonAtomic(outputFile, report);
  return report;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/check_twse_foreign_investors_json.js [options]',
    '',
    'Options:',
    '  --input-dir DIR       Directory to scan recursively',
    '  --output-file FILE    JSON report output path',
    `  --min-rows N          Minimum data rows (default: ${foreignInvestors.CONFIG.minRows})`,
    '  --fail-on-invalid     Exit with code 1 when invalid files are found',
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  const report = scanDirectory({
    inputDir: getArg(argv, '--input-dir') || DEFAULT_INPUT_DIR,
    outputFile: getArg(argv, '--output-file') || DEFAULT_OUTPUT_FILE,
    minRows: getIntegerArg(
      argv,
      '--min-rows',
      foreignInvestors.CONFIG.minRows,
    ),
  });

  console.log('✅ TWSE 外資法人 JSON 掃描完成');
  console.log(`📁 掃描目錄：${report.input_directory}`);
  console.log(`📄 掃描資料檔：${report.counts.scanned_data_files}`);
  console.log(`✅ 格式正確：${report.counts.valid_files}`);
  console.log(`❌ 格式錯誤：${report.counts.invalid_files}`);
  console.log(`🧾 報告位置：${report.output_file}`);

  for (const invalid of report.invalid_files) {
    const rowText = invalid.row_context?.row_index != null
      ? ` row=${invalid.row_context.row_index}`
      : '';
    console.error(`- ${invalid.file}:${rowText} ${invalid.error}`);
  }

  if (argv.includes('--fail-on-invalid') && report.counts.invalid_files > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ Failed to validate TWSE foreign-investor JSON files: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_INPUT_DIR,
  DEFAULT_OUTPUT_FILE,
  inferTargetDate,
  listJsonFilesRecursive,
  scanDirectory,
  validateFile,
  writeJsonAtomic,
};
