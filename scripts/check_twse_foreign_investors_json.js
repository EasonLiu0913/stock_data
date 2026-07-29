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
const DEFAULT_BACKUP_ROOT = path.join(
  ROOT,
  'reports',
  'twse_foreign_investors_invalid_backups',
);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_COOLDOWN_MS = 90000;
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

function toAbsolutePath(file) {
  return path.isAbsolute(file) ? path.resolve(file) : path.resolve(ROOT, file);
}

function timestampForPath(now = new Date()) {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z').replaceAll(/[-:]/g, '');
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

function writeTextAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryFile, content, 'utf8');
    fs.renameSync(temporaryFile, file);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function writeJsonAtomic(file, payload) {
  writeTextAtomic(file, `${JSON.stringify(payload, null, 2)}\n`);
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
    mode: 'scan_only',
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

function buildRepairDiff(invalidFile, replacementPayload) {
  const oldRow = invalidFile.row_context?.row;
  if (!Array.isArray(oldRow) || !Array.isArray(replacementPayload?.data)) return null;

  const codeIndex = foreignInvestors.CONFIG.codeIndex;
  const nameIndex = foreignInvestors.CONFIG.nameIndex;
  const stockCode = String(invalidFile.row_context?.stock_code || '').trim();
  let newRow = null;
  let matchedBy = null;

  if (stockCode) {
    newRow = replacementPayload.data.find((row) => (
      Array.isArray(row)
      && String(row[codeIndex] || '').trim() === stockCode
    ));
    if (newRow) matchedBy = 'stock_code';
  }

  if (!newRow && Number.isInteger(invalidFile.row_context?.row_index)) {
    const candidate = replacementPayload.data[invalidFile.row_context.row_index];
    if (Array.isArray(candidate)) {
      newRow = candidate;
      matchedBy = 'row_index';
    }
  }

  if (!Array.isArray(newRow)) {
    return {
      matched: false,
      stock_code: stockCode || null,
      stock_name: invalidFile.row_context?.stock_name || null,
      old_field_count: oldRow.length,
      new_field_count: null,
      changed_fields: [],
    };
  }

  const changedFields = [];
  const fieldCount = Math.max(oldRow.length, newRow.length);
  for (let index = 0; index < fieldCount; index += 1) {
    const oldValue = index < oldRow.length ? oldRow[index] : null;
    const newValue = index < newRow.length ? newRow[index] : null;
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    changedFields.push({
      column_index: index,
      field_name: replacementPayload.fields?.[index] ?? null,
      old_value: oldValue,
      new_value: newValue,
    });
  }

  return {
    matched: true,
    matched_by: matchedBy,
    stock_code: String(newRow[codeIndex] || '').trim() || stockCode || null,
    stock_name: String(newRow[nameIndex] || '').trim()
      || invalidFile.row_context?.stock_name
      || null,
    old_field_count: oldRow.length,
    new_field_count: newRow.length,
    changed_fields: changedFields,
  };
}

function assertFileInsideInputDirectory(file, inputDir) {
  const relative = path.relative(inputDir, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to repair file outside input directory: ${file}`);
  }
  return relative;
}

async function repairInvalidFiles(invalidFiles, options = {}) {
  const inputDir = path.resolve(options.inputDir || DEFAULT_INPUT_DIR);
  const backupDir = path.resolve(
    options.backupDir || path.join(DEFAULT_BACKUP_ROOT, timestampForPath()),
  );
  const minRows = options.minRows ?? foreignInvestors.CONFIG.minRows;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryCooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  const fetchDataset = options.fetchDataset || foreignInvestors.fetchDataset;
  const results = [];

  for (const invalid of invalidFiles) {
    const targetDate = invalid.target_date;
    const sourceFile = toAbsolutePath(invalid.file);

    if (!targetDate) {
      results.push({
        status: 'failed',
        file: invalid.file,
        target_date: null,
        original_error: invalid.error,
        error: 'Cannot repair because the target date could not be inferred',
      });
      continue;
    }

    try {
      if (!fs.existsSync(sourceFile)) {
        throw new Error(`Invalid source file no longer exists: ${sourceFile}`);
      }
      const relativeFile = assertFileInsideInputDirectory(sourceFile, inputDir);
      const replacementPayload = await fetchDataset(targetDate, {
        maxRetries,
        retryCooldownMs,
        minRows,
      });

      // fetchDataset already validates, but validate again before touching disk.
      foreignInvestors.validatePayload(replacementPayload, targetDate, { minRows });

      const originalContent = fs.readFileSync(sourceFile, 'utf8');
      const backupFile = path.join(backupDir, relativeFile);
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      fs.writeFileSync(backupFile, originalContent, 'utf8');

      try {
        writeJsonAtomic(sourceFile, replacementPayload);
        const validation = validateFile(sourceFile, { minRows });
        if (!validation.valid) {
          throw new Error(`Replacement validation failed: ${validation.error}`);
        }

        results.push({
          status: 'repaired',
          file: toProjectPath(sourceFile),
          target_date: targetDate,
          original_error: invalid.error,
          original_row_context: invalid.row_context || null,
          backup_file: toProjectPath(backupFile),
          replacement_payload_date: replacementPayload.date,
          replacement_row_count: replacementPayload.data.length,
          changes: buildRepairDiff(invalid, replacementPayload),
        });
      } catch (error) {
        writeTextAtomic(sourceFile, originalContent);
        throw error;
      }
    } catch (error) {
      results.push({
        status: 'failed',
        file: invalid.file,
        target_date: targetDate,
        original_error: invalid.error,
        error: error.message,
      });
    }
  }

  const repaired = results.filter((item) => item.status === 'repaired').length;
  const failed = results.length - repaired;
  if (repaired > 0) foreignInvestors.refreshFilesJson(inputDir);

  return {
    attempted: results.length,
    repaired,
    failed,
    backup_directory: repaired > 0 ? toProjectPath(backupDir) : null,
    results,
  };
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
    '  --repair              Re-fetch invalid dates and replace files only after validation',
    '  --backup-dir DIR      Backup root for invalid files before replacement',
    `  --max-retries N       TWSE request retry count (default: ${DEFAULT_MAX_RETRIES})`,
    `  --retry-cooldown MS   Retry cooldown base (default: ${DEFAULT_RETRY_COOLDOWN_MS})`,
    '  --fail-on-invalid     Exit with code 1 when invalid files remain after processing',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  const inputDir = path.resolve(getArg(argv, '--input-dir') || DEFAULT_INPUT_DIR);
  const outputFile = path.resolve(getArg(argv, '--output-file') || DEFAULT_OUTPUT_FILE);
  const minRows = getIntegerArg(
    argv,
    '--min-rows',
    foreignInvestors.CONFIG.minRows,
  );
  const shouldRepair = argv.includes('--repair');

  const initialReport = scanDirectory({
    inputDir,
    outputFile,
    minRows,
  });

  let report = initialReport;
  if (shouldRepair && initialReport.counts.invalid_files > 0) {
    console.log(`🔧 準備重新抓取 ${initialReport.counts.invalid_files} 份錯誤檔案`);
    const repair = await repairInvalidFiles(initialReport.invalid_files, {
      inputDir,
      backupDir: getArg(argv, '--backup-dir') || undefined,
      minRows,
      maxRetries: getIntegerArg(argv, '--max-retries', DEFAULT_MAX_RETRIES),
      retryCooldownMs: getIntegerArg(
        argv,
        '--retry-cooldown',
        DEFAULT_RETRY_COOLDOWN_MS,
      ),
    });
    const finalReport = scanDirectory({
      inputDir,
      outputFile,
      minRows,
    });

    report = {
      ...finalReport,
      schemaVersion: 2,
      generated_at: new Date().toISOString(),
      mode: 'scan_and_repair',
      counts_before_repair: initialReport.counts,
      counts_after_repair: finalReport.counts,
      initially_invalid_files: initialReport.invalid_files,
      repair,
      remaining_invalid_files: finalReport.invalid_files,
    };
    writeJsonAtomic(outputFile, report);
  } else if (shouldRepair) {
    report = {
      ...initialReport,
      schemaVersion: 2,
      mode: 'scan_and_repair',
      counts_before_repair: initialReport.counts,
      counts_after_repair: initialReport.counts,
      initially_invalid_files: [],
      repair: {
        attempted: 0,
        repaired: 0,
        failed: 0,
        backup_directory: null,
        results: [],
      },
      remaining_invalid_files: [],
    };
    writeJsonAtomic(outputFile, report);
  }

  console.log('✅ TWSE 外資法人 JSON 掃描完成');
  console.log(`📁 掃描目錄：${report.input_directory}`);
  console.log(`📄 掃描資料檔：${report.counts.scanned_data_files}`);
  console.log(`✅ 格式正確：${report.counts.valid_files}`);
  console.log(`❌ 格式錯誤：${report.counts.invalid_files}`);
  if (report.repair) {
    console.log(`🔧 已嘗試修復：${report.repair.attempted}`);
    console.log(`✅ 修復成功：${report.repair.repaired}`);
    console.log(`❌ 修復失敗：${report.repair.failed}`);
    if (report.repair.backup_directory) {
      console.log(`🗄️ 原始壞檔備份：${report.repair.backup_directory}`);
    }
  }
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
  main().catch((error) => {
    console.error(`❌ Failed to validate/repair TWSE foreign-investor JSON files: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildRepairDiff,
  DEFAULT_BACKUP_ROOT,
  DEFAULT_INPUT_DIR,
  DEFAULT_OUTPUT_FILE,
  inferTargetDate,
  listJsonFilesRecursive,
  repairInvalidFiles,
  scanDirectory,
  timestampForPath,
  validateFile,
  writeJsonAtomic,
  writeTextAtomic,
};
