'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  validateProspectiveSnapshot,
  snapshotRelativePath,
} = require('./institutional_accumulation_catalyst_prospective_pit_capture_contract');

const AUDIT_ID = 'institutional-accumulation-catalyst-prospective-observation-audit-v1';
const ROOT_RELATIVE = 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const EXPECTED_STOCKS = ['1102', '1104', '1216'];
const EXPECTED_INTERFACES = [
  'prospective_material_information_detail',
  'prospective_material_information_listing',
];
const EXPECTED_METHODOLOGY = 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1';

function walkJsonFiles(root) {
  const out = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(absolute);
      else throw new Error(`unexpected non-json entry: ${absolute}`);
    }
  }
  visit(root);
  return out.sort();
}

function assertCanonicalBase64(snapshot) {
  const encoded = snapshot.raw_response_base64;
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('raw_response_base64 is not canonical base64');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) throw new Error('raw_response_base64 canonical roundtrip mismatch');
  if (bytes.length !== snapshot.response_bytes) throw new Error('response_bytes mismatch');
}

function observationFromFile(repoRoot, absolutePath) {
  const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/');
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`malformed_json:${relativePath}:${error.message}`);
  }
  assertCanonicalBase64(snapshot);
  validateProspectiveSnapshot(snapshot);
  if (snapshot.methodology_identity !== EXPECTED_METHODOLOGY) throw new Error(`unexpected_methodology:${relativePath}`);
  if (!EXPECTED_INTERFACES.includes(snapshot.source_interface)) throw new Error(`unexpected_interface:${relativePath}`);
  const stock = String(snapshot.source_request_key || '').split('|')[0];
  if (!EXPECTED_STOCKS.includes(stock)) throw new Error(`unexpected_stock:${relativePath}`);
  if (snapshot.pit_known_at !== snapshot.collected_at) throw new Error(`pit_known_at_mismatch:${relativePath}`);
  if (snapshot.historical_back_imputation_allowed !== false) throw new Error(`historical_back_imputation_unsafe:${relativePath}`);
  const canonicalPath = snapshotRelativePath(snapshot);
  if (relativePath !== canonicalPath) throw new Error(`snapshot_path_identity_mismatch:${relativePath}`);
  return {
    source_path: relativePath,
    stock,
    source_interface: snapshot.source_interface,
    source_request_key: snapshot.source_request_key,
    collected_at: snapshot.collected_at,
    immutable_snapshot_id: snapshot.immutable_snapshot_id,
    response_sha256: snapshot.response_sha256,
    response_bytes: snapshot.response_bytes,
    parser_version: snapshot.parser_version,
    methodology_identity: snapshot.methodology_identity,
  };
}

function auditObservations(repoRoot, options = {}) {
  const rootRelative = options.rootRelative || ROOT_RELATIVE;
  const root = path.join(repoRoot, ...rootRelative.split('/'));
  const files = walkJsonFiles(root);
  const observations = files.map(file => observationFromFile(repoRoot, file)).sort((a, b) => a.source_path.localeCompare(b.source_path));

  const immutable = new Map();
  const hashes = new Set();
  for (const observation of observations) {
    const prior = immutable.get(observation.immutable_snapshot_id);
    if (prior) {
      if (prior.response_sha256 !== observation.response_sha256 || prior.source_path !== observation.source_path) {
        throw new Error(`immutable_snapshot_conflict:${observation.immutable_snapshot_id}`);
      }
      throw new Error(`duplicate_immutable_snapshot:${observation.immutable_snapshot_id}`);
    }
    immutable.set(observation.immutable_snapshot_id, observation);
    hashes.add(observation.response_sha256);
  }

  const byStock = Object.fromEntries(EXPECTED_STOCKS.map(stock => [stock, { total: 0, listing: 0, detail: 0 }]));
  const byInterface = Object.fromEntries(EXPECTED_INTERFACES.map(name => [name, 0]));
  for (const observation of observations) {
    const bucket = byStock[observation.stock];
    bucket.total += 1;
    if (observation.source_interface === 'prospective_material_information_listing') bucket.listing += 1;
    if (observation.source_interface === 'prospective_material_information_detail') bucket.detail += 1;
    byInterface[observation.source_interface] += 1;
  }

  if (options.requireCurrentBaseline !== false) {
    if (observations.length !== 6) throw new Error(`unexpected_observation_count:${observations.length}`);
    for (const stock of EXPECTED_STOCKS) {
      if (byStock[stock].total !== 2 || byStock[stock].listing !== 1 || byStock[stock].detail !== 1) {
        throw new Error(`unexpected_stock_interface_pair:${stock}`);
      }
    }
  }

  const times = observations.map(x => x.collected_at).sort();
  const methodologyIdentities = [...new Set(observations.map(x => x.methodology_identity))].sort();
  const parserVersions = [...new Set(observations.map(x => x.parser_version))].sort();

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    source_root: ROOT_RELATIVE,
    network_collection_used: false,
    expected_methodology_identity: EXPECTED_METHODOLOGY,
    valid_observation_count: observations.length,
    invalid_observation_count: 0,
    conflict_count: 0,
    stock_count: Object.values(byStock).filter(v => v.total > 0).length,
    stocks: byStock,
    source_interface_counts: byInterface,
    unique_immutable_snapshot_count: immutable.size,
    unique_response_sha256_count: hashes.size,
    collection_time_range: {
      first: times[0] || null,
      last: times.at(-1) || null,
    },
    methodology_identities: methodologyIdentities,
    parser_versions: parserVersions,
    immutable_snapshot_ids: [...immutable.keys()].sort(),
    response_sha256s: [...hashes].sort(),
    source_paths: observations.map(x => x.source_path),
    observations,
    protected_state: {
      historical_identity_upgrade_performed: false,
      outcomes_opened: false,
      holdouts_opened: false,
      catalyst_outcome_association_opened: false,
      withdrawal_state_opened: false,
    },
  };
}

function serializeAudit(audit) {
  return `${JSON.stringify(audit, null, 2)}\n`;
}

function main() {
  const repoRoot = process.cwd();
  const audit = auditObservations(repoRoot);
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    const output = path.join(repoRoot, ...OUTPUT_RELATIVE.split('/'));
    fs.writeFileSync(output, serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
    return;
  }
  process.stdout.write(serialized);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  AUDIT_ID,
  ROOT_RELATIVE,
  OUTPUT_RELATIVE,
  EXPECTED_STOCKS,
  EXPECTED_INTERFACES,
  EXPECTED_METHODOLOGY,
  walkJsonFiles,
  assertCanonicalBase64,
  observationFromFile,
  auditObservations,
  serializeAudit,
};
