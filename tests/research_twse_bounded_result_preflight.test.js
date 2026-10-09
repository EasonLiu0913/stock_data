'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evidence,sha}=require('../scripts/research_twse_bounded_result_preflight');
test('unverified host and locale always stop result fetching',()=>{const e=evidence('<script>cfg.apiHost.rwd="https://www.twse.com.tw";cfg.lan="zh"</script>');assert.equal(e.api_host_rwd_verified,false);assert.equal(e.language_path_verified,false)});
test('raw HTML byte hash is stable',()=>{assert.equal(sha(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')});
