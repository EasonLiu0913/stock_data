#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { plan } = require('./plan_institutional_accumulation_official_disclosure_collection');

const ROOT = path.resolve(__dirname, '..');
const HANDOFF = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md');
const PREFLIGHT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function main() {
  const preflight = readJson(PREFLIGHT);
  const p = plan();
  const corrected = preflight?.contracts?.corrected_api;
  const legacy = preflight?.contracts?.legacy;
  if (!corrected || Number(corrected.attempt_count) !== 1) throw new Error('Corrected API preflight must have exactly one durable attempt.');
  if (Number(legacy?.attempt_count) !== 2 || legacy?.retryable !== true || legacy?.terminal_state !== null) throw new Error('Legacy preflight evidence was not preserved exactly.');
  if (p.wave_a.length !== 0 || p.wave_b.length !== 0 || p.wave_c.length !== 0 || p.material_information_authorized) throw new Error(`Unexpected post-preflight plan: ${JSON.stringify(p)}`);
  if (Number(preflight?.diagnostics?.total_network_requests_this_round) !== 1) throw new Error('This round must use exactly one network request.');

  let text = fs.readFileSync(HANDOFF, 'utf8');
  text = text.replace('- Prompt A: **NOT STARTED / ACTIVE**', '- Prompt A: **COMPLETE — Prompt B pending**');
  text = text.replace('- Prompt B: **PREREGISTERED / NOT STARTED**', '- Prompt B: **PREREGISTERED / PENDING**');

  const marker = '## Prompt A durable checkpoint';
  const checkpoint = `${marker}\n\nRound: \`institutional-accumulation-material-information-final-preflight-v1\`\n\n- Prompt A status: **COMPLETE — Prompt B pending**.\n- Fresh-runner workflow run: \`${process.env.GITHUB_RUN_ID || 'unknown'}\`.\n- Triggering implementation head: \`${process.env.GITHUB_SHA || 'unknown'}\`.\n- corrected listing endpoint: \`${corrected.endpoint}\`; method: \`${corrected.method}\`.\n- deterministic request body: \`${JSON.stringify(corrected.request_body)}\`.\n- corrected API attempts this round: \`${corrected.attempt_count}\`; total network requests this round: \`${preflight.diagnostics.total_network_requests_this_round}\`.\n- application code/message: \`${String(corrected.application_code)} / ${String(corrected.application_message)}\`.\n- response bytes/SHA-256: \`${corrected.listing_request.bytes} / ${corrected.listing_request.sha256}\`.\n- row count: \`${String(corrected.row_count)}\`; listing contract passed: \`${String(corrected.listing_contract_passed)}\`.\n- detail contract status: \`${corrected.detail_contract?.status || 'unproven'}\`; detail request executed: \`${String(corrected.detail_contract?.request_executed === true)}\`.\n- durable decision: \`${preflight.decision}\`; reason: \`${preflight.reason}\`.\n- legacy route evidence remains separate at attempt_count=\`${legacy.attempt_count}\`, retryable=\`${legacy.retryable}\`, terminal_state=\`${String(legacy.terminal_state)}\`; no third legacy request was issued.\n- post-run planner: Wave A=\`${p.wave_a.length}\`, Wave B=\`${p.wave_b.length}\`, Wave C=\`${p.wave_c.length}\`; material-information collection authorization remains \`${p.material_information_authorized}\`.\n- Wave A was not refetched. Wave C did not run. Collection/git time remains audit metadata only, not historical PIT-availability proof.\n- Protected Phase 2/outcome/association/holdout/2454/Withdrawal state was not opened or modified by this bounded implementation.\n\n`;

  if (text.includes(marker)) {
    text = text.slice(0, text.indexOf(marker)) + checkpoint + text.slice(text.indexOf('## Prompt A — Material-information API-contract correction preflight'));
  } else {
    text = text.replace('## Prompt A — Material-information API-contract correction preflight', checkpoint + '## Prompt A — Material-information API-contract correction preflight');
  }
  fs.writeFileSync(HANDOFF, text);
}

if (require.main === module) main();
