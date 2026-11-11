#!/usr/bin/env node
'use strict';

// Date-scoped inventory for [06] historical market-environment repair.
// Read-only: production [03] gates remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const {ROOT, readJson, sha256, latestDatedFileInDirectories, primaryExternalValidation,
  loadTwseHistory, loadFuturesHistory} = require('./market_environment_lib');
const {validateStockUniverse} = require('./verify_market_environment');
const {expectedUsMarketDate} = require('./generate_market_environment');
const {normalizeIsoDate, isTradingDate, loadHolidaySet, addDays, previousTradingDate} = require('./resolve_forecast_dates');

function exists(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) && fs.statSync(file).size > 0;
}
function snapshotStatus(date, baseDate) {
  const rel = `data_market_environment/${date}/market_environment.json`;
  if (!exists(rel)) return {status:'missing'};
  try {
    const payload = readJson(path.join(ROOT,rel), {});
    const {snapshot_hash, ...withoutHash} = payload;
    if (payload.forecast_date_compact !== date || payload.base_trade_date_compact !== baseDate
      || payload.mode !== 'shadow' || payload.environment?.code === 'data_invalid'
      || !['fresh','holiday_adjusted','historical_reconstructed'].includes(payload.data_freshness?.status)
      || !snapshot_hash || sha256(withoutHash) !== snapshot_hash) {
      return {status:'invalid',reason:'date, mode, freshness or hash validation failed'};
    }
    return {status:'present',historical_reconstruction: Boolean(payload.historical_reconstruction)};
  } catch(error) {return {status:'invalid',reason:error.message};}
}
function actualStatus(date) {
  const rel=`data_market_environment/${date}/actual_market_environment.json`;
  if(!exists(rel))return 'missing';
  try {
    const payload=readJson(path.join(ROOT,rel),null);
    return payload?.replay_date===date && typeof payload?.actual_environment?.code==='string'
      && payload?.source_files?.replay_summary ? 'present' : 'invalid';
  }catch {return 'invalid';}
}
function sourceReadiness(baseDate) {
  const issues = [];
  try {validateStockUniverse(baseDate);} catch(error) {issues.push({dataset:'sma',date:baseDate,reason:error.message});}
  if (!loadTwseHistory(baseDate).some(row=>row.date===baseDate && Number.isFinite(row.close)))
    issues.push({dataset:'twse',date:baseDate,reason:'exact base-date TWSE index unavailable'});
  if (!loadFuturesHistory(baseDate).some(row=>row.date===baseDate && Number.isFinite(row.net_contracts)))
    issues.push({dataset:'futures',date:baseDate,reason:'exact base-date TAIFEX futures unavailable'});
  const usDate=expectedUsMarketDate(baseDate);
  const external=latestDatedFileInDirectories(path.join(ROOT,'data_external_market'),baseDate,'external_market_indicators.json');
  const risk=latestDatedFileInDirectories(path.join(ROOT,'data_market_risk'),baseDate,'market_risk_snapshot.json');
  const primary=external ? primaryExternalValidation(external.payload,usDate) : null;
  if (!external || !risk || !primary?.complete || primary.actual_date!==usDate
    || primary.collection_date!==usDate || (risk?.payload?.market_risk_score == null || !Number.isFinite(Number(risk.payload.market_risk_score)))) {
    issues.push({dataset:'external',date:usDate,reason:'exact US market indicators or market-risk snapshot incomplete'});
  }
  return issues;
}
function plan(startCompact,endCompact,force=false,generateActual=true) {
  const start=normalizeIsoDate(startCompact),end=normalizeIsoDate(endCompact),holidays=loadHolidaySet();
  if (!start || !end || start>end || startCompact.length!==8 || endCompact.length!==8)
    throw new Error('Expected valid YYYYMMDD start/end range');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
    .format(new Date());
  if (end>today) throw new Error('Historical backfill cannot include future Taiwan dates');
  const items=[],recoveries=new Map();
  for(let date=start;date<=end;date=addDays(date,1)){
    if(!isTradingDate(date,holidays))continue;
    const forecastDate=date.replaceAll('-','');
    const baseDate=previousTradingDate(date,holidays).replaceAll('-','');
    const forecast=snapshotStatus(forecastDate,baseDate);
    const actualRel=`data_market_environment/${forecastDate}/actual_market_environment.json`;
    const actual=actualStatus(forecastDate);
    const requiresForecast=force || forecast.status!=='present';
    const issues=requiresForecast?sourceReadiness(baseDate):[];
    const replay=exists(`data_predictions/${forecastDate}/replay-summary.json`)
      && exists(`data_predictions/${forecastDate}/replay-dashboard.json`);
    const prediction=exists(`data_predictions/${forecastDate}/summary.json`);
    const actualBlocked=generateActual && actual!=='present' && (!replay || !prediction);
    if (requiresForecast)for(const issue of issues)recoveries.set(`${issue.dataset}:${issue.date}`,issue);
    items.push({forecast_date:forecastDate,base_date:baseDate,forecast,actual,
      build_forecast:requiresForecast && issues.length===0 && (forecast.status!=='invalid' || force),
      build_actual:generateActual && actual==='missing' && replay && prediction && issues.length===0 && !(forecast.status==='invalid'&&!force) && !(actual==='invalid'&&!force)
        && (forecast.status==='present' || requiresForecast),
      blocked:issues.length>0 || actualBlocked || (forecast.status==='invalid'&&!force) || (actual==='invalid'&&!force&&generateActual),
      issues,
      actual_issue:actualBlocked?'missing replay-summary, replay-dashboard or prediction summary':null,
      invalid_existing:forecast.status==='invalid'&&!force});
  }
  return {schemaVersion:1,range:{start:startCompact,end:endCompact},force,generate_actual:generateActual,
    selected_trading_dates:items.length,items,recoveries:[...recoveries.values()]};
}
if(require.main===module){
  try {
    const [start,end,force='false',actual='true']=process.argv.slice(2);
    process.stdout.write(JSON.stringify(plan(start,end,force==='true',actual!=='false'),null,2)+'\n');
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
module.exports={plan,snapshotStatus,actualStatus,sourceReadiness};
