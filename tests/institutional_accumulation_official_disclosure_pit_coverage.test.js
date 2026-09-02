'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  EXPECTED_FREEZE_SHA,
  artifactVersionState,
  deriveDevelopmentIdentities,
  eventAvailableByT0,
  inspectIdentity,
  summarize,
} = require('../scripts/audit_institutional_accumulation_official_disclosure_pit_coverage');

function makeFreeze() {
  const anchors = [];
  for (let i = 0; i < 41; i += 1) {
    anchors.push({ stock: String(1000 + i), t0: '20260814', partition: 'methodology_development', eligibility: { eligible: true } });
  }
  anchors.push({ stock: '2454', t0: '20260814', partition: 'stock_holdout', eligibility: { eligible: true } });
  anchors.push({ stock: '9999', t0: '20260814', partition: 'methodology_development', eligibility: { eligible: false } });
  return { content_sha256: EXPECTED_FREEZE_SHA, protected_motivation_stock_excluded: '2454', anchors };
}

test('derives exactly 41 development identities and keeps protected 2454 excluded', () => {
  const identities = deriveDevelopmentIdentities(makeFreeze());
  assert.equal(identities.length, 41);
  assert.equal(identities.some(row => row.stock === '2454'), false);
});

test('availability respects effective trading date without moving fallback evidence earlier', () => {
  assert.equal(eventAvailableByT0({ effective_trading_date: '2026-08-14' }, '20260814'), true);
  assert.equal(eventAvailableByT0({ effective_trading_date: '2026-08-17' }, '20260814'), false);
  assert.equal(eventAvailableByT0({ effective_trading_date: null }, '20260814'), false);
});

test('later-generated or later-committed current versions are not historical proof', () => {
  assert.equal(artifactVersionState({ payload: { generated_at: '2026-08-13T20:00:00Z' }, lastCommitIso: '2026-08-14T07:00:00Z', t0: '20260814' }), 'durable_by_t0');
  assert.equal(artifactVersionState({ payload: { generated_at: '2026-08-15T00:00:00Z' }, lastCommitIso: '2026-08-15T00:01:00Z', t0: '20260814' }), 'current_rebuild_or_later_version');
  assert.equal(artifactVersionState({ payload: { generated_at: '2026-08-13T20:00:00Z' }, lastCommitIso: '2026-08-15T00:01:00Z', t0: '20260814' }), 'current_rebuild_or_later_version');
});

test('missing artifact is explicit and never zero-filled into safe coverage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'official-pit-audit-'));
  const row = inspectIdentity({ stock: '1102', t0: '20260814' }, { root, historyResolver: () => null });
  assert.equal(row.primary_coverage, 'missing_artifact');
  assert.equal(row.pit_safe_event_count, 0);
});

test('durable official timestamp event is PIT-safe while unknown confidence is not', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'official-pit-audit-'));
  const dir = path.join(root, 'data_fundamental_events', '1101');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026.json'), JSON.stringify({
    generated_at: '2026-08-13T10:00:00Z',
    as_of_date: '2026-08-14',
    events: [
      {
        event_id: 'safe', event_type: 'material_information', published_at: '2026-08-14T08:00:00+08:00',
        published_date: '2026-08-14', timestamp_precision: 'second', availability_confidence: 'official_timestamp',
        effective_trading_date: '2026-08-14', source: { provider: 'TWSE', dataset: 't187ap04_L', role: 'official_material_information' },
      },
      {
        event_id: 'unknown', event_type: 'material_information', published_date: '2026-08-13',
        timestamp_precision: 'date', availability_confidence: 'unknown', effective_trading_date: '2026-08-14', source: { provider: 'TWSE' },
      },
    ],
  }));
  const row = inspectIdentity({ stock: '1101', t0: '20260814' }, {
    root,
    historyResolver: () => '2026-08-13T12:00:00Z',
  });
  assert.equal(row.pit_safe_event_count, 1);
  assert.equal(row.safe_confidence_counts.official_timestamp, 1);
  assert.equal(row.unsafe_event_count, 1);
  assert.equal(row.primary_coverage, 'official_timestamp');
});

test('summary counts missing/current-only/safe identities mechanically', () => {
  const rows = [
    { primary_coverage: 'official_date', pit_safe_event_count: 1, safe_confidence_counts: { official_timestamp: 0, official_date: 1, aggregate_snapshot_date: 0, fallback_deadline: 0, other_unknown: 0 } },
    { primary_coverage: 'current_rebuild_or_later_version', pit_safe_event_count: 0, safe_confidence_counts: {} },
    { primary_coverage: 'missing_artifact', pit_safe_event_count: 0, safe_confidence_counts: {} },
  ];
  const summary = summarize(rows);
  assert.equal(summary.identity_count, 3);
  assert.equal(summary.identities_with_pit_safe_event, 1);
  assert.equal(summary.current_rebuild_or_later_version_identities, 1);
  assert.equal(summary.missing_artifact_identities, 1);
  assert.equal(summary.pit_safe_event_counts_by_provenance.official_date, 1);
});
