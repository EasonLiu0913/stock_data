'use strict';
/**
 * TWSE-only daily breadth. Fail closed if the security master does not classify
 * every traded row. Caller supplies date-verified security master (never infer
 * common stock from stock code length or company name).
 */
function num(value) {
  const normalized=String(value??'').replace(/,/g,'').trim();
  if(!normalized || normalized==='--' || normalized==='—') return null;
  const n=Number(normalized);return Number.isFinite(n)?n:null;
}
function text(value){return String(value??'').replace(/<[^>]*>/g,'').trim();}
function direction(value) {
  const raw=String(value??'');
  const clean=text(raw).replace(/&nbsp;/gi,'').trim();
  if(clean==='+' || clean==='＋' || /漲/.test(clean)) return 1;
  if(clean==='-' || clean==='－' || /跌/.test(clean)) return -1;
  if(clean==='' || clean==='X') return 0;
  throw new Error('UNRECOGNIZED_PRICE_SIGN:'+raw);
}
function stockTable(payload){
 if(payload?.stat!=='OK')throw new Error('TWSE_RESPONSE_NOT_OK');
 const tables=(payload.tables||[]).filter(t=>Array.isArray(t.fields)&&Array.isArray(t.data));
 const table=tables.find(t=>['證券代號','收盤價','漲跌價差'].every(f=>t.fields.includes(f)));
 if(!table)throw new Error('TWSE_STOCK_TABLE_NOT_FOUND');
 return table;
}
function buildBreadth({payload,master,targetDate}){
 if(!/^20\d{6}$/.test(targetDate))throw new Error('INVALID_TARGET_DATE');
 if(payload.date!==targetDate)throw new Error('TWSE_SOURCE_DATE_MISMATCH');
 if(master.date!==targetDate || master.market!=='TWSE')throw new Error('SECURITY_MASTER_DATE_OR_MARKET_MISMATCH');
 if(!Array.isArray(master.securities) || !master.securities.length)throw new Error('SECURITY_MASTER_MISSING');
 const byCode=new Map();
 for(const sec of master.securities){
  if(!sec || typeof sec.code!=='string'||byCode.has(sec.code)||sec.market!=='TWSE'||!['COMMON_STOCK','OTHER'].includes(sec.security_type)||sec.classification_verified!==true)throw new Error('INVALID_MASTER_CLASSIFICATION');
  byCode.set(sec.code,sec);
 }
 const table=stockTable(payload), i=Object.fromEntries(table.fields.map((f,i)=>[f,i]));
 if(!master.source || master.source.as_of_date!==targetDate || master.source.digest_verified!==true)throw new Error('UNATTESTED_SECURITY_MASTER');
 const signIndex=table.fields.findIndex(f => /^漲跌(?:\(\+\/-\)|\(\+\/−\))$/.test(f));
 if(signIndex<0)throw new Error('MISSING_PRICE_SIGN_COLUMN');
 let advancers=0,decliners=0,unchanged=0,gainers_5pct_count=0,excluded=0,noTrade=0;
 const identities=[],seen=new Set();
 for(const row of table.data){
  const code=text(row[i['證券代號']]);
  if(!code)continue;
  if(seen.has(code))throw new Error('DUPLICATE_TWSE_CODE:'+code);
  seen.add(code);
  const sec=byCode.get(code);
  if(!sec)throw new Error('UNCLASSIFIED_TWSE_SECURITY:'+code);
  if(sec.security_type!=='COMMON_STOCK'){excluded++;continue;}
  identities.push({code,market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true});
  const close=num(row[i['收盤價']]),delta=num(row[i['漲跌價差']]);
  if(close===null||delta===null){noTrade++;continue;}
  const sign=direction(row[signIndex]);
  if(sign>0&&delta>0){advancers++; const prev=close-delta;if(prev<=0)throw new Error('INVALID_PREVIOUS_CLOSE:'+code);if(delta/prev*100>=5-1e-9)gainers_5pct_count++;}
  else if(sign<0&&delta>0)decliners++;
  else if(sign===0&&delta===0)unchanged++;
  else throw new Error('PRICE_SIGN_MISMATCH:'+code);
 }
 if(!identities.length)throw new Error('EMPTY_COMMON_STOCK_UNIVERSE');

 return {scope:'TWSE_COMMON_STOCK',advancers,decliners,unchanged,gainers_5pct_count,eligible_count:identities.length,no_trade_count:noTrade,excluded_non_common_count:excluded,identities};
}
module.exports={buildBreadth,stockTable};
