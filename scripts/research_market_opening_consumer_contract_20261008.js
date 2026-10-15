'use strict';
// Research-only single-entry consumer contract. No production video or publication writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function build(master){
 assert.equal(master.target_date,'20261008');assert.equal(master.status,'research_partial');assert.equal(master.publication_authorized,false);
 assert.equal(master.editorial_complete,false);assert.equal(master.breadth.verified_twse_common_stock_only,false);
 const values={date:master.target_date,index_change_pct:master.taiex.change_pct,turnover_twd:master.market_trading.turnover_twd,rising_count:master.breadth.rising_count,falling_count:master.breadth.falling_count,unchanged_count:master.breadth.unchanged_count,limit_up_count:master.breadth.limit_up_count,denominator:master.breadth.denominator,foreign_net_twd:master.institutional.foreign.net_twd,trust_net_twd:master.institutional.investment_trust.net_twd,dealer_net_twd:master.institutional.dealers.net_twd,total_net_twd:master.institutional.total.net_twd,regime:master.market_regime.assessment};
 assert.equal(values.foreign_net_twd+values.trust_net_twd+values.dealer_net_twd,values.total_net_twd);
 const canonical=JSON.stringify(values);
 const master_sha256=crypto.createHash('sha256').update(JSON.stringify(master)).digest('hex');
 const snapshot_sha256=crypto.createHash('sha256').update(canonical).digest('hex');
 const consumers={narration:JSON.parse(canonical),captions:JSON.parse(canonical),information_cards:JSON.parse(canonical)};
 for(const [name,v] of Object.entries(consumers))assert.equal(JSON.stringify(v),canonical,'CONSUMER_DRIFT_'+name);
 return {status:'RESEARCH_ONLY',publication_authorized:false,editorial_complete:false,source:'market-opening-unified-research-master.json',master_sha256,snapshot_sha256,consumers};
}
if(require.main===module){
 const master=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/market-opening-unified-research-master.json','utf8'));
 const result=build(master);
 fs.writeFileSync('/tmp/video-recovery-proof/market-opening-consumer-contract.json',JSON.stringify(result,null,2)+'\n');
 console.log('MARKET_OPENING_THREE_CONSUMER_CONTRACT_PASS; production consumers not switched; editorial_complete=false');
}
// Fail-closed preview projections: every consumer receives the identical canonical snapshot.
function verifyProjections(master,contract){
 const expected=build(master);
 assert.equal(contract.master_sha256,expected.master_sha256,'MASTER_SHA_DRIFT');
 assert.equal(contract.snapshot_sha256,expected.snapshot_sha256,'SNAPSHOT_SHA_DRIFT');
 assert.deepEqual(Object.keys(contract.consumers).sort(),['captions','information_cards','narration']);
 for(const name of Object.keys(expected.consumers))assert.deepEqual(contract.consumers[name],expected.consumers[name],'CONSUMER_DRIFT_'+name);
 assert.equal(contract.publication_authorized,false);assert.equal(contract.editorial_complete,false);
 return true;
}
module.exports={build,verifyProjections};
