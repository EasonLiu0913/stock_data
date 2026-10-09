'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {assignments}=require('../scripts/research_twse_main_js_provenance');
test('extracts literal host and locale without claiming runtime certainty',()=>{const a=assignments("const cfg = {apiHost:{rwd:'https://www.twse.com.tw'},lan:'zh'};");assert.equal(a.apiHostRwd[0].value,'https://www.twse.com.tw');assert.equal(a.language[0].value,'zh')});
test('unsupported computed config stays unattributed',()=>{const a=assignments('cfg.apiHost.rwd = resolveHost();cfg.lan = chooseLang();');assert.deepEqual(a.apiHostRwd,[]);assert.deepEqual(a.language,[])});
