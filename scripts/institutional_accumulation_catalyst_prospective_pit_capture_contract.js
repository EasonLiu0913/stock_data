'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT_ID = 'institutional-accumulation-catalyst-prospective-pit-capture-contract-v1';
const SCHEMA_VERSION = 1;
const PIT_SAFETY_STATE = 'prospective_capture_safe_from_collection_time_only';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function requireIsoTimestamp(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${field} must be an explicit UTC ISO-8601 timestamp`);
  }
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} is not a valid timestamp`);
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${field} is required`);
  return value;
}

function sanitizeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function buildProspectiveSnapshot(input) {
  const collectedAt = requireIsoTimestamp(input.collected_at, 'collected_at');
  const raw = Buffer.isBuffer(input.raw_response)
    ? input.raw_response
    : Buffer.from(requireString(input.raw_response, 'raw_response'), 'utf8');
  const responseSha256 = sha256(raw);
  const sourceReportedAt = input.source_reported_at == null
    ? null
    : requireIsoTimestamp(input.source_reported_at, 'source_reported_at');

  const snapshotIdentityMaterial = Buffer.from(JSON.stringify({
    contract_id: CONTRACT_ID,
    source_provider: requireString(input.source_provider, 'source_provider'),
    source_interface: requireString(input.source_interface, 'source_interface'),
    source_request_key: requireString(input.source_request_key, 'source_request_key'),
    collected_at: collectedAt,
    response_sha256: responseSha256,
    parser_version: requireString(input.parser_version, 'parser_version'),
    methodology_identity: requireString(input.methodology_identity, 'methodology_identity'),
  }));
  const immutableSnapshotId = sha256(snapshotIdentityMaterial);

  return {
    schema_version: SCHEMA_VERSION,
    contract_id: CONTRACT_ID,
    immutable_snapshot_id: immutableSnapshotId,
    source_provider: input.source_provider,
    source_interface: input.source_interface,
    source_request_key: input.source_request_key,
    collected_at: collectedAt,
    source_reported_at: sourceReportedAt,
    source_timestamp_precision: input.source_timestamp_precision || (sourceReportedAt ? 'source_reported_timestamp' : 'collection_timestamp_only'),
    parser_version: input.parser_version,
    methodology_identity: input.methodology_identity,
    response_sha256: responseSha256,
    response_bytes: raw.length,
    raw_response_encoding: 'base64',
    raw_response_base64: raw.toString('base64'),
    pit_known_at: collectedAt,
    pit_known_at_basis: 'immutable_version_observed_at_collection_time',
    pit_value_version_safety: PIT_SAFETY_STATE,
    historical_back_imputation_allowed: false,
    source_event_time_may_move_known_at_earlier: false,
    current_visibility_may_move_known_at_earlier: false,
  };
}

function validateProspectiveSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot must be an object');
  if (snapshot.schema_version !== SCHEMA_VERSION) throw new Error('unexpected schema_version');
  if (snapshot.contract_id !== CONTRACT_ID) throw new Error('unexpected contract_id');
  requireString(snapshot.immutable_snapshot_id, 'immutable_snapshot_id');
  requireString(snapshot.source_provider, 'source_provider');
  requireString(snapshot.source_interface, 'source_interface');
  requireString(snapshot.source_request_key, 'source_request_key');
  requireIsoTimestamp(snapshot.collected_at, 'collected_at');
  requireString(snapshot.parser_version, 'parser_version');
  requireString(snapshot.methodology_identity, 'methodology_identity');
  if (!/^[a-f0-9]{64}$/.test(snapshot.response_sha256 || '')) throw new Error('response_sha256 must be sha256 hex');
  if (snapshot.raw_response_encoding !== 'base64') throw new Error('raw_response_encoding must be base64');
  const raw = Buffer.from(requireString(snapshot.raw_response_base64, 'raw_response_base64'), 'base64');
  if (raw.length !== snapshot.response_bytes) throw new Error('response_bytes mismatch');
  if (sha256(raw) !== snapshot.response_sha256) throw new Error('raw response hash mismatch');
  if (snapshot.pit_known_at !== snapshot.collected_at) throw new Error('pit_known_at must equal collected_at');
  if (snapshot.pit_known_at_basis !== 'immutable_version_observed_at_collection_time') throw new Error('invalid pit_known_at_basis');
  if (snapshot.pit_value_version_safety !== PIT_SAFETY_STATE) throw new Error('invalid pit_value_version_safety');
  if (snapshot.historical_back_imputation_allowed !== false) throw new Error('historical back-imputation must remain false');
  if (snapshot.source_event_time_may_move_known_at_earlier !== false) throw new Error('source event time must not move known-at earlier');
  if (snapshot.current_visibility_may_move_known_at_earlier !== false) throw new Error('current visibility must not move known-at earlier');

  const rebuilt = buildProspectiveSnapshot({
    source_provider: snapshot.source_provider,
    source_interface: snapshot.source_interface,
    source_request_key: snapshot.source_request_key,
    collected_at: snapshot.collected_at,
    source_reported_at: snapshot.source_reported_at,
    source_timestamp_precision: snapshot.source_timestamp_precision,
    parser_version: snapshot.parser_version,
    methodology_identity: snapshot.methodology_identity,
    raw_response: raw,
  });
  if (rebuilt.immutable_snapshot_id !== snapshot.immutable_snapshot_id) throw new Error('immutable_snapshot_id mismatch');
  return true;
}

function snapshotRelativePath(snapshot) {
  validateProspectiveSnapshot(snapshot);
  const timestamp = snapshot.collected_at.replace(/[-:.]/g, '');
  return path.posix.join(
    'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit',
    sanitizeSegment(snapshot.source_interface),
    sanitizeSegment(snapshot.source_request_key),
    `${timestamp}--${snapshot.immutable_snapshot_id}.json`,
  );
}

function writeSnapshotAppendOnly(root, snapshot) {
  validateProspectiveSnapshot(snapshot);
  const relativePath = snapshotRelativePath(snapshot);
  const destination = path.join(root, ...relativePath.split('/'));
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (fs.existsSync(destination)) {
    const existing = fs.readFileSync(destination, 'utf8');
    if (existing !== serialized) throw new Error(`immutable snapshot collision at ${relativePath}`);
    return { relative_path: relativePath, status: 'unchanged' };
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, serialized, { flag: 'wx' });
  return { relative_path: relativePath, status: 'created' };
}

module.exports = {
  CONTRACT_ID,
  SCHEMA_VERSION,
  PIT_SAFETY_STATE,
  buildProspectiveSnapshot,
  validateProspectiveSnapshot,
  snapshotRelativePath,
  writeSnapshotAppendOnly,
};
