#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FREEZE = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-development-sample-freeze-v1.json');
const OUTPUT = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json');
const AUDIT_ID = 'institutional-accumulation-official-disclosure-pit-coverage-audit-v1';
const EXPECTED_FREEZE_SHA = '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b';
const EXPECTED_IDENTITIES = 41;
const PROTECTED_STOCK = '2454';
const SAFE_CONFIDENCE = new Set(['official_timestamp', 'official_date', 'aggregate_snapshot_date', 'fallback_deadline']);
const CONFIDENCE_BUCKETS = ['official_timestamp', 'official_date', 'aggregate_snapshot_date', 'fallback_deadline', 'other_unknown'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function compactDate(value) {
  return String(value || '').replace(/-/g, '').slice(0, 8);
}

function t0EndIso(t0) {
  const d = String(t0 || '');
  if (!/^20\d{6}$/.test(d)) throw new Error(`Invalid T0: ${t0}`);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T23:59:59+08:00`;
}

function confidenceBucket(value) {
  return SAFE_CONFIDENCE.has(value) ? value : 'other_unknown';
}

function eventKnownDate(event) {
  return compactDate(event.published_at || event.published_date || event.fallback_known_date || null);
}

function eventAvailableByT0(event, t0) {
  const effective = compactDate(event.effective_trading_date);
  if (!/^20\d{6}$/.test(effective)) return false;
  return effective <= t0;
}

function artifactVersionState({ payload, lastCommitIso, t0 }) {
  const t0End = Date.parse(t0EndIso(t0));
  const generated = Date.parse(payload.generated_at || '');
  const committed = Date.parse(lastCommitIso || '');
  if (!Number.isFinite(generated) || !Number.isFinite(committed)) return 'version_unresolved';
  if (generated > t0End || committed > t0End) return 'current_rebuild_or_later_version';
  return 'durable_by_t0';
}

function gitLastCommitIso(relativePath, root = ROOT) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], { cwd: root, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function deriveDevelopmentIdentities(freeze) {
  if (freeze.content_sha256 !== EXPECTED_FREEZE_SHA) {
    throw new Error(`Freeze semantic SHA mismatch: expected ${EXPECTED_FREEZE_SHA}, got ${freeze.content_sha256}`);
  }
  if (freeze.protected_motivation_stock_excluded !== PROTECTED_STOCK) {
    throw new Error(`Protected stock contract mismatch: ${freeze.protected_motivation_stock_excluded}`);
  }
  const identities = (freeze.anchors || [])
    .filter(anchor => anchor?.eligibility?.eligible === true && anchor.partition === 'methodology_development')
    .map(anchor => ({ stock: String(anchor.stock), t0: String(anchor.t0) }))
    .sort((a, b) => a.t0.localeCompare(b.t0) || Number(a.stock) - Number(b.stock));
  if (identities.length !== EXPECTED_IDENTITIES) {
    throw new Error(`Expected ${EXPECTED_IDENTITIES} methodology-development identities, got ${identities.length}`);
  }
  if (identities.some(identity => identity.stock === PROTECTED_STOCK)) throw new Error('Protected 2454 leaked into development identities');
  return identities;
}

function inspectIdentity(identity, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const historyResolver = options.historyResolver || ((relative) => gitLastCommitIso(relative, root));
  const year = identity.t0.slice(0, 4);
  const relative = path.posix.join('data_fundamental_events', identity.stock, `${year}.json`);
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    return {
      ...identity,
      artifact: relative,
      artifact_state: 'missing_artifact',
      artifact_generated_at: null,
      artifact_last_commit_at: null,
      qualifying_event_count: 0,
      pit_safe_event_count: 0,
      unsafe_event_count: 0,
      safe_confidence_counts: Object.fromEntries(CONFIDENCE_BUCKETS.map(key => [key, 0])),
      primary_coverage: 'missing_artifact',
      events: [],
    };
  }

  const payload = readJson(file);
  const lastCommitIso = historyResolver(relative);
  const versionState = artifactVersionState({ payload, lastCommitIso, t0: identity.t0 });
  const candidates = (Array.isArray(payload.events) ? payload.events : []).filter(event => eventAvailableByT0(event, identity.t0));
  const events = candidates.map(event => {
    const bucket = confidenceBucket(event.availability_confidence);
    const hasRequiredTiming = Boolean(
      event.effective_trading_date &&
      (event.published_at || event.published_date || event.fallback_known_date) &&
      event.timestamp_precision &&
      event.availability_confidence
    );
    const confidenceAllowed = SAFE_CONFIDENCE.has(event.availability_confidence);
    const pitSafe = versionState === 'durable_by_t0' && hasRequiredTiming && confidenceAllowed;
    return {
      event_id: event.event_id || null,
      event_type: event.event_type || null,
      published_at: event.published_at || null,
      published_date: event.published_date || null,
      fallback_known_date: event.fallback_known_date || null,
      known_date: eventKnownDate(event) || null,
      timestamp_precision: event.timestamp_precision || null,
      availability_confidence: event.availability_confidence || null,
      effective_trading_date: event.effective_trading_date || null,
      source: event.source ? {
        provider: event.source.provider || null,
        dataset: event.source.dataset || null,
        role: event.source.role || null,
        sequence: event.source.sequence || null,
        source_file: event.source.source_file || null,
      } : null,
      provenance_bucket: bucket,
      artifact_version_state: versionState,
      pit_safe: pitSafe,
      unsafe_reason: pitSafe ? null : (
        versionState !== 'durable_by_t0' ? versionState :
        !hasRequiredTiming ? 'missing_required_timing_provenance' :
        !confidenceAllowed ? 'other_or_unknown_availability_confidence' : 'unknown'
      ),
    };
  });

  const safeEvents = events.filter(event => event.pit_safe);
  const safeCounts = Object.fromEntries(CONFIDENCE_BUCKETS.map(key => [key, safeEvents.filter(event => event.provenance_bucket === key).length]));
  let primaryCoverage = 'no_qualifying_event';
  if (candidates.length && !safeEvents.length) primaryCoverage = versionState === 'durable_by_t0' ? 'ambiguous_or_version_unsafe' : 'current_rebuild_or_later_version';
  if (safeEvents.length) {
    primaryCoverage = CONFIDENCE_BUCKETS.find(bucket => safeCounts[bucket] > 0) || 'other_unknown';
  }

  return {
    ...identity,
    artifact: relative,
    artifact_state: 'present',
    artifact_generated_at: payload.generated_at || null,
    artifact_as_of_date: payload.as_of_date || null,
    artifact_last_commit_at: lastCommitIso,
    artifact_version_state: versionState,
    qualifying_event_count: events.length,
    pit_safe_event_count: safeEvents.length,
    unsafe_event_count: events.length - safeEvents.length,
    safe_confidence_counts: safeCounts,
    primary_coverage: primaryCoverage,
    events,
  };
}

function summarize(rows) {
  const primaryKeys = [...CONFIDENCE_BUCKETS, 'current_rebuild_or_later_version', 'ambiguous_or_version_unsafe', 'missing_artifact', 'no_qualifying_event'];
  const primary = Object.fromEntries(primaryKeys.map(key => [key, rows.filter(row => row.primary_coverage === key).length]));
  const safeEventCounts = Object.fromEntries(CONFIDENCE_BUCKETS.map(key => [key, rows.reduce((sum, row) => sum + Number(row.safe_confidence_counts?.[key] || 0), 0)]));
  const identitySafe = rows.filter(row => row.pit_safe_event_count > 0).length;
  const currentOnly = rows.filter(row => row.primary_coverage === 'current_rebuild_or_later_version').length;
  const ambiguous = rows.filter(row => row.primary_coverage === 'ambiguous_or_version_unsafe').length;
  const missing = rows.filter(row => row.primary_coverage === 'missing_artifact').length;
  const noQualifying = rows.filter(row => row.primary_coverage === 'no_qualifying_event').length;
  return {
    identity_count: rows.length,
    identities_with_pit_safe_event: identitySafe,
    pit_safe_identity_rate: rows.length ? identitySafe / rows.length : 0,
    primary_coverage_counts: primary,
    pit_safe_event_counts_by_provenance: safeEventCounts,
    current_rebuild_or_later_version_identities: currentOnly,
    ambiguous_or_version_unsafe_identities: ambiguous,
    missing_artifact_identities: missing,
    no_qualifying_event_identities: noQualifying,
  };
}

function buildAudit(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const freeze = readJson(path.join(root, path.relative(ROOT, FREEZE)));
  const identities = deriveDevelopmentIdentities(freeze);
  const rows = identities.map(identity => inspectIdentity(identity, { root, historyResolver: options.historyResolver }));
  const summary = summarize(rows);
  const unresolved = summary.identity_count - summary.identities_with_pit_safe_event;
  const decision = unresolved === 0 ? 'official_disclosure_preregistration_ready' : 'official_disclosure_not_ready';
  return {
    audit_id: AUDIT_ID,
    generated_at: new Date().toISOString(),
    outcome_blind: true,
    frozen_development_identity_count: EXPECTED_IDENTITIES,
    protected_motivation_stock_excluded: PROTECTED_STOCK,
    immutable_freeze_semantic_sha256: EXPECTED_FREEZE_SHA,
    scope: {
      input: 'immutable Phase 2 freeze methodology_development identities only',
      evidence_root: 'data_fundamental_events/<stock>/<year>.json',
      current_rebuild_as_history_proof: false,
      generic_market_news_used: false,
      daily_gainers_news_used: false,
      analyst_revisions_used: false,
      outcome_values_read: false,
      holdout_outcomes_read: false,
      protected_2454_outcomes_read: false,
    },
    provenance_rule: {
      available_by_t0: 'effective_trading_date <= T0',
      durable_version: 'artifact generated_at and latest Git commit touching the current artifact version must both be no later than T0 end-of-day Asia/Taipei; otherwise current row/version is not treated as historical proof',
      date_only_and_fallback: 'uses existing effective_trading_date exactly as normalized by scripts/fundamental_event_timeline.js; audit never moves an event earlier',
      pit_safe_confidence: ['official_timestamp', 'official_date', 'aggregate_snapshot_date', 'fallback_deadline'],
      conservative_note: 'A later modification to an annual artifact makes the current row/version unsafe for earlier T0 unless the current version itself is durably proven by then; this may undercount true historical coverage but cannot create lookahead coverage.',
    },
    readiness_rule: 'ready only when all 41 frozen methodology-development identities have at least one PIT-safe qualifying event from durable repository evidence; otherwise not_ready. This conservative audit gate is not an outcome-optimized threshold.',
    summary,
    decision,
    unresolved_provenance_gaps: decision === 'official_disclosure_preregistration_ready' ? [] : [
      'At least one frozen development identity lacks PIT-safe qualifying official/fundamental-event evidence in durable repository history.',
      'Current rebuild or later artifact versions are not accepted as proof of the row/version visible at historical T0.',
      'Missing artifacts, no qualifying events, and ambiguous/unknown availability states remain excluded from PIT-safe coverage.',
    ],
    identities: rows,
  };
}

function main() {
  const audit = buildAudit();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(JSON.stringify({ decision: audit.decision, summary: audit.summary }, null, 2));
}

if (require.main === module) main();

module.exports = {
  AUDIT_ID,
  EXPECTED_FREEZE_SHA,
  EXPECTED_IDENTITIES,
  PROTECTED_STOCK,
  confidenceBucket,
  eventAvailableByT0,
  artifactVersionState,
  deriveDevelopmentIdentities,
  inspectIdentity,
  summarize,
  buildAudit,
};
