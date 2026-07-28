#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'public', 'prediction-dashboard.html');
let html = fs.readFileSync(FILE, 'utf8');

function replaceOnce(search, replacement, label) {
  if (!html.includes(search)) throw new Error(`Missing patch target: ${label}`);
  html = html.replace(search, replacement);
}

function replaceRegex(regex, replacement, label) {
  if (!regex.test(html)) throw new Error(`Missing patch target: ${label}`);
  html = html.replace(regex, replacement);
}

replaceOnce(
  '.futures-table{min-width:940px;table-layout:fixed}.futures-table th,.futures-table td{text-align:right}.futures-table th:first-child,.futures-table td:first-child{text-align:left;width:118px}',
  '.futures-table{min-width:940px;table-layout:fixed}.futures-table th,.futures-table td{text-align:right}.futures-table th:first-child,.futures-table td:first-child{text-align:left;width:118px}.fear-greed-table{min-width:680px;table-layout:fixed}.fear-greed-table th,.fear-greed-table td{text-align:right}.fear-greed-table th:first-child,.fear-greed-table td:first-child{text-align:left;width:190px}',
  'Fear and Greed table CSS'
);

replaceOnce(
  '.futures-table{min-width:840px}',
  '.futures-table{min-width:840px}.fear-greed-table{min-width:640px}',
  'Fear and Greed mobile table CSS'
);

replaceOnce(
  "    let dashboard, marketNews=null, marketRisk=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[];",
  "    let dashboard, marketNews=null, marketRisk=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[], cnnFearGreed=null;",
  'dashboard globals'
);

replaceRegex(
  /^    async function loadDashboard\(\)\{.*\}$/m,
  "    async function loadDashboard(){const m=await fetch('../data_predictions/manifest.json').then(r=>r.json());currentDate=params.get('date')||m.latest_date||m.forecast_date_compact;const summaryPath=currentDate===m.latest_date&&m.latest_summary?m.latest_summary:`data_predictions/${currentDate}/summary.json`;dashboard=await fetch(`../${summaryPath}`).then(r=>{if(!r.ok)throw new Error(`找不到 ${summaryPath}`);return r.json();});await Promise.all([loadMarketNews(),loadClassLists(),loadOilPrices(),loadFuturesOpenInterest(),loadCnnFearGreed()]);init(m);}",
  'loadDashboard'
);

replaceOnce(
  '    function withDate(file){return `${file}?date=${encodeURIComponent(currentDate)}`;}',
  `    async function loadCnnFearGreed(){const manifest=await fetchJsonOrNull('data_cnn_fear_and_greed/manifest.json');let file=manifest?.latest_file||'';if(!file){const files=await fetchJsonOrNull('data_cnn_fear_and_greed/files.json');file=Array.isArray(files)&&files.length?\`data_cnn_fear_and_greed/\${[...files].sort((a,b)=>b.localeCompare(a))[0]}\`:'';}cnnFearGreed=file?await fetchJsonOrNull(file):null;}
    function withDate(file){return \`\${file}?date=\${encodeURIComponent(currentDate)}\`;}`,
  'loadCnnFearGreed insertion'
);

replaceOnce(
  '    function futuresContractsChange(current,previous){if(!current||!previous)return{amount:null,percent:null};const amount=current.netContracts-previous.netContracts;const percent=previous.netContracts===0?null:amount/Math.abs(previous.netContracts)*100;return{amount,percent};}',
  `    function futuresContractsChange(current,previous){if(!current||!previous)return{amount:null,percent:null};const amount=current.netContracts-previous.netContracts;const percent=previous.netContracts===0?null:amount/Math.abs(previous.netContracts)*100;return{amount,percent};}
    function fearGreedChange(current,previous){if(!Number.isFinite(current)||!Number.isFinite(previous))return{amount:null,percent:null};const amount=current-previous;const percent=previous===0?null:amount/Math.abs(previous)*100;return{amount,percent};}
    function fearGreedHistoricalRows(){const rows=cnnFearGreed?.fear_and_greed_historical?.data;return Array.isArray(rows)?rows.map(item=>({timestamp:Number(item?.x),score:Number(item?.y)})).filter(item=>Number.isFinite(item.timestamp)&&Number.isFinite(item.score)).sort((a,b)=>b.timestamp-a.timestamp).slice(0,50):[];}
    function formatFearGreedDate(timestamp){if(!Number.isFinite(timestamp))return 'NA';return new Intl.DateTimeFormat('zh-TW',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(timestamp));}`,
  'Fear and Greed helpers'
);

