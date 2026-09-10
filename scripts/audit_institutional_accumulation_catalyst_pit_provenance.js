'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FROZEN_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const READINESS_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1.json');
const WAVE_A_META = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source-meta.json');
const OUTPUT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function t0EndTaipei(t0) {
  const value = String(t0 || '');
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid YYYYMMDD T0: ${t0}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T23:59:59+08:00`;
}

function assertFullHistory() {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (shallow !== 'false') {
    throw new Error('PIT provenance audit requires complete local git history; shallow checkout is not acceptable');
  }
}

function commitsAtOrBefore(repoPath, t0) {
  const stdout = execFileSync(
    'git',
    ['log', '--all', '--format=%H%x09%cI', `--until=${t0EndTaipei(t0)}`, '--', repoPath],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();
  if (!stdout) return [];
  return stdout.split('\n').map((line) => {
    const [sha, committed_at] = line.split('\t');
    return { sha, committed_at };
  });
}

function listingMetaPath(stock) {
  return path.join(
    ROOT,
    'data_research/institutional-flow/official-disclosure-raw/mops-material-information/listings/115',
    String(stock),
    'source-meta.json',
  );
}

function main() {
  assertFullHistory();

  const frozen = readJson(FROZEN_PATH);
  const readiness = readJson(READINESS_PATH);
  const waveA = readJson(WAVE_A_META);

  const missing = frozen.decisions.filter((row) => row.state === 'source_missing');
  if (missing.length !== 33) throw new Error(`Expected 33 frozen source_missing identities, got ${missing.length}`);
  if (readiness.identity_count !== 33 || readiness.ready_identity_count !== 0 || readiness.not_ready_identity_count !== 33) {
    throw new Error('Immediately prior readiness contract is not 33 total / 0 ready / 33 not ready');
  }
  const readinessKeys = new Set(readiness.decisions.map((row) => row.source_identity));
  if (readinessKeys.size !== 33) throw new Error('Prior readiness identity set is not unique');
  if (waveA.quality_state !== 'quality_passed') throw new Error('Wave A source meta is not quality_passed');
  if (waveA.version_safety !== 'historical_timing_safe_value_version_unproven') {
    throw new Error('Wave A version-safety contract changed; manual re-audit required');
  }

  const decisions = missing.map((row) => {
    const stock = String(row.stock);
    const t0 = String(row.t0);
    const sourceIdentity = `${stock}|${t0}`;
    if (!readinessKeys.has(sourceIdentity)) throw new Error(`Identity missing from prior readiness artifact: ${sourceIdentity}`);

    const waveCPath = listingMetaPath(stock);
    const waveC = readJson(waveCPath);
    if (waveC.stock_id !== stock) throw new Error(`Wave C stock mismatch for ${stock}`);
    if (waveC.quality_state !== 'quality_passed') throw new Error(`Wave C quality not passed for ${stock}`);
    if (waveC.source_timestamp_precision !== 'listing_only') throw new Error(`Unexpected Wave C timestamp precision for ${stock}`);
    if (waveC.version_safety !== 'historical_timing_safe_value_version_unproven') {
      throw new Error(`Wave C version-safety contract changed for ${stock}; manual re-audit required`);
    }
    if (waveC.pit_known_at != null) throw new Error(`Wave C PIT known-at unexpectedly populated for ${stock}`);

    const waveAHistory = commitsAtOrBefore(rel(WAVE_A_META), t0);
    const waveCHistory = commitsAtOrBefore(rel(waveCPath), t0);

    const reasonCodes = [];
    if (String(waveA.pit_known_at || '') > t0) reasonCodes.push('wave_a_declared_known_after_t0');
    if (waveAHistory.length === 0) reasonCodes.push('wave_a_no_durable_path_commit_at_or_before_t0');
    if (waveCHistory.length === 0) reasonCodes.push('wave_c_no_durable_path_commit_at_or_before_t0');
    reasonCodes.push('wave_a_immutable_value_version_unproven');
    reasonCodes.push('wave_c_immutable_value_version_unproven');
    reasonCodes.push('wave_c_pit_known_at_unproven');

    return {
      stock,
      t0,
      source_identity: sourceIdentity,
      decision: 'not_pit_ready',
      positive_imputation: false,
      evidence: {
        wave_a: {
          source_meta_path: rel(WAVE_A_META),
          declared_pit_known_at: waveA.pit_known_at ?? null,
          version_safety: waveA.version_safety ?? null,
          git_history_at_or_before_t0: waveAHistory,
        },
        wave_c: {
          source_meta_path: rel(waveCPath),
          declared_pit_known_at: waveC.pit_known_at ?? null,
          source_timestamp_precision: waveC.source_timestamp_precision ?? null,
          version_safety: waveC.version_safety ?? null,
          git_history_at_or_before_t0: waveCHistory,
        },
      },
      reason_codes: reasonCodes,
      rationale: 'No affirmative repository/git-history evidence establishes that an immutable qualifying catalyst value/version was knowable no later than T0; fail closed.',
    };
  });

  const unique = new Set(decisions.map((row) => row.source_identity));
  if (unique.size !== 33) throw new Error('Audit decisions contain duplicate identities');

  const pitReadyCount = decisions.filter((row) => row.decision === 'pit_ready').length;
  const notPitReadyCount = decisions.filter((row) => row.decision === 'not_pit_ready').length;
  const manualReviewCount = decisions.filter((row) => row.decision === 'manual_review').length;

  const output = {
    schema_version: 1,
    audit_id: 'institutional-accumulation-catalyst-pit-provenance-resolution-v1',
    evidence_scope: 'checked_in_repository_files_and_complete_git_history_only',
    network_collection_used: false,
    source_network_requests: 0,
    outcome_blind: true,
    protected_2454_outcomes_read: false,
    development_outcome_values_read: false,
    holdout_outcomes_read: false,
    catalyst_outcome_association_opened: false,
    identity_count: decisions.length,
    pit_ready_identity_count: pitReadyCount,
    not_pit_ready_identity_count: notPitReadyCount,
    manual_review_identity_count: manualReviewCount,
    methodology: {
      t0_history_cutoff_timezone: 'Asia/Taipei (+08:00)',
      upgrade_rule: 'pit_ready requires affirmative durable evidence that the relevant immutable value/version was knowable no later than T0',
      fail_closed_rule: 'absence or ambiguity of historical timing/value-version proof remains not_pit_ready or manual_review; never positively impute',
      present_day_visibility_is_not_pit_proof: true,
      source_event_date_alone_is_not_pit_proof: true,
    },
    protected_state: {
      phase_2_semantic_sha256: '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b',
      methodology_development_identity_count: 41,
      readiness_identity_count: readiness.identity_count,
      readiness_ready_identity_count: readiness.ready_identity_count,
      readiness_not_ready_identity_count: readiness.not_ready_identity_count,
    },
    decisions,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    output: rel(OUTPUT_PATH),
    identities: output.identity_count,
    pit_ready: pitReadyCount,
    not_pit_ready: notPitReadyCount,
    manual_review: manualReviewCount,
    source_network_requests: 0,
  }));
}

if (require.main === module) main();
module.exports = { main, commitsAtOrBefore, t0EndTaipei };
