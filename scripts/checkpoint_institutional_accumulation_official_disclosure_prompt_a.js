#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HANDOFF = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-validation-handoff.md');

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`Missing handoff marker: ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous handoff marker: ${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function main() {
  let text = fs.readFileSync(HANDOFF, 'utf8');

  text = replaceOnce(
    text,
    '**Official-disclosure source-collection preregistration: COMPLETE / Prompt B PASS.**\n\nPromoted next round:\n\n`institutional-accumulation-official-disclosure-source-collection-v1`',
    '**Official-disclosure source collection: Prompt A COMPLETE / Prompt B pending.**\n\nActive round:\n\n`institutional-accumulation-official-disclosure-source-collection-v1`',
    'current phase'
  );

  text = replaceOnce(
    text,
    '- `institutional-accumulation-official-disclosure-source-collection-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.\n\nPromotion does not execute the promoted Prompt A automatically.',
    '- `institutional-accumulation-official-disclosure-source-collection-v1`: Prompt A **COMPLETE**, Prompt B **PREREGISTERED / NOT STARTED**.\n\nPrompt A is complete; mandatory Prompt B closeout is pending. No later round is promoted.',
    'active round status'
  );

  const checkpoint = `## Official-disclosure source collection Prompt A\n\nRound: \`institutional-accumulation-official-disclosure-source-collection-v1\`\n\nPre-Prompt-A baseline: \`bf048ec66ba570ee63aa39dbbf8feaf918825aac\`.\n\nImplementation / execution evidence:\n\n- planner: \`scripts/plan_institutional_accumulation_official_disclosure_collection.js\`, commit \`a533656f9beb47d538a916ad5bb0d3b0690cb064\`;\n- monthly archive collector: \`scripts/collect_institutional_accumulation_mops_monthly_revenue_batch.js\`, commit \`4b713dda720c42cb1120b3ef859e5914c52ecf9b\`;\n- material-information preflight: \`scripts/preflight_institutional_accumulation_mops_material_information.js\`, commit \`cc6ebbe230e3487bc4b092a842939961a422977e\`;\n- gated material-information collector: \`scripts/collect_institutional_accumulation_mops_material_information_batch.js\`, commit \`6a069ac9023943587e643a55665a234bfebefbc1\`;\n- regression: \`tests/institutional_accumulation_official_disclosure_collection.test.js\`, commit \`4beb0761c68ddc7441b0b459ed0b3c35686cffd9\`;\n- physical-batch workflow: \`.github/workflows/collect-institutional-accumulation-official-disclosure.yml\`, implementation commit \`5b0422b36a08d162ba7a84cdeab0b4271a9f8750\`;\n- execution trigger head: \`e9d49e0187208dcda6e8cf7938a4610672bf6c1e\`;\n- fresh-runner workflow run: \`33593814104\`, overall conclusion \`success\`;\n- test/plan job \`100133060762\`: PASS;\n- Wave A job \`100133419008\`: PASS;\n- Wave B preflight job \`100133797722\`: PASS as an expected fail-closed BLOCKED result;\n- Wave C re-plan job \`100134166246\`: PASS;\n- Wave C listing job \`100134929936\`: SKIPPED because preflight did not authorize collection.\n\nWave A durable checkpoint:\n\n- commit \`93a8ca2e7056bf2aee49cc185ebeb3765a243c98\`;\n- raw paths: \`data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source.html\`, \`source-meta.json\`, \`rows.json\`;\n- HTTP \`200\`, response bytes \`453020\`, SHA-256 \`ecb9dbd31124cc0afdf06c343e9bb2f0a41a16c0022b8d593eefcb53eeec66bd\`;\n- parsed company rows \`992\`; all nine frozen stocks \`1102, 1103, 1104, 1109, 1201, 1203, 1215, 1216, 1217\` are present;\n- quality state \`quality_passed\`, attempt \`1\`;\n- source-reported aggregate \`出表日期\` is \`20260902\`, which is later than every August 2026 T0 in the frozen unresolved set. Therefore this currently collected archive is durable first-party raw evidence but does **not** prove that the current row/value version was PIT-visible at those T0s; \`collected_at\` and git commit time are not used to backdate availability;\n- \`version_safety=historical_timing_safe_value_version_unproven\`; no PIT-safe catalyst/event coverage upgrade is claimed from this archive.\n\nWave B durable checkpoint:\n\n- commit \`eb776723787f4589590ac7224c42d428b6137b0b\`;\n- artifact: \`data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json\`;\n- deterministic stock/year: \`1102\`, ROC \`115\`;\n- only one request was needed before fail-closed stop; HTTP status was \`200\` but response size only \`800\` bytes, SHA-256 \`dc84075a778159410fe68616a58326b8dbc1054b21b84d50dd4e121983a50582\`;\n- durable decision \`blocked\`, reason \`listing_security_or_quality_block\`;\n- the response was **not** classified as source-empty; Wave C remained unauthorized and was skipped.\n\nDurable safety / scope evidence:\n\n- bounded compare \`bf048ec66ba570ee63aa39dbbf8feaf918825aac...eb776723787f4589590ac7224c42d428b6137b0b\` contains only this round's workflow, four collection/planning scripts, regression test, Wave A raw archive artifacts, and Wave B preflight artifact; no frozen outcome, holdout, protected \`2454\`, association, or Withdrawal file changed;\n- planner is outcome-blind and still derives exactly the frozen \`33\` unresolved identities;\n- current committed Wave A \`quality_passed\` metadata makes the deterministic planner omit that completed key on re-plan;\n- durable Wave B \`blocked\` state keeps material-information Wave C unauthorized;\n- no catalyst feature, catalyst/outcome association, threshold, score, weight, production model, strategy, generic-news substitution, or holdout opening occurred.\n\nPrompt A completion state: **COMPLETE — Prompt B pending**. The preregistered Prompt B below remains the only closeout contract for this round.\n\n`;

  if (!text.includes('## Official-disclosure source collection Prompt A')) {
    text = replaceOnce(text, '## Current repository state\n', checkpoint + '## Current repository state\n', 'current repository state insertion');
  }

  text = replaceOnce(
    text,
    '- official-disclosure source collection decision: `collection_preregistered`;\n- current official-event PIT-safe identity coverage remains `8/41`;\n- unresolved official-event identities remain `33/41` until a later collection round runs;\n- no catalyst feature or catalyst/outcome association is authorized yet.',
    '- official-disclosure source collection Prompt A: `COMPLETE`, Prompt B pending;\n- Wave A July 2026 MOPS archive is durably quality-passed, but its source-reported aggregate date is `20260902`, so no August-T0 PIT-safe coverage upgrade is claimed;\n- Wave B MOPS material-information preflight is durably `blocked` on HTTP 200 + 800-byte security/quality response; Wave C did not run;\n- current official-event PIT-safe identity coverage remains `8/41`;\n- unresolved official-event identities remain `33/41`;\n- no catalyst feature or catalyst/outcome association is authorized yet.',
    'current repository state bullets'
  );

  text = replaceOnce(
    text,
    '- MOPS material-information machine enumeration/pagination and WAF behavior must pass the preregistered preflight before that source can be collected.',
    '- MOPS material-information machine enumeration/pagination remains blocked: the bounded preflight returned HTTP 200 with only 800 bytes and was classified `listing_security_or_quality_block`; full material-information collection remains forbidden until a separately authorized retry/preflight proves the machine contract.',
    'material preflight limitation'
  );

  text = replaceOnce(
    text,
    'Proposed exact collection-round implementation entry points:',
    'Implemented exact collection-round entry points:',
    'entry point heading'
  );

  fs.writeFileSync(HANDOFF, text, 'utf8');
  console.log(JSON.stringify({ ok: true, handoff: path.relative(ROOT, HANDOFF).replaceAll(path.sep, '/') }, null, 2));
}

if (require.main === module) main();
