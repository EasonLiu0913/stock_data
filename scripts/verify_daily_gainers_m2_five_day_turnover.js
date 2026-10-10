'use strict';
const fs=require('node:fs');
const path=require('node:path');
function verifyFiveDayTurnover(chart,checkpoint,target='20261008'){
 if(chart.endDate!==target||checkpoint.date!==target)throw Error('target date mismatch');
 if(chart.units?.turnover!=='TWD' && chart.units?.turnover!=='元')throw Error('turnover unit must be TWD');
 const rows=chart.data;
 if(!Array.isArray(rows))throw Error('missing chart rows');
 const dates=rows.filter(r=>r.date<target).map(r=>r.date).sort().slice(-5);
 if(dates.length!==5 || new Set(dates).size!==5 || JSON.stringify(dates)!==JSON.stringify(checkpoint.previous_five.dates))throw Error('five trading-day cutoff or sequence mismatch');
 const amounts=dates.map(d=>{
  const matches=rows.filter(r=>r.date===d);
  if(matches.length!==1||!Number.isSafeInteger(matches[0].turnover)||matches[0].turnover<0)throw Error('invalid or duplicate turnover '+d);
  return matches[0].turnover;
 });
 const average=amounts.reduce((a,b)=>a+b,0)/5;
 if(Math.abs(average-checkpoint.previous_five.mean_turnover_twd)>0.0001)throw Error('five-day average mismatch');
 const targetRows=rows.filter(r=>r.date===target);
 if(targetRows.length!==1||!Number.isSafeInteger(targetRows[0].turnover))throw Error('missing target turnover');
 return {date:target,dates,turnover_twd:amounts,mean_turnover_twd:average,target_turnover_twd:targetRows[0].turnover,source:'data_twse_market_chart/market_chart.json',status:'source_archive_crosscheck_only',publication_authorized:false};
}
module.exports={verifyFiveDayTurnover};
if(require.main===module){
 const chart=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_twse_market_chart/market_chart.json'),'utf8'));
 const cp=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-official-institution-industry-source-checkpoint.json'),'utf8'));
 console.log(JSON.stringify(verifyFiveDayTurnover(chart,cp),null,2));
}
