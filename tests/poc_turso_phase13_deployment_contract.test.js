'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const wf='.github/workflows/poc-turso-live-shadow-daily.yml';

test('Phase 13 workflow has only the approved UTC slots and no production writer changes',()=>{
  const y=read(wf);
  assert.match(y,/^  schedule:\s*$/m);
  assert.equal([...y.matchAll(/^\s+- cron:\s*'([^']+)'/gm)].map(x=>x[1]).join(','),'47 11 * * 1-5,17 13 * * 1-5');
  assert.match(y,/workflow_dispatch:/);
  assert.match(y,/contents: read/);
  assert.match(y,/cancel-in-progress: false/);
  assert.match(y,/timeout-minutes: 10/);
  assert.doesNotMatch(y,/(?:actions\/checkout|actions\/setup-node|actions\/upload-artifact)@v4/);
});
test('Phase 13 cron only calls writer after fail-closed READY gate',()=>{
  const y=read(wf);
  assert.match(y,/steps\.gate\.outputs\.ready == 'true'/);
  assert.match(y,/PHASE11_TARGET_DATE: \$\{\{ steps\.gate\.outputs\.target_date \}\}/);
  assert.match(y,/node scripts\/poc_turso_phase12_schedule_gate\.js/);
  assert.match(y,/node scripts\/poc_turso_phase11_live_shadow_collect\.js/);
  assert.match(y,/ref: main/);
  assert.doesNotMatch(y,/curl .*twse|fetch.*twse/i);
});
test('Phase 13 source integrity and ledger identity are fail-closed',()=>{
  const c=read('scripts/poc_turso_phase11_live_shadow_collect.js');
  assert.match(c,/ACCEPTED_SOURCE_IDENTITY_CHANGED/);
  assert.match(c,/CANONICAL_CHANGED_DURING_SHADOW/);
  assert.match(c,/ON CONFLICT\(trade_date\) DO NOTHING/);
  assert.match(c,/PARITY_HASH_MISMATCH/);
  assert.match(c,/const AUTH_DATE='20261006'/);
});
test('Phase 13 completion requires consecutive trading days, not raw accepted count',()=>{
  const s=read('scripts/poc_turso_phase11_live_shadow_status.js');
  assert.match(s,/nextEligibleTradingDate/);
  assert.match(s,/longest_consecutive/);
  assert.match(s,/complete:streak\.complete/);
  assert.doesNotMatch(s,/complete:accepted\.length>=20/);
});
