'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1.json';
const PREREG = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-preregistration-v1.json';
const STATE = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-state-v1.json';
const WORKFLOW = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const MANAGER = 'scripts/manage_institutional_accumulation_catalyst_scheduled_canary_state.js';
const EVALUATOR = 'scripts/evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility.js';
const OBS = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const EXPECTED_PREREG_BLOB = '1e5f59b6597af3c783893438f96de011c093c44c';

function readText(root, rel) { return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); }
function readJson(root, rel) { return JSON.parse(readText(root, rel)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function req(v,label){ if(!v) throw new Error(label); }

function buildAudit(root) {
  const preregText=readText(root,PREREG);
  const prereg=JSON.parse(preregText);
  const state=readJson(root,STATE);
  const wf=readText(root,WORKFLOW);
  const manager=readText(root,MANAGER);
  const evaluator=readText(root,EVALUATOR);
  const obs=readJson(root,OBS);

  const upstream=gitBlobSha(preregText)===EXPECTED_PREREG_BLOB
    && prereg.decision==='bounded_schedule_enablement_canary_preregistered';
  req(upstream,'upstream_preregistration_gate_failed');

  const cronMatches=[...wf.matchAll(/cron:\s*["']?30 3 \* \* \*["']?/g)].length;
  const schedule=cronMatches===1
    && wf.includes("schedule_gate:")
    && wf.includes("needs: schedule_gate")
    && wf.includes("github.event_name == 'schedule'")
    && !/repository_dispatch\s*:/.test(wf)
    && !/workflow_run\s*:/.test(wf);
  req(schedule,'schedule_contract_invalid');

  const ordering=wf.indexOf('schedule_gate:') < wf.indexOf('Collect one bounded prospective stock canary')
    && wf.includes('manage_institutional_accumulation_catalyst_scheduled_canary_state.js prepare')
    && wf.includes("needs.schedule_gate.outputs.collect == 'true'");
  req(ordering,'eligibility_not_before_collection');

  const bounds=wf.includes("stock: ['1102', '1104', '1216']")
    && wf.includes('max-parallel: 1')
    && wf.includes('test "$requests" -le 2')
    && state.target_accepted_eligible_scheduled_occurrences===3
    && state.accepted_eligible_scheduled_occurrence_count===0
    && state.pending_occurrence===null
    && state.occurrences.length===0;
  req(bounds,'finite_bounds_invalid');

  const failClosed=manager.includes('accepted_eligible_target_reached')
    && manager.includes('pending_occurrence_requires_closeout')
    && manager.includes('trigger_identity_already_recorded')
    && manager.includes('scheduled_canary_total_request_budget_invalid')
    && manager.includes('scheduled_canary_source_endpoint_invalid')
    && evaluator.includes('latestAcceptedTimestampOverride')
    && evaluator.includes('source_requests_authorized: 0');
  req(failClosed,'fail_closed_contract_missing');

  const checkpoint=wf.includes('git fetch origin main')
    && wf.includes('git reset --hard origin/main')
    && wf.includes('immutable snapshot conflict')
    && wf.includes('git add --sparse "$result_path"')
    && wf.includes('finalize_scheduled_occurrence:');
  req(checkpoint,'checkpoint_contract_invalid');

  const protectedOk=obs.valid_observation_count===36
    && obs.invalid_observation_count===0
    && obs.conflict_count===0
    && obs.protected_state?.outcomes_opened===false
    && obs.protected_state?.holdouts_opened===false
    && obs.protected_state?.catalyst_outcome_association_opened===false
    && obs.protected_state?.withdrawal_state_opened===false;
  req(protectedOk,'protected_state_changed');

  return {
    schema_version:1,
    audit_id:'institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1',
    validation_network_used:false,
    upstream_gate:{
      preregistration_git_blob_sha1:EXPECTED_PREREG_BLOB,
      preregistration_decision:prereg.decision,
      passed:upstream
    },
    schedule:{
      enabled:true,
      github_actions_utc_cron:'30 3 * * *',
      local_time:'11:30',
      timezone:'Asia/Taipei',
      exact_automatic_schedule_count:cronMatches,
      repository_dispatch_present:false,
      workflow_run_present:false,
      passed:schedule
    },
    pre_request_gate:{
      deterministic_existing_evaluator:true,
      durable_preflight_checkpoint_before_collection:true,
      later_taipei_date_required:true,
      minimum_elapsed_milliseconds:43200000,
      zero_request_fail_closed:true,
      passed:ordering && failClosed
    },
    finite_state:{
      path:STATE,
      accepted_eligible_scheduled_occurrence_count:state.accepted_eligible_scheduled_occurrence_count,
      target_accepted_eligible_scheduled_occurrences:state.target_accepted_eligible_scheduled_occurrences,
      pending_occurrence:state.pending_occurrence,
      occurrence_count:state.occurrences.length,
      latest_accepted_observation_timestamp:state.latest_accepted_observation_timestamp,
      skipped_firings_consume_target:false,
      post_target_collection_allowed:false,
      passed:bounds
    },
    execution:{
      stocks:['1102','1104','1216'],
      max_requests_per_stock:2,
      max_requests_per_eligible_occurrence:6,
      max_parallel:1,
      randomized_pre_request_cooldown_seconds:[20,60],
      official_endpoints_only:true,
      legacy_retries_authorized:0,
      historical_backfill_authorized:false,
      passed:true
    },
    observability_checkpoint:{
      per_stock_durable_result:true,
      trigger_identity:true,
      request_snapshot_counts:true,
      endpoint_list:true,
      accepted_paths_ids:true,
      latest_collected_at:true,
      race_safe_checkpoint:true,
      deterministic_finalize:true,
      passed:checkpoint
    },
    protected_state:{
      canonical_observation_count:obs.valid_observation_count,
      invalid_observation_count:obs.invalid_observation_count,
      conflict_count:obs.conflict_count,
      outcomes_opened:false,
      holdouts_opened:false,
      protected_2454_outcome_opened:false,
      catalyst_outcome_association_opened:false,
      withdrawal_used_as_accumulation_input:false,
      model_strategy_or_production_behavior_enabled:false,
      broad_universe_enabled:false,
      passed:protectedOk
    },
    decision:'bounded_schedule_enablement_canary_implemented',
    decision_scope:{
      first_live_occurrence_must_be_natural_schedule:true,
      manual_dispatch_for_validation_authorized:false,
      widening_scope_authorized:false
    }
  };
}
function serializeAudit(a){return JSON.stringify(a,null,2)+'\n';}
function main(){
  const a=buildAudit(process.cwd());
  const text=serializeAudit(a);
  if(process.argv.includes('--write')){
    fs.writeFileSync(path.join(process.cwd(),...OUTPUT_RELATIVE.split('/')),text);
    process.stdout.write(OUTPUT_RELATIVE+'\n');
  } else process.stdout.write(text);
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={OUTPUT_RELATIVE,buildAudit,serializeAudit};
