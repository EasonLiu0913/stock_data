#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { addOpening, assertOpening } = require('./daily_gainers_brand_opening');
const date = process.argv[2];
if (!/^20\d{6}$/.test(date || '')) throw Error('Expected YYYYMMDD');
const root = 'data_daily_gain_over_5';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const raw = read(path.join(root, date + '.json'));
const ai = read(path.join(root, 'analysis-ai', date + '.json'));
const summary = read(path.join(root, 'market-summary', date + '.json'));
const script = read(path.join('video_scripts', 'daily-gainers', date + '.json'));
function check(cond, msg) { if (!cond) throw Error(msg); }
check(raw.target_date === date && ai.target_date === date && summary.target_date === date && script.target_date === date, 'date mismatch');
check(summary.status === 'final' && summary.coverage?.overall === 'complete', 'summary not final/complete');
check(raw.stock_count === raw.stocks.length && ai.stock_count === raw.stock_count && script.stock_count === raw.stock_count, 'stock count mismatch');
check(script.schema_version === 1 && script.methodology_version === 'chatgpt-video-script-v1', 'script schema mismatch');
// The script is approved for a trading date, not for a volatile summary generation timestamp.
// Keep the original source timestamp for provenance without invalidating historical videos.
check(typeof script.source_summary_generated_at === 'string' && !Number.isNaN(Date.parse(script.source_summary_generated_at)), 'missing or invalid original source timestamp');
check(Array.isArray(script.scenes) && script.scenes.length >= 5 && script.scenes.length <= 20, 'scene count must be 5-20');
const codes = new Set(raw.stocks.map(s => String(s.code)));
const allowedTypes=new Set(['market_opening','stock_list','summary','closing_summary']);
const seenCodes=[];
let closingCount=0;
let chars = 0;
for (const [i,s] of script.scenes.entries()) {
  check(allowedTypes.has(s.scene_type),'missing/invalid scene_type '+i);
  if(i===0)check(s.scene_type==='market_opening','first scene must be market opening');
  if(i>0)check(s.scene_type!=='market_opening','duplicate market opening');
  if(['summary','closing_summary'].includes(s.scene_type)){
    closingCount++;
    check(i===script.scenes.length-1,'closing summary must be last');
    check(Array.isArray(s.stock_codes)&&s.stock_codes.length===0,'closing summary must not list stocks');
    check(s.bullets?.length>=3,'closing summary lacks synthesis');
  }
  if(s.scene_type==='stock_list'){
    check(i>0&&i<script.scenes.length-1,'stock list must be between opening and closing');
    check(Array.isArray(s.stock_codes)&&s.stock_codes.length>=1&&s.stock_codes.length<=3,'stock list needs 1-3 codes');
    seenCodes.push(...s.stock_codes.map(String));
  }
  check(typeof s.title === 'string' && s.title.trim().length > 0 && s.title.length <= 85, 'invalid scene title ' + i);
  check(typeof s.subtitle === 'string' && s.subtitle.length <= 160, 'invalid scene subtitle ' + i);
  check(Array.isArray(s.bullets) && s.bullets.length <= 5 && s.bullets.every(b=>typeof b === 'string' && b.length <= 220), 'invalid bullets ' + i);
  check(typeof s.narration === 'string' && s.narration.length >= 75 && s.narration.length <= 1800, 'invalid narration ' + i);
  check(!s.stock_codes || (Array.isArray(s.stock_codes) && s.stock_codes.every(c => codes.has(String(c)))), 'invalid stock code ' + i);
  const effectiveNarration = i === 0 ? addOpening(s.narration) : s.narration;
  if (i === 0) assertOpening(effectiveNarration);
  chars += [...effectiveNarration].length;
}
check(closingCount===1,'exactly one closing summary required');
check(seenCodes.length===raw.stock_count && new Set(seenCodes).size===raw.stock_count && seenCodes.every(x=>codes.has(x)),'stock-list coverage must be exactly the complete set');
check(chars >= 1100 && chars <= 5500, 'narration length outside video bounds: ' + chars);
// Mandatory genuine market opening, before the first stock-list scene.
// Do not confuse official TWSE '股票' breadth with the 29 strong-stock subset.
const openingPath=path.join(root,'market-opening-video',date+'.json');
check(fs.existsSync(openingPath),'missing date-specific official market opening: '+openingPath);
const market=read(openingPath),first=script.scenes[0],marketBreadth=market.market_opening_breadth;
check(market.target_date===date && market.status==='verified_official_market_aggregate','market-opening data is not date-verified');
check(market.market==='TWSE' && marketBreadth?.scope==='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN' && market.trading?.scope==='TWSE_WHOLE_MARKET' && market.institutional?.scope==='TWSE_BFI82U_TWD','invalid market scopes');
for(const [group,keys] of Object.entries({market_opening_breadth:['advancers','decliners','unchanged','limit_up'],index:['close','change_points','change_pct'],trading:['turnover_twd'],institutional:['foreign_net_twd','investment_trust_net_twd','dealers_net_twd','total_net_twd']})){
  check(market[group]?.source_date===date,'market date mismatch: '+group);
  for(const key of keys)check(Number.isFinite(market[group]?.[key]),'missing market field '+group+'.'+key);
}
check(market.source_manifest?.length>=3 && market.source_manifest.every(x=>x.source_date===date && x.source_name && x.source_path_or_endpoint && x.verified===true && /^[a-f0-9]{64}$/.test(x.sha256||'')),'missing market source provenance');
check(Math.abs(market.institutional.foreign_net_twd+market.institutional.investment_trust_net_twd+market.institutional.dealers_net_twd-market.institutional.total_net_twd)<1,'institutional net mismatch');
check(Math.abs(market.index.close-market.index.previous_close-market.index.change_points)<0.02,'index mismatch');
check(first?.scene_type==='market_opening' && (!first.stock_codes || first.stock_codes.length===0),'first scene must be market opening, no individual stocks');
check(first.title.includes('市場') || first.title.includes('大盤'),'market opening title missing');
const requiredSpoken=['上漲','下跌','平盤','漲停','加權指數','成交金額','外資','投信','自營商','合計'];
for(const word of requiredSpoken)check(first.narration.includes(word),'market-opening narration missing '+word);
const displayFields=['加權指數','全市場成交金額','上漲／下跌','平盤／漲停','外資／投信／自營商','三大法人合計','市場強弱摘要'];
check(Number.isFinite(market.trading.turnover_ma5_twd) && market.trading.turnover_ma5_twd>0,'missing 5-trading-day turnover average');
check(Number.isFinite(market.trading.turnover_ratio_ma5),'missing 5-trading-day turnover comparison');
check(Math.abs(market.trading.turnover_twd/market.trading.turnover_ma5_twd-market.trading.turnover_ratio_ma5)<0.0001,'five-day turnover ratio mismatch');
check(/市場|盤勢|資金分歧|偏強|偏弱|震盪/.test(first.narration.slice(-120)),'market strength summary absent from opening commentary');
check(/前五個交易日|前 5 個交易日|近五個交易日|近 5 個交易日|五日均值|5日均值/.test(first.narration),'five-day turnover comparison missing from spoken opening');
check(typeof first.narration==='string' && first.narration.length>0,'missing opening script');
check(first.market_opening_claims && typeof first.market_opening_claims==='object','market-opening claims missing');
const officialClaims={advancers:marketBreadth.advancers,decliners:marketBreadth.decliners,unchanged:marketBreadth.unchanged,limit_up:marketBreadth.limit_up,index_close:market.index.close,index_change_points:market.index.change_points,index_change_pct:market.index.change_pct,turnover_twd:market.trading.turnover_twd,foreign_net_twd:market.institutional.foreign_net_twd,investment_trust_net_twd:market.institutional.investment_trust_net_twd,dealers_net_twd:market.institutional.dealers_net_twd,total_net_twd:market.institutional.total_net_twd};
for(const [key,value] of Object.entries(officialClaims))check(first.market_opening_claims[key]===value,'market opening claim differs from official snapshot: '+key);
for(const [key,value] of Object.entries(first.spoken_values||{}))check(typeof value==='string' && first.narration.includes(value),'spoken market value missing from narration: '+key);
for(const key of ['advancers','decliners','unchanged','limit_up','index_close','index_change_points','index_change_pct','turnover_twd','foreign_net_twd','investment_trust_net_twd','dealers_net_twd','total_net_twd'])check(typeof first.spoken_values?.[key]==='string' && first.spoken_values[key].length>0,'market value spoken evidence absent: '+key);
// Narration must follow the approved list-row Dashboard, not merely mention all values.
const orderedSpokenGroups=[
 ['index_close','index_change_points','index_change_pct'],
 ['turnover_twd'],
 ['advancers','decliners'],
 ['unchanged','limit_up'],
 ['foreign_net_twd','investment_trust_net_twd','dealers_net_twd'],
 ['total_net_twd']
];
let previousGroupEnd=-1;
for(const [groupIndex,keys] of orderedSpokenGroups.entries()){
 const positions=keys.map(key=>first.narration.indexOf(first.spoken_values[key]));
 check(positions.every(pos=>pos>=0),'opening spoken group missing '+groupIndex);
 check(positions[0]>previousGroupEnd,'market-opening narration order differs from Dashboard at group '+groupIndex);
 for(let i=1;i<positions.length;i++)check(positions[i]>positions[i-1],'market-opening narration field order differs from Dashboard: '+keys[i]);
 previousGroupEnd=positions.at(-1);
}
check(/市場|盤勢|資金分歧|偏強|偏弱|震盪/.test(first.narration.slice(previousGroupEnd+first.spoken_values.total_net_twd.length)),
 'market-strength synthesis must follow institutional total');
check(script.scenes.slice(1).some(x=>Array.isArray(x.stock_codes)&&x.stock_codes.length>0),'market opening has no subsequent stock chapter');
// Keep the seven immutable dashboard rows a required visual contract, not an AI choice.
const openingLayoutPath=path.join('scripts','build_daily_gainers_list_dashboard_slides.js');
const layoutSource=fs.readFileSync(openingLayoutPath,'utf8');
const fixedRowMatch=layoutSource.match(/const fixedFields=(\[[^;]+\]);/);
check(Boolean(fixedRowMatch),'fixed opening row contract missing');
const foundRowFields=JSON.parse(fixedRowMatch[1].replace(/'/g,'"'));
check(JSON.stringify(foundRowFields)===JSON.stringify(displayFields),'fixed opening dashboard row order differs from owner approval');
check(layoutSource.includes('opening_dashboard_fields:'),'opening dashboard manifest field contract missing');

check(script.privacy_status === 'private', 'video must be private');
console.log(JSON.stringify({target_date:date,scenes:script.scenes.length,narration_chars:chars,status:'PASS'}));
