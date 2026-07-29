#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check_twse_foreign_investors_json.js');
const TEST = path.join(ROOT, 'tests', 'check_twse_foreign_investors_json.test.js');

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

function patchScript(content) {
  if (!content.includes('function buildRepairDiff(')) {
    content = replaceOnce(
      content,
      'function assertFileInsideInputDirectory(file, inputDir) {',
      `function buildRepairDiff(invalidFile, replacementPayload) {
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

function assertFileInsideInputDirectory(file, inputDir) {`,
      'insert buildRepairDiff',
    );
  }

  if (!content.includes('changes: buildRepairDiff(invalid, replacementPayload),')) {
    content = replaceOnce(
      content,
      '          replacement_row_count: replacementPayload.data.length,\n',
      '          replacement_row_count: replacementPayload.data.length,\n          changes: buildRepairDiff(invalid, replacementPayload),\n',
      'add repair field changes',
    );
  }

  if (!content.includes('  buildRepairDiff,\n')) {
    content = replaceOnce(
      content,
      'module.exports = {\n',
      'module.exports = {\n  buildRepairDiff,\n',
      'export buildRepairDiff',
    );
  }

  return content;
}

function patchTest(content) {
  if (!content.includes('assert.deepEqual(changedColumns, [6, 7, 8, 9, 10, 11]);')) {
    content = replaceOnce(
      content,
      `    assert.equal(repair.repaired, 1);
    assert.equal(repair.failed, 0);

    const repairedPayload = JSON.parse(fs.readFileSync(dataFile, 'utf8'));`,
      `    assert.equal(repair.repaired, 1);
    assert.equal(repair.failed, 0);

    const repairedResult = repair.results[0];
    assert.equal(repairedResult.changes.matched, true);
    assert.equal(repairedResult.changes.matched_by, 'stock_code');
    assert.equal(repairedResult.changes.stock_code, '9914');
    assert.equal(repairedResult.changes.stock_name, '美利達');
    assert.equal(repairedResult.changes.old_field_count, 6);
    assert.equal(repairedResult.changes.new_field_count, 12);
    const changedColumns = repairedResult.changes.changed_fields
      .map((field) => field.column_index);
    assert.deepEqual(changedColumns, [6, 7, 8, 9, 10, 11]);
    assert.equal(repairedResult.changes.changed_fields[0].old_value, null);
    assert.equal(repairedResult.changes.changed_fields[0].new_value, '0');

    const repairedPayload = JSON.parse(fs.readFileSync(dataFile, 'utf8'));`,
      'add field diff assertions',
    );
  }
  return content;
}

const scriptBefore = fs.readFileSync(SCRIPT, 'utf8');
const testBefore = fs.readFileSync(TEST, 'utf8');
const scriptAfter = patchScript(scriptBefore);
const testAfter = patchTest(testBefore);

if (scriptAfter !== scriptBefore) fs.writeFileSync(SCRIPT, scriptAfter, 'utf8');
if (testAfter !== testBefore) fs.writeFileSync(TEST, testAfter, 'utf8');

console.log(JSON.stringify({
  script_changed: scriptAfter !== scriptBefore,
  test_changed: testAfter !== testBefore,
}));
