'use strict';

const fs = require('fs');
const path = require('path');

const POLICY_VERSION = 'histock-broker-source-status-policy-v1';
const SHRUNKEN_RATIO = 0.85;
const MIN_SHRINK_BYTES = 8000;

function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function deriveReferenceResponseBytes(stockRoot) {
  const dailyDir = path.join(stockRoot, 'daily');
  if (!fs.existsSync(dailyDir) || !fs.statSync(dailyDir).isDirectory()) return null;
  const bytes = [];
  for (const name of fs.readdirSync(dailyDir).filter((x) => /^\d{8}\.json$/.test(x))) {
    try {
      const payload = JSON.parse(fs.readFileSync(path.join(dailyDir, name), 'utf8'));
      if (Number(payload.record_count) > 0 && Number.isFinite(Number(payload.response_bytes))) bytes.push(Number(payload.response_bytes));
    } catch (_) {}
  }
  return median(bytes);
}

function findExplicitSourceEmptySignal(text) {
  const match = String(text || '').match(/查無(?:符合條件的)?資料|沒有(?:符合條件的)?資料|無相關資料|查詢無結果|沒有交易資料/);
  return match ? match[0] : null;
}

function classifyNoRecordResponse({ text, diagnostics }) {
  const signal = findExplicitSourceEmptySignal(text);
  if (signal) {
    return {
      outcome: 'source_empty',
      retryable: false,
      terminal_for_date: true,
      source_empty_evidence: {
        confirmed: true,
        rule: 'explicit_source_text_v1',
        signal,
      },
    };
  }
  return {
    outcome: 'suspected_degraded_response',
    retryable: true,
    terminal_for_date: false,
    source_empty_evidence: {
      confirmed: false,
      rule: 'no_records_without_explicit_empty_signal_v1',
      diagnostics: diagnostics || null,
    },
  };
}

function assessPersistedStatus(payload, { referenceResponseBytes = null } = {}) {
  const outcome = payload?.outcome || null;
  if (outcome === 'success') return { terminal: true, retryable: false, classification: 'success' };
  if (outcome === 'permanent_error') return { terminal: true, retryable: false, classification: 'permanent_error' };
  if (outcome === 'transient_error' || outcome === 'suspected_degraded_response') {
    return { terminal: false, retryable: true, classification: outcome };
  }
  if (outcome !== 'source_empty') return { terminal: false, retryable: true, classification: 'unknown_or_missing' };

  if (payload?.source_empty_evidence?.confirmed === true) {
    return {
      terminal: true,
      retryable: false,
      classification: 'confirmed_source_empty',
      reason: payload.source_empty_evidence.rule || 'explicit_source_empty_evidence',
    };
  }

  const d = payload?.diagnostics || {};
  const responseBytes = Number(d.response_bytes);
  const baseline = Number(referenceResponseBytes);
  const http200 = Number(d.http_status) === 200;
  const pageContextVisible = d.date_visible === true && d.broker_keywords_visible === true;
  const headerOnly = Number.isFinite(Number(d.table_rows)) && Number(d.table_rows) <= 1;
  const materiallyShrunken = Number.isFinite(responseBytes)
    && Number.isFinite(baseline)
    && baseline > 0
    && responseBytes <= baseline * SHRUNKEN_RATIO
    && baseline - responseBytes >= MIN_SHRINK_BYTES;

  if (http200 && pageContextVisible && headerOnly && materiallyShrunken) {
    return {
      terminal: false,
      retryable: true,
      classification: 'ambiguous_degraded_source_empty',
      reason: 'http_200_header_only_materially_shrunken_vs_valid_peer_pages',
      diagnostics: {
        response_bytes: responseBytes,
        reference_response_bytes: baseline,
        response_ratio: Number((responseBytes / baseline).toFixed(4)),
        table_rows: Number(d.table_rows),
        date_visible: d.date_visible,
        broker_keywords_visible: d.broker_keywords_visible,
      },
    };
  }

  return {
    terminal: true,
    retryable: false,
    classification: 'legacy_source_empty_unverified_but_not_degraded_signature',
    reason: 'legacy_checkpoint_retained_terminal_until_specific_degradation_evidence_exists',
  };
}

module.exports = {
  POLICY_VERSION,
  SHRUNKEN_RATIO,
  MIN_SHRINK_BYTES,
  median,
  deriveReferenceResponseBytes,
  findExplicitSourceEmptySignal,
  classifyNoRecordResponse,
  assessPersistedStatus,
};
