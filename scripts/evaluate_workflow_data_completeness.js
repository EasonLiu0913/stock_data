#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const STATUS = Object.freeze({
  COMPLETE: 'complete',
  DATA_NOT_UPDATED: 'data_not_updated',
  PARTIAL_DATA: 'partial_data',
  SERVER_UNAVAILABLE: 'server_unavailable',
  FORMAT_ERROR: 'format_error',
  CRAWL_FAILED: 'crawl_failed',
  UNCONFIRMED: 'unconfirmed',
});

function normalizeDate(value) {
  const text = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(text) ? text : '';
}

function integerOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function classifyError(message) {
  const text = String(message || '');
  if (!text) return '';
  if (/429|\b5\d\d\b|timeout|timed out|econnreset|econnrefused|socket hang up|network error|fetch failed|could not resolve|server unavailable|伺服器.*沒有回應/i.test(text)) {
    return STATUS.SERVER_UNAVAILABLE;
  }
  if (/invalid json|unexpected token|parse error|missing header|schema|欄位.*(?:缺少|異常)|格式.*(?:錯誤|異常)|csv.*(?:invalid|missing)/i.test(text)) {
    return STATUS.FORMAT_ERROR;
  }
  return '';
}

function evaluate(input = {}) {
  const expectedDate = normalizeDate(input.expected_date);
  const actualDate = normalizeDate(input.actual_date);
  const expectedCount = integerOrNull(input.expected_count);
  const successCount = integerOrNull(input.success_count);
  const explicitMissing = integerOrNull(input.missing_count);
  const crawlOutcome = String(input.crawl_outcome || '').toLowerCase();
  const sourceStatus = String(input.source_status || '').toLowerCase();
  const sourceError = String(input.source_error || '');
  const validationComplete = input.validation_complete === true;

  const missingCount = explicitMissing !== null
    ? explicitMissing
    : expectedCount !== null && successCount !== null
      ? Math.max(0, expectedCount - successCount)
      : null;

  let status = STATUS.UNCONFIRMED;
  let reason = '尚未取得足夠證據確認資料完整。';

  const errorClass = classifyError(sourceError);
  if (errorClass === STATUS.SERVER_UNAVAILABLE) {
    status = STATUS.SERVER_UNAVAILABLE;
    reason = `資料來源或網路沒有正常回應：${sourceError}`;
  } else if (errorClass === STATUS.FORMAT_ERROR) {
    status = STATUS.FORMAT_ERROR;
    reason = `來源有回應，但資料格式驗證失敗：${sourceError}`;
  } else if (expectedDate && actualDate && expectedDate !== actualDate) {
    status = STATUS.DATA_NOT_UPDATED;
    reason = `預期日期 ${expectedDate}，實際資料日期 ${actualDate}，日期不符，當天資料尚未更新。`;
  } else if (['data_not_updated', 'not_ready', 'no_data'].includes(sourceStatus)) {
    status = STATUS.DATA_NOT_UPDATED;
    reason = sourceError || '官方資料尚未更新或尚未提供目標日期資料。';
  } else if (missingCount !== null && missingCount > 0) {
    status = STATUS.PARTIAL_DATA;
    reason = `${missingCount} 筆尚未更新 / 總數 ${expectedCount ?? '未知'}。`;
  } else if (crawlOutcome === 'failure' || sourceStatus === 'failed') {
    status = STATUS.CRAWL_FAILED;
    reason = sourceError || '資料擷取流程失敗，但未符合日期、部分資料、伺服器或格式錯誤分類。';
  } else if (validationComplete
    && (!expectedDate || !actualDate || expectedDate === actualDate)
    && (expectedCount === null || successCount === expectedCount)
    && crawlOutcome !== 'failure') {
    status = STATUS.COMPLETE;
    reason = '日期與資料完整性驗證均通過。';
  }

  const complete = status === STATUS.COMPLETE;
  return {
    schema_version: 1,
    workflow: String(input.workflow || ''),
    expected_date: expectedDate || null,
    actual_date: actualDate || null,
    expected_count: expectedCount,
    success_count: successCount,
    missing_count: missingCount,
    crawl_outcome: crawlOutcome || null,
    source_status: sourceStatus || null,
    status,
    complete,
    label: {
      [STATUS.COMPLETE]: '完整成功',
      [STATUS.DATA_NOT_UPDATED]: '資料尚未更新',
      [STATUS.PARTIAL_DATA]: '部分資料尚未更新',
      [STATUS.SERVER_UNAVAILABLE]: '伺服器沒有回應',
      [STATUS.FORMAT_ERROR]: '資料格式異常',
      [STATUS.CRAWL_FAILED]: '其他擷取失敗',
      [STATUS.UNCONFIRMED]: '無法確認資料完整性',
    }[status],
    reason,
    details: input.details && typeof input.details === 'object' ? input.details : {},
  };
}

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

function main(argv = process.argv.slice(2)) {
  const inputPath = getArg(argv, '--input');
  const outputPath = getArg(argv, '--output');
  if (!inputPath) throw new Error('--input is required');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = evaluate(input);
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) fs.writeFileSync(outputPath, text, 'utf8');
  else process.stdout.write(text);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to evaluate workflow data completeness: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { STATUS, normalizeDate, classifyError, evaluate, main };
