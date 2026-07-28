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
  '.fear-greed-table{min-width:680px;table-layout:fixed}',
  '.fear-greed-table{min-width:760px;table-layout:fixed}',
  'Fear and Greed table width'
);
replaceOnce(
  '.fear-greed-table{min-width:640px}',
  '.fear-greed-table{min-width:700px}',
  'Fear and Greed mobile table width'
);
replaceRegex(
  /^    function fearGreedHistoricalRows\(\)\{.*\}$/m,
  "    function fearGreedHistoricalRows(){const rows=cnnFearGreed?.fear_and_greed_historical?.data;return Array.isArray(rows)?rows.map(item=>({timestamp:Number(item?.x),score:Number(item?.y),rating:String(item?.rating||'')})).filter(item=>Number.isFinite(item.timestamp)&&Number.isFinite(item.score)).sort((a,b)=>b.timestamp-a.timestamp).slice(0,50):[];}",
  'Fear and Greed history parser'
);
replaceRegex(
  /^    function showFearGreedHistory\(\)\{.*\}$/m,
  "    function showFearGreedHistory(){activeListView='fearGreed';activeQuickFilter='';selectedConceptId='';selectedElectronicsId='';renderKpis();renderConceptRows();document.getElementById('stockControls').style.display='none';setListTableClass('fear-greed-table');document.getElementById('listHead').innerHTML='<tr><th>時間（紐約）</th><th>Fear & Greed 分數</th><th>Rating</th><th>較前一期增減</th><th>較前一期增減（%）</th></tr>';const rows=fearGreedHistoricalRows();const sourceRows=cnnFearGreed?.fear_and_greed_historical?.data;const current=cnnFearGreed?.fear_and_greed||{};document.getElementById('stockListTitle').textContent='CNN Fear & Greed Index 歷史資料（最新 50 筆）';document.getElementById('filterNote').textContent=rows.length?`最新來源時間 ${current.timestamp||'NA'}；顯示 ${rows.length.toLocaleString()} / ${Array.isArray(sourceRows)?sourceRows.length.toLocaleString():rows.length.toLocaleString()} 筆`:'尚未產生 Fear & Greed 歷史資料';document.getElementById('stockRows').innerHTML=rows.length?rows.map((item,index)=>{const previous=rows[index+1];const change=fearGreedChange(item.score,previous?.score);const changeClass=change.amount>0?'bull':change.amount<0?'bear':'';return `<tr><td>${esc(formatFearGreedDate(item.timestamp))}</td><td>${fmt(item.score)}</td><td><span class=\"pill\">${esc(item.rating||'NA')}</span></td><td>${Number.isFinite(change.amount)?`<span class=\"pill ${changeClass}\">${signedValue(change.amount)}</span>`:'—'}</td><td>${Number.isFinite(change.percent)?`<span class=\"pill ${changeClass}\">${signedPct(change.percent)}</span>`:'—'}</td></tr>`;}).join(''):'<tr><td colspan=\"5\">目前沒有可顯示的 CNN Fear & Greed 歷史資料</td></tr>';document.querySelector('.wide:last-of-type')?.scrollIntoView({behavior:'smooth',block:'start'});}",
  'Fear and Greed history table'
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
console.log('Added CNN Fear and Greed historical ratings to dashboard.');
