#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { plan, ROW_SHAPE_PREFLIGHT_VERSION } = require('./plan_institutional_accumulation_official_disclosure_collection');

const ROOT = path.resolve(__dirname, '..');
const HANDOFF = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md');
const PREFLIGHT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json');
const SOURCE = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source.json');
const SOURCE_META = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source-meta.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function main() {
  const preflight = readJson(PREFLIGHT);
  const source = readJson(SOURCE);
  const meta = readJson(SOURCE_META);
  const p = plan();
  const corrected = preflight?.contracts?.corrected_api;
  const legacy = preflight?.contracts?.legacy;
  if (preflight.methodology !== ROW_SHAPE_PREFLIGHT_VERSION || meta.methodology !== ROW_SHAPE_PREFLIGHT_VERSION) throw new Error('Wrong row-shape preflight methodology.');
  if (!source || !meta) throw new Error('Corrected listing raw evidence is missing.');
  if (!corrected || Number(corrected.attempt_count) !== 1) throw new Error('Corrected listing request must have exactly one durable attempt in this round.');
  if (Number(legacy?.attempt_count) !== 2 || legacy?.retryable !== true || legacy?.terminal_state !== null) throw new Error('Legacy preflight evidence was not preserved exactly.');
  if (p.wave_a.length !== 0 || p.wave_b.length !== 0 || p.wave_c.length !== 0 || p.material_information_authorized) throw new Error(`Unexpected post-preflight plan: ${JSON.stringify(p)}`);
  if (Number(preflight?.diagnostics?.total_network_requests_this_round) > 3) throw new Error('This round exceeded the total network request cap.');
  if (corrected.listing_contract_passed !== true) throw new Error(`Listing contract did not pass: ${preflight.reason}`);
  if (preflight.decision !== 'listing_contract_passed_detail_contract_unproven' && preflight.decision !== 'listing_and_detail_contract_passed') throw new Error(`Unexpected durable decision: ${preflight.decision}`);

  let text = fs.readFileSync(HANDOFF, 'utf8');
  text = text.replace('- Prompt A: **NOT STARTED / ACTIVE**', '- Prompt A: **COMPLETE — Prompt B pending**');
  text = text.replace('- Prompt B: **PREREGISTERED / NOT STARTED**', '- Prompt B: **PREREGISTERED / PENDING**');

  const marker = '## Prompt A durable checkpoint — row-shape + detail-contract preflight';
  const checkpoint = `${marker}\n\nRound: \`${ROW_SHAPE_PREFLIGHT_VERSION}\`\n\n- Prompt A status: **COMPLETE — Prompt B pending**.\n- Fresh-runner workflow run: \`${process.env.GITHUB_RUN_ID || 'unknown'}\`.\n- Triggering implementation head: \`${process.env.GITHUB_SHA || 'unknown'}\`.\n- corrected listing endpoint/method: \`${corrected.endpoint}\` / \`${corrected.method}\`.\n- deterministic request body: \`${JSON.stringify(corrected.request_body)}\`.\n- total network requests this round: \`${preflight.diagnostics.total_network_requests_this_round}\` (cap 3); legacy attempt_count remains \`${legacy.attempt_count}\`.\n- raw listing source: \`${corrected.raw_source_path}\`; metadata: \`${corrected.raw_source_meta_path}\`.\n- response bytes/SHA-256: \`${corrected.listing_request.bytes} / ${corrected.listing_request.sha256}\`.\n- application code/message: \`${String(corrected.application_code)} / ${String(corrected.application_message)}\`.\n- row count/type/coherence: \`${String(corrected.row_count)} / ${corrected.row_shape?.row_type || 'unknown'} / ${String(corrected.coherent_row_structure)}\`.\n- descriptor count: \`${String(corrected.detail_descriptor_count)}\`; sample descriptor: \`${JSON.stringify(corrected.sample_detail_descriptor)}\`.\n- listing contract passed: \`${String(corrected.listing_contract_passed)}\`.\n- detail contract status: \`${corrected.detail_contract?.status || 'unproven'}\`; request executed: \`${String(corrected.detail_contract?.request_executed === true)}\`.\n- durable decision: \`${preflight.decision}\`; reason: \`${preflight.reason}\`.\n- post-run planner: Wave A=\`${p.wave_a.length}\`, Wave B=\`${p.wave_b.length}\`, Wave C=\`${p.wave_c.length}\`; material-information authorization=\`${p.material_information_authorized}\`.\n- Wave A was not refetched. Wave C did not run. Current collection time remains audit metadata only, not historical PIT proof.\n- Protected Phase 2/outcome/association/holdout/2454/Withdrawal state was not opened or modified by this bounded implementation.\n\n`;

  if (text.includes(marker)) text = text.slice(0, text.indexOf(marker)) + checkpoint + text.slice(text.indexOf('## Prompt A — Row-shape + detail-contract preflight'));
  else text = text.replace('## Prompt A — Row-shape + detail-contract preflight', checkpoint + '## Prompt A — Row-shape + detail-contract preflight');
  fs.writeFileSync(HANDOFF, text);
}

if (require.main === module) main();