replaceRegex(
  /^    function renderKpis\(\)\{.*\}$/m,
  "    function renderKpis(){const s=dashboard.market_summary;const mode=dashboard.market_summary.relative_strength_7d_market_return<0?'大盤跌勢抗跌':'大盤漲勢領漲';const confidence=marketConfidence();const wti=oilBenchmark('wti_spot');const brent=oilBenchmark('brent_spot');const oilSub=wti?`日 ${signedPct(wti.change_pct)}；5日 ${signedPct(wti.change_pct_5d)}；Brent ${Number.isFinite(brent?.latest_price)?brent.latest_price.toFixed(2):'NA'}`:'尚未產生油價資料';const latestFutures=futuresOpenInterest[0];const previousFutures=futuresOpenInterest[1];const latestFuturesChange=futuresContractsChange(latestFutures,previousFutures);const futuresValue=Number.isFinite(latestFutures?.netContracts)?latestFutures.netContracts.toLocaleString('zh-TW'):'NA';const futuresSub=latestFutures?(previousFutures?`${latestFutures.date}；較 ${previousFutures.date} ${signedPct(latestFuturesChange.percent)}`:`${latestFutures.date}；尚無前期資料`):'尚未產生外資未平倉資料';const fearGreed=cnnFearGreed?.fear_and_greed||{};const fearScore=Number(fearGreed.score);const fearPrevious=Number(fearGreed.previous_close);const fearChange=fearGreedChange(fearScore,fearPrevious);const fearValue=Number.isFinite(fearScore)?Math.round(fearScore).toLocaleString('zh-TW'):'NA';const fearSub=Number.isFinite(fearScore)?`rating: ${fearGreed.rating||'NA'}；較前一期 ${signedPct(fearChange.percent)}`:'尚未產生 Fear & Greed 資料';const cards=[{label:'總檔數',value:s.count.toLocaleString(),sub:'預測股票',filter:'all'},{label:'平均分數',value:fmt(s.average_direction_score),sub:'方向強度',filter:'all'},{label:'市場新聞',value:Number.isFinite(confidence)?fmt(confidence):'NA',sub:`${confidenceLabel(confidence)}；${marketNewsMode}；${(marketNews?.article_count??marketNews?.articles?.length??0).toLocaleString()} 則`,filter:'marketNews'},{label:'Fear & Greed Index',value:fearValue,sub:fearSub,filter:'fearGreed'},{label:'石油價格',value:wti?`WTI ${wti.latest_price.toFixed(2)}`:'NA',sub:oilSub,filter:'oilPrices'},{label:'外資未平倉淨口數',value:futuresValue,sub:futuresSub,filter:'futuresOpenInterest'},{label:'偏多比例',value:pct(s.bullish_ratio),sub:'偏多與中性偏多',filter:'bullish'},{label:'偏空比例',value:pct(s.bearish_ratio),sub:'偏空與中性偏空',filter:'bearish'},{label:'七日相對強勢',value:pct(s.relative_strength_7d_ratio),sub:mode,filter:'relative7d'},{label:'翻轉訊號',value:pct(s.reversal_ratio),sub:'MACD/KD/均線轉強',filter:'reversal'},{label:'站上20MA',value:pct(s.reclaim_sma20_ratio),sub:'由下轉上',filter:'reclaim20'},{label:'MACD轉強',value:pct(s.macd_bullish_ratio),sub:'交叉或柱狀翻正',filter:'macd'},{label:'KD轉強',value:pct(s.kd_bullish_ratio),sub:'黃金交叉或低檔轉折',filter:'kd'}];const specialFilters=['marketNews','fearGreed','oilPrices','futuresOpenInterest'];document.getElementById('kpis').innerHTML=cards.map(x=>{const tag=x.filter&&x.filter!=='all'&&!specialFilters.includes(x.filter)?`<span class=\"tag\">${quickFilters[x.filter].tag}</span>`:x.filter==='marketNews'?'<span class=\"tag\">新聞</span>':x.filter==='fearGreed'?'<span class=\"tag\">情緒</span>':x.filter==='oilPrices'?'<span class=\"tag\">油價</span>':x.filter==='futuresOpenInterest'?'<span class=\"tag\">期貨</span>':'';const active=(x.filter==='marketNews'&&activeListView==='news')||(x.filter==='fearGreed'&&activeListView==='fearGreed')||(x.filter==='oilPrices'&&activeListView==='oil')||(x.filter==='futuresOpenInterest'&&activeListView==='futures')||(x.filter&&x.filter!=='all'&&!specialFilters.includes(x.filter)&&activeQuickFilter===x.filter&&activeListView==='stocks')?' active':'';const onclick=x.filter==='all'?'clearQuickFilter()':x.filter==='marketNews'?'showMarketNews()':x.filter==='fearGreed'?'showFearGreedHistory()':x.filter==='oilPrices'?'showOilPrices()':x.filter==='futuresOpenInterest'?'showFuturesOpenInterest()':`toggleQuickFilter('${x.filter}')`;const attrs=x.filter?`button type=\"button\" onclick=\"${onclick}\" aria-pressed=\"${Boolean(active)}\"`:'div';return `<${attrs} class=\"card ${x.filter?'kpi-card':''}${active}\"><div class=\"label\">${x.label}</div><div class=\"value\">${x.value}</div><div class=\"sub\">${subLines(x.sub)}</div>${tag?`<div class=\"sub\">${tag}</div>`:''}</${x.filter?'button':'div'}>`;}).join('');}",
  'renderKpis'
);

