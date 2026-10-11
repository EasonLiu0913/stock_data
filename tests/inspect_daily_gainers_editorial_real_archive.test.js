'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspect,candidate}=require('../scripts/inspect_daily_gainers_editorial_real_archive');
test('actual 20261008 raw SHA, M1 breadth and M2 financial facts reconcile, but no fabricated release approval',()=>{
 const x=inspect(),e=x.evidence;
 assert.equal(x.status,'REAL_ARCHIVE_INTEGRITY_PASS_PUBLICATION_SCOPE_BLOCKED');
 assert.equal(e.date,'20261008');
 assert.deepEqual([e.breadth.advancers,e.breadth.decliners,e.breadth.unchanged],[425,540,109]);
 assert.equal(e.turnover_twd,924509097873);
 assert.equal(e.net_twd,-91574625081);
 assert.equal(Object.values(e.groups).reduce((a,b)=>a+b,0),e.net_twd);
 assert.equal(Object.keys(e.source_sha256).length,3);
 assert.equal(e.scope_verified_for_publication,false);
 assert.equal(x.publication_authorized,false);
 assert.throws(candidate,/EDITORIAL_PUBLICATION_SCOPE_NOT_CERTIFIED/);
});
