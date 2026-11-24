'use strict';
function assertDate(value,label='date') {
  const s=String(value||'');
  if (!/^\d{8}$/.test(s)) throw new Error(label+' invalid: '+s);
  const y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8);
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==m||dt.getUTCDate()!==d) throw new Error(label+' invalid calendar date: '+s);
  return s;
}
function expectedHoldingsDate(today, override='') {
  let date=assertDate(today,'Taipei date');
  if(override) {
    const chosen=assertDate(override,'POCKET_EXPECTED_HOLDINGS_DATE');
    if(chosen>date) throw new Error('Expected holdings date cannot be in the future');
    return chosen;
  }
  const dt=new Date(Date.UTC(+date.slice(0,4),+date.slice(4,6)-1,+date.slice(6,8)));
  while(dt.getUTCDay()===0||dt.getUTCDay()===6) dt.setUTCDate(dt.getUTCDate()-1);
  return dt.toISOString().slice(0,10).replace(/-/g,'');
}
function resolveTarget({createdAt, schedule='', override=''}) {
  const instant=new Date(createdAt);
  if(!Number.isFinite(instant.getTime())) throw new Error('Invalid run created_at');
  const taipei=new Date(instant.getTime()+8*3600000);
  const compact=d=>d.toISOString().slice(0,10).replace(/-/g,'');
  const today=compact(taipei);
  const {getTradingDayStatus}=require('./lib/twse_trading_day');
  const trading=date=>{
    const s=getTradingDayStatus(date);
    if(!s.calendarCovered) throw new Error('TWSE calendar uncovered: '+date);
    return s.isTradingDay;
  };
  if(override) {
    const target=expectedHoldingsDate(today,override);
    if(!trading(target)) throw new Error('Explicit target is not a trading day: '+target);
    return target;
  }
  let cursor=new Date(taipei);
  if(schedule) {
    const m=/^(\d{1,2}) (\d{1,2}) \* \* 1-5$/.exec(schedule);
    if(!m || +m[1]>59 || +m[2]>15) throw new Error('Unsupported Pocket schedule: '+schedule);
    cursor.setUTCHours(+m[2]+8,+m[1],0,0);
    if(cursor>taipei) cursor.setUTCDate(cursor.getUTCDate()-1);
    while([0,6].includes(cursor.getUTCDay())) cursor.setUTCDate(cursor.getUTCDate()-1);
  } else if(taipei.getUTCHours()*60+taipei.getUTCMinutes()<810) {
    cursor.setUTCDate(cursor.getUTCDate()-1);
  }
  for(let i=0;i<31;i++,cursor.setUTCDate(cursor.getUTCDate()-1)) {
    const date=compact(cursor);
    if(trading(date)) return date;
  }
  throw new Error('No covered trading date within 31 days');
}
function assertFreshHoldings(summary, rows, expected) {
  const target=assertDate(expected,'expected holdings date');
  const actual=assertDate(summary?.date,'Pocket holdings date');
  if(!Array.isArray(rows)||rows.length===0||summary.totalRows!==rows.length) throw new Error('Pocket holdings empty or row count mismatch');
  for(const row of rows) if(assertDate(row.date,'holding row date')!==actual) throw new Error('Pocket holdings mixed row dates');
  if(actual!==target) throw new Error('STALE_HOLDINGS: expected '+target+', received '+actual+'; no latest or update marker written');
  return actual;
}
function assertIndustryDate(summary, holdingsDate) {
  const date=assertDate(summary?.date,'Pocket industry date');
  if(date>assertDate(holdingsDate,'holdings date')) throw new Error('Pocket industry date is later than holdings date');
  if(!(summary.totalRows>0)) throw new Error('Pocket industry data empty');
  return date;
}
module.exports={assertDate,expectedHoldingsDate,resolveTarget,assertFreshHoldings,assertIndustryDate};
