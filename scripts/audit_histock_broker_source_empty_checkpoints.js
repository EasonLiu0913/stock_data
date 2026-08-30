#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload } = require('./lib/histock_broker_quality');
const { POLICY_VERSION, deriveReferenceResponseBytes, assessPersistedStatus } = require('./lib/histock_broker_status_policy');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const brokerRoot = arg('broker-root', path.join('data_research', 'institutional-flow', 'histock'));
const output = arg('output', '');

function dailyIsValid(stockRoot, stock, date) {
  const file = path.join(stockRoot, 'daily', `${date.replaceAll('-', '')}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    return validateDailyPayload(JSON.parse(fs.readFileSync(file, 'utf8')), { stock, date }).valid;
  } catch (_) {
    return false;
  }
}

const rows = [];
let exactStatuses = 0;
let sourceEmptyStatuses = 0;
let supersededBySuccess = 0;
let unsafeAmbiguous = 0;
let confirmedTerminal = 0;
let legacyTerminalUnverified = 0;

if (fs.existsSync(brokerRoot)) {
  for (const stock of fs.readdirSync(brokerRoot).filter((x) => /^\d{4}$/.test(x)).sort()) {
    const stockRoot = path.join(brokerRoot, stock);
    const statusDir = path.join(stockRoot, 'batch-status');
    if (!fs.existsSync(statusDir) || !fs.statSync(statusDir).isDirectory()) continue;
    const referenceResponseBytes = deriveReferenceResponseBytes(stockRoot);
    for (const name of fs.readdirSync(statusDir).filter((x) => /^exact-source-date-\d{8}\.json$/.test(x)).sort()) {
      exactStatuses += 1;
      const file = path.join(statusDir, name);
      let payload;
      try { payload = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      if (payload.outcome !== 'source_empty') continue;
      sourceEmptyStatuses += 1;
      const date = String(payload.date || '');
      if (dailyIsValid(stockRoot, stock, date)) {
        supersededBySuccess += 1;
        continue;
      }
      const assessment = assessPersistedStatus(payload, { referenceResponseBytes });
      if (assessment.classification === 'ambiguous_degraded_source_empty') unsafeAmbiguous += 1;
      else if (assessment.classification === 'confirmed_source_empty') confirmedTerminal += 1;
      else if (assessment.classification === 'legacy_source_empty_unverified_but_not_degraded_signature') legacyTerminalUnverified += 1;
      rows.push({
        stock,
        date,
        file,
        run_id: payload.run_id || null,
        updated_at: payload.updated_at || null,
        reference_response_bytes: referenceResponseBytes,
        diagnostics: payload.diagnostics || null,
        assessment,
      });
    }
  }
}

const report = {
  schema_version: 1,
  methodology: 'institutional-withdrawal-validation-broker-source-empty-audit-v1',
  generated_without_outcomes: true,
  policy_version: POLICY_VERSION,
  broker_root: brokerRoot,
  counts: {
    exact_statuses: exactStatuses,
    source_empty_statuses: sourceEmptyStatuses,
    source_empty_superseded_by_valid_daily: supersededBySuccess,
    unsafe_ambiguous_source_empty: unsafeAmbiguous,
    confirmed_terminal_source_empty: confirmedTerminal,
    legacy_terminal_source_empty_unverified: legacyTerminalUnverified,
  },
  unsafe_requeue: rows.filter((r) => r.assessment.retryable === true),
  retained_terminal: rows.filter((r) => r.assessment.terminal === true),
  guardrails: [
    'No validation lifecycle outcomes, future returns, drawdowns, or validation metrics are read.',
    'Historical checkpoint files are preserved as audit evidence and are not deleted by this audit.',
    'A later valid daily payload supersedes an older ambiguous negative for the same stock/date.',
  ],
  generated_at: new Date().toISOString(),
};

if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
