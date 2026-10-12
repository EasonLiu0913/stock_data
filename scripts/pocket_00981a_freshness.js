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
module.exports={assertDate,expectedHoldingsDate,assertFreshHoldings,assertIndustryDate};
