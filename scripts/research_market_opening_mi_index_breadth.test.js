'use strict';
const assert=require('node:assert/strict');
const {parse}=require('./research_market_opening_mi_index_breadth');
const fixture={date:'20261008',stat:'OK',type:'ALL',tables:[{title:'漲跌證券數合計',fields:['類型','整體市場','股票'],data:[['上漲(漲停)','5,285(78)','425(14)'],['下跌(跌停)','9,634(83)','540(2)'],['持平','1,031','109'],['未成交','17,406','3'],['無比價','3,343','5']]}]};
const clone=()=>JSON.parse(JSON.stringify(fixture));
const got=parse(fixture,'20261008');
assert.deepEqual([got.up,got.limit_up,got.down,got.limit_down,got.flat,got.untraded,got.no_comparison,got.denominator_including_untraded_and_no_comparison],[425,14,540,2,109,3,5,1082]);
assert.equal(got.ordinary_stock_identity_verified,false);
assert.equal(got.editorial_complete,false);
for(const mutation of [
 x=>x.date='20261009',x=>x.stat='ERROR',x=>x.type='STOCK',x=>x.tables=[],
 x=>x.tables.push(x.tables[0]),x=>x.tables[0].fields[2]='整體市場',
 x=>x.tables[0].data[0][2]='425(426)',x=>x.tables[0].data[1][2]='unknown',
 x=>x.tables[0].data[2][0]='其他',x=>x.tables[0].data.pop()
]){const x=clone();mutation(x);assert.throws(()=>parse(x,'20261008'));}
console.log('MI_INDEX_BREADTH_RESEARCH_TEST_PASS; editorial_complete=false');

const fs=require('node:fs'),crypto=require('node:crypto');
const {build:buildAIInput}=require('./build_ai_editor_input_v3_20261008');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root='data_daily_gain_over_5/';
const editorInput=buildAIInput(read('/tmp/video-recovery-proof/market-opening-unified-research-master.json'),read(root+'20261008.json'),read(root+'analysis-news/20261008.json'),read(root+'analysis-facts/20261008.json'),read(root+'analysis-ai/20261008.json'));
assert.deepEqual(editorInput.candidates.map(s=>s.code),['6672','2305','1301','3416','9103','2428']);
assert.equal(editorInput.editorial_instructions.publication_authorized,false);
assert.ok(editorInput.sources.every(s=>s.published_at<='2026-10-08'));
const output='/tmp/video-recovery-proof/ai-editor-input-v3.json';
fs.writeFileSync(output,JSON.stringify(editorInput,null,2)+'\n');
const fileHash=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
fs.appendFileSync('/tmp/video-recovery-proof/SHA256SUMS',fileHash+'  '+output+'\n');
console.log('AI_EDITOR_INPUT_V3_REAL_20261008_PASS candidates='+editorInput.candidates.length+' file_sha256='+fileHash+' research_only=true');
