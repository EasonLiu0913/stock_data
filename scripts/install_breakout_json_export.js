#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'public', 'three-day-breakout-institutional-report.html');
let html = fs.readFileSync(file, 'utf8');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Unable to patch ${label}: expected text not found`);
  return source.replace(before, after);
}

if (html.includes('id="exportJson"') && html.includes('function exportAnalysisJson()')) {
  console.log('JSON export is already installed.');
  process.exit(0);
}

html = replaceOnce(
  html,
  '    <button id="run">重新分析</button>',
  '    <button id="run">重新分析</button>\n    <button id="exportJson" type="button" disabled>匯出 JSON</button>',
  'export button'
);

const helpers = `
function exportedEvents(){
  const keyword=$('keyword').value.trim().toLowerCase(),sort=$('sort').value;
  const data=state.events.filter(event=>!keyword||\`${'${event.code}${event.name}'}\`.toLowerCase().includes(keyword));
  data.sort((a,b)=>sort==='score'
    ?b.score-a.score
    :sort==='institutional'
      ?(b.inst?.total??-Infinity)-(a.inst?.total??-Infinity)
      :sort==='volume'
        ?(b.volumeRatio??-Infinity)-(a.volumeRatio??-Infinity)
        :b.gain-a.gain);
  return data;
}

function scoreBreakdown(event){
  const institutional=event.inst?.complete
    ?Math.min(35,Math.max(0,event.inst.buyDays*7+(event.inst.total>0?8:0)))
    :0;
  const broker=event.broker?.complete
    ?Math.min(15,Math.max(0,event.broker.branches*1.5+(event.broker.net>0?5:0)))
    :0;
  const volume=event.volumeRatio
    ?Math.min(25,Math.max(0,(event.volumeRatio-1)*20))
    :0;
  const aboveSma5=event.aboveSma5?15:0;
  const preGain=event.preGain>0&&event.preGain<8?10:0;
  return{
    institutional:Number(institutional.toFixed(2)),
    broker:Number(broker.toFixed(2)),
    volume:Number(volume.toFixed(2)),
    above_sma5:aboveSma5,
    pre_event_gain:preGain,
    total:Number(event.score.toFixed(2))
  };
}

function exportColumnDefinitions(){
  return[
    {field:'stock_code',label:'代號',type:'string'},
    {field:'stock_name',label:'名稱',type:'string'},
    {field:'event_start_date',label:'起始日',type:'YYYYMMDD'},
    {field:'target_date',label:'達標日',type:'YYYYMMDD'},
    {field:'gain_days',label:'漲幅計算交易日',type:'integer',unit:'交易日'},
    {field:'gain_pct',label:'X 日漲幅',type:'number',unit:'%'},
    {field:'start_price',label:'起始價',type:'number',unit:'元'},
    {field:'target_price',label:'達標價',type:'number',unit:'元'},
    {field:'pre_event.lookback_dates',label:'起漲前回看日期',type:'string[]'},
    {field:'pre_event.gain_pct',label:'起漲前漲幅',type:'number',unit:'%'},
    {field:'pre_event.volume_ratio',label:'起漲前量能倍數',type:'number',unit:'倍'},
    {field:'pre_event.above_sma5',label:'起漲前是否站上 SMA5',type:'boolean|null'},
    {field:'institutional.total',label:'法人累積淨買',type:'number|null',unit:'張'},
    {field:'institutional.foreign',label:'外資累積淨買',type:'number|null',unit:'張'},
    {field:'institutional.trust',label:'投信累積淨買',type:'number|null',unit:'張'},
    {field:'institutional.dealer',label:'自營商累積淨買',type:'number|null',unit:'張'},
    {field:'institutional.buy_days',label:'法人買超天數',type:'integer|null',unit:'交易日'},
    {field:'broker.net',label:'券商集中累積淨買',type:'number|null'},
    {field:'broker.buy_branch_count',label:'主買分點數累積',type:'number|null'},
    {field:'score.total',label:'布局分數',type:'number',unit:'分'},
    {field:'score.breakdown',label:'布局分數拆解',type:'object'},
    {field:'data_quality',label:'資料完整度',type:'object'}
  ];
}

function exportAnalysisJson(){
  const events=exportedEvents();
  const allEvents=state.events;
  const filters={
    gain_days:state.gainDays,
    minimum_gain_pct:state.threshold,
    lookback_trade_days:state.lookback,
    minimum_volume_lots:Math.max(0,num($('minVolume').value)||0),
    keyword:$('keyword').value.trim(),
    sort:$('sort').value
  };
  const payload={
    schema_version:1,
    report_type:'multi_day_breakout_institutional_broker_analysis',
    generated_at:new Date().toISOString(),
    source_page:location.pathname,
    filters,
    event_definition:{
      description:\`連續 ${'${state.gainDays}'} 個可用交易日，第 ${'${state.gainDays}'} 日收盤相對第一日收盤累積漲幅至少 ${'${state.threshold}'}%。\`,
      formula:'(target_close / start_close - 1) * 100 >= minimum_gain_pct',
      target_offset:state.gainDays-1,
      pre_event_window:'事件起始日前 lookback_trade_days 個完整交易日'
    },
    data_sources:{
      price:'data_fubon/fubon_YYYYMMDD_sma.json',
      institutional:'data_normalized/institutional_investors/YYYYMMDD.json',
      broker:'data_normalized/broker_details/YYYYMMDD.json'
    },
    analysis_scope:{
      available_trade_date_count:state.dates.length,
      first_available_trade_date:state.dates[0]||null,
      last_available_trade_date:state.dates.at(-1)||null,
      all_matching_event_count:allEvents.length,
      exported_event_count:events.length,
      exported_unique_stock_count:new Set(events.map(event=>event.code)).size
    },
    scoring_model:{
      maximum_score:100,
      components:{
        institutional:{maximum:35,formula:'完整覆蓋時 min(35, 法人買超天數 * 7 + 法人累積淨買為正 ? 8 : 0)'},
        broker:{maximum:15,formula:'完整覆蓋時 min(15, 主買分點數累積 * 1.5 + 券商累積淨買為正 ? 5 : 0)'},
        volume:{maximum:25,formula:'min(25, max(0, (量能倍數 - 1) * 20))'},
        above_sma5:{maximum:15,formula:'起漲前最後一日收盤高於 SMA5 時加 15'},
        pre_event_gain:{maximum:10,formula:'起漲前漲幅大於 0% 且小於 8% 時加 10'}
      }
    },
    column_definitions:exportColumnDefinitions(),
    summary:{
      institutional_complete_event_count:events.filter(event=>event.inst?.complete).length,
      broker_complete_event_count:events.filter(event=>event.broker?.complete).length,
      high_score_event_count:events.filter(event=>event.score>=55).length
    },
    events:events.map(event=>({
      stock_code:event.code,
      stock_name:event.name,
      event_start_date:event.start,
      target_date:event.end,
      gain_days:event.gainDays||state.gainDays,
      gain_pct:Number(event.gain.toFixed(4)),
      start_price:event.startPrice,
      target_price:event.endPrice,
      pre_event:{
        lookback_days:event.preDates.length,
        lookback_dates:event.preDates,
        gain_pct:Number(event.preGain.toFixed(4)),
        volume_ratio:event.volumeRatio==null?null:Number(event.volumeRatio.toFixed(4)),
        above_sma5:event.aboveSma5
      },
      institutional:event.inst?{
        total:event.inst.total,
        foreign:event.inst.foreign,
        trust:event.inst.trust,
        dealer:event.inst.dealer,
        buy_days:event.inst.buyDays,
        available_days:event.inst.days,
        expected_days:event.inst.expected,
        complete:event.inst.complete
      }:null,
      broker:event.broker?{
        net:event.broker.net,
        buy_branch_count:event.broker.branches,
        available_days:event.broker.days,
        branch_available_days:event.broker.branchDays,
        expected_days:event.broker.expected,
        complete:event.broker.complete
      }:null,
      score:{total:Number(event.score.toFixed(2)),breakdown:scoreBreakdown(event)},
      data_quality:{
        institutional_status:!event.inst?'missing':event.inst.complete?'complete':'partial',
        broker_status:!event.broker?'missing':event.broker.complete?'complete':'partial'
      }
    }))
  };
  const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const thresholdPart=String(state.threshold).replace('.','p');
  const filename=\`breakout-analysis_${'${state.gainDays}'}d_${'${thresholdPart}'}pct_${'${timestamp}'}.json\`;
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  $('status').textContent=\`已匯出 ${'${events.length}'} 個事件：${'${filename}'}\`;
}
`;

html = replaceOnce(
  html,
  'async function run(){',
  `${helpers}\nasync function run(){`,
  'export helpers'
);

html = replaceOnce(
  html,
  "async function run(){const button=$('run');button.disabled=true;",
  "async function run(){const button=$('run'),exportButton=$('exportJson');button.disabled=true;exportButton.disabled=true;",
  'run button state'
);

html = replaceOnce(
  html,
  'state.events=candidates;render();button.disabled=false}',
  'state.events=candidates;render();button.disabled=false;exportButton.disabled=false}',
  'enable export button'
);

html = replaceOnce(
  html,
  "$('run').addEventListener('click',run);",
  "$('run').addEventListener('click',run);$('exportJson').addEventListener('click',exportAnalysisJson);",
  'export event listener'
);

fs.writeFileSync(file, html, 'utf8');
console.log('Installed JSON export in public/three-day-breakout-institutional-report.html');