replaceOnce(
  '    function showFuturesOpenInterest(){',
  `    function showFearGreedHistory(){activeListView='fearGreed';activeQuickFilter='';selectedConceptId='';selectedElectronicsId='';renderKpis();renderConceptRows();document.getElementById('stockControls').style.display='none';setListTableClass('fear-greed-table');document.getElementById('listHead').innerHTML='<tr><th>時間（紐約）</th><th>Fear & Greed 分數</th><th>較前一期增減</th><th>較前一期增減（%）</th></tr>';const rows=fearGreedHistoricalRows();const sourceRows=cnnFearGreed?.fear_and_greed_historical?.data;const current=cnnFearGreed?.fear_and_greed||{};document.getElementById('stockListTitle').textContent='CNN Fear & Greed Index 歷史資料（最新 50 筆）';document.getElementById('filterNote').textContent=rows.length?\`最新來源時間 \${current.timestamp||'NA'}；顯示 \${rows.length.toLocaleString()} / \${Array.isArray(sourceRows)?sourceRows.length.toLocaleString():rows.length.toLocaleString()} 筆\`:'尚未產生 Fear & Greed 歷史資料';document.getElementById('stockRows').innerHTML=rows.length?rows.map((item,index)=>{const previous=rows[index+1];const change=fearGreedChange(item.score,previous?.score);const changeClass=change.amount>0?'bull':change.amount<0?'bear':'';return \`<tr><td>\${esc(formatFearGreedDate(item.timestamp))}</td><td>\${fmt(item.score)}</td><td>\${Number.isFinite(change.amount)?\`<span class=\"pill \${changeClass}\">\${signedValue(change.amount)}</span>\`:'—'}</td><td>\${Number.isFinite(change.percent)?\`<span class=\"pill \${changeClass}\">\${signedPct(change.percent)}</span>\`:'—'}</td></tr>\`;}).join(''):'<tr><td colspan=\"4\">目前沒有可顯示的 CNN Fear & Greed 歷史資料</td></tr>';document.querySelector('.wide:last-of-type')?.scrollIntoView({behavior:'smooth',block:'start'});}
    function showFuturesOpenInterest(){`,
  'showFearGreedHistory insertion'
);

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Unable to extract dashboard script for syntax validation.');
const tempScript = path.join(ROOT, '.tmp-prediction-dashboard-script.js');
fs.writeFileSync(tempScript, scriptMatch[1], 'utf8');
const check = spawnSync(process.execPath, ['--check', tempScript], { encoding: 'utf8' });
fs.rmSync(tempScript, { force: true });
if (check.status !== 0) {
  throw new Error(`Dashboard JavaScript syntax check failed:\n${check.stderr || check.stdout}`);
}

fs.writeFileSync(FILE, html, 'utf8');
console.log('Applied CNN Fear and Greed dashboard patch.');
