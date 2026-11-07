'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {verify}=require('../scripts/validate_daily_gainers_news_narration');
const date='20261102';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const script=read('research_pending/daily-gainers-video-scripts/'+date+'.json');
const news=read('data_daily_gain_over_5/analysis-news/'+date+'.json');
const ai=read('data_daily_gain_over_5/analysis-ai/'+date+'.json');
test('all six news-bearing stocks reach Agent narration with source, event and publication metadata',()=>{
 const result=verify(script,news,ai);
 assert.equal(result.status,'PASS');
 assert.equal(result.covered_stock_count,29);
 assert.equal(result.attributed_stock_count,6);
});
test('source missing in spoken narration fails closed',()=>{
 const a=structuredClone(script);
 a.scenes[2].narration=a.scenes[2].narration.replace('自由時報','某媒體');
 assert.throws(()=>verify(a,news,ai),/source or key event not spoken/);
});
test('invented attribution URL cannot pass',()=>{
 const a=structuredClone(script);
 a.scenes[3].news_attributions[0].url='https://unverified.example/claim';
 assert.throws(()=>verify(a,news,ai),/not grounded/);
});
test('a sourced stock cannot silently lose its attribution',()=>{
 const a=structuredClone(script);
 a.scenes[10].news_attributions=[];
 assert.throws(()=>verify(a,news,ai),/source omitted/);
});
test('repetitive generic disclaimer is rejected',()=>{
 const a=structuredClone(script);
 a.scenes[5].narration+='缺少直接催化證據。';
 assert.throws(()=>verify(a,news,ai),/boilerplate/);
});
test('post-close event without explicit market-close separation is rejected',()=>{
 const a=structuredClone(script);
 a.scenes[1].narration=a.scenes[1].narration.replace('公告晚於當日收盤','公告已公布');
 assert.throws(()=>verify(a,news,ai),/after-close/);
});
test('market opening narration is independent from news-to-voice verification',()=>{
 const a=structuredClone(script);
 a.scenes[0].narration='GitHub owns this opening';
 assert.equal(verify(a,news,ai).status,'PASS');
});
test('source name must match cited article, not merely any approved link',()=>{
 const a=structuredClone(script);
 const row=news.analyses.find(x=>x.code==='2468');
 a.scenes[2].news_attributions.find(x=>x.code==='2468').url=row.sources.find(x=>x.title.includes('永豐金')).url;
 assert.throws(()=>verify(a,news,ai),/spoken publisher does not match cited article title/);
});

test('20261104 private candidate preserves 44-stock coverage and grounds every source-bearing stock in narration',()=>{
 const script04=read('research_pending/daily-gainers-video-scripts/20261104.json');
 const news04=read('data_daily_gain_over_5/analysis-news/20261104.json');
 const ai04=read('data_daily_gain_over_5/analysis-ai/20261104.json');
 const result=verify(script04,news04,ai04);
 assert.equal(script04.editorial_quality.version,'news-to-narration-v1');
 assert.equal(result.status,'PASS');
 assert.equal(result.covered_stock_count,44);
 assert.equal(result.attributed_stock_count,4);
 assert.deepEqual(result.attributions.map(x=>x.code).sort(),['3515','6933','7710','7711']);
 assert.equal(script04.scenes.filter(s=>s.scene_type==='stock_list').length,15);
 assert.equal(script04.scenes.filter(s=>s.scene_type==='closing_summary').length,1);
});
