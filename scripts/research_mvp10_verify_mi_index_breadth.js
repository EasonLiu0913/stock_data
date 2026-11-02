#!/usr/bin/env node
'use strict';
// Isolated research-only TWSE MI_INDEX source validator; never authorizes upload/publication.
// Distinguishes the official "股票" column from the "整體市場" all-securities column.
const fs=require('node:fs');
const crypto=require('node:crypto');
const PRICE_TITLE='115年10月13日 價格指數(臺灣證券交易所)';
const TOTAL_TITLE='115年10月13日 大盤統計資訊';
const BREADTH_TITLE='漲跌證券數合計';
const DAILY_TITLE='115年10月13日 每日收盤行情(全部)';
const TARGET_DATE='20261013';
function fail(label){throw Error('MI_INDEX_FAIL_CLOSED_'+label)}
function number(s){if(typeof s!=='string'||!/^\d{1,3}(?:,\d{3})*$|^\d+$/.test(s))fail('INVALID_INTEGER');return Number(s.replace(/,/g,''))}
function count(s){
 const m=String(s).match(/^([\d,]+)(?:\(([\d,]+)\))?$/);
 if(!m)fail('INVALID_BREADTH_CELL');
 return {count:number(m[1]),...(m[2]?{limit_count:number(m[2])}:{})};
}
function choose(json,title,fields){
 const x=json.tables?.filter(t=>t.title===title)||[];
 if(x.length!==1||JSON.stringify(x[0].fields)!==JSON.stringify(fields)||!Array.isArray(x[0].data))fail('UNEXPECTED_TABLE_'+title);
 return x[0];
}
function extract(json,audit){
 if(json.stat!=='OK'||json.date!==TARGET_DATE||json.params?.date!==TARGET_DATE||
    json.params.action!=='MI_INDEX'||json.params.type!=='ALL'||json.params.response!=='json')fail('SOURCE_IDENTITY');
 const f=['類型','整體市場','股票'];
 const t=choose(json,BREADTH_TITLE,f);
 const index=new Map(t.data.map(r=>[r[0],r]));
 if(index.size!==5||t.data.length!==5)fail('BREADTH_KEYS');
 const rows={up:'上漲(漲停)',down:'下跌(跌停)',flat:'持平',no_trade:'未成交',no_reference:'無比價'};
 const breadth={stock_column:{},whole_securities_column:{}};
 for(const [key,label] of Object.entries(rows)){
  const row=index.get(label);
  if(!row||row.length!==3)fail('BREADTH_ROW_'+key);
  for(const [col,ix] of [['stock_column',2],['whole_securities_column',1]]){
   const c=count(row[ix]);
   breadth[col][key]=c.count;
   if(c.limit_count!==undefined)breadth[col][key==='up'?'limit_up':'limit_down']=c.limit_count;
   if(['up','down'].includes(key)&&c.limit_count===undefined)fail('LIMIT_COUNT_MISSING');
   if(!['up','down'].includes(key)&&c.limit_count!==undefined)fail('UNEXPECTED_LIMIT');
  }
 }
 const totals=choose(json,TOTAL_TITLE,['成交統計','成交金額(元)','成交股數(股)','成交筆數']);
 const overall=totals.data.filter(r=>r[0]==='總計(1~15)');
 const securities=totals.data.filter(r=>r[0]==='證券合計(1+6+14+15)');
 if(overall.length!==1||securities.length!==1)fail('TOTALS_IDENTITY');
 const totalTwd=number(overall[0][1]);
 const securitiesTwd=number(securities[0][1]);
 const daily=choose(json,DAILY_TITLE,['證券代號','證券名稱','成交股數','成交筆數','成交金額','開盤價','最高價','最低價','收盤價','漲跌(+/-)','漲跌價差','最後揭示買價','最後揭示買量','最後揭示賣價','最後揭示賣量','本益比']);
 const sum=o=>o.up+o.down+o.flat+o.no_trade+o.no_reference;
 breadth.stock_column.total=sum(breadth.stock_column);
 breadth.whole_securities_column.total=sum(breadth.whole_securities_column);
 if(breadth.whole_securities_column.total!==daily.data.length||breadth.stock_column.total>=breadth.whole_securities_column.total||
    breadth.stock_column.limit_up>breadth.stock_column.up||breadth.stock_column.limit_down>breadth.stock_column.down)fail('BREADTH_TOTAL');
 const price=choose(json,PRICE_TITLE,['指數','收盤指數','漲跌(+/-)','漲跌點數','漲跌百分比(%)','特殊處理註記']);
 const weighted=price.data.filter(r=>r[0]==='發行量加權股價指數');
 if(weighted.length!==1||!String(weighted[0][2]).includes('green')||
    !String(weighted[0][2]).includes('-'))fail('WEIGHTED_INDEX');
 const close=Number(weighted[0][1].replace(/,/g,''));
 const fall=Number(weighted[0][3].replace(/,/g,''));
 const pct=Number(weighted[0][4]);
 const expected=audit.breadth;
 if(expected.status!=='MI_INDEX_PERSISTED_ORIGINAL_TABLE_RECONCILED_NOT_HTTP_CERTIFIED'||
    JSON.stringify(breadth.stock_column)!==JSON.stringify(expected.stock_column)||
    JSON.stringify(breadth.whole_securities_column)!==JSON.stringify(expected.whole_securities_column)||
    totalTwd!==audit.turnover.mi_index_total_twd||securitiesTwd!==audit.turnover.mi_index_stock_securities_subtotal_twd||
    close!==audit.index.close||-fall!==audit.index.change_points||pct!==audit.index.change_pct||
    audit.evidence_status!=='MI_INDEX_STOCK_BREADTH_RECONCILED_INSTITUTIONS_PARTIAL'||
    audit.institutions.total_amount_twd!==null||audit.publication_authorized!==false)fail('AUDIT_RECONCILIATION');
 return {target_date:TARGET_DATE,verified_tables:[PRICE_TITLE,TOTAL_TITLE,BREADTH_TITLE,DAILY_TITLE],
  stock:breadth.stock_column,whole_securities:breadth.whole_securities_column,
  weighted_index:{close,change_points:-fall,change_pct:pct},
  turnover_twd:totalTwd,securities_subtotal_twd:securitiesTwd,
  source_http_receipt_verified:false,institutional_BFI82U_amounts_verified:false,
  owner_locked_dashboard_version:audit.dashboard_version,publication_authorized:false,source_editorial_approved:false};
}
function main(){
 const [src,auditPath,out]=process.argv.slice(2);
 if(!src||!auditPath||!out)fail('USAGE');
 const bytes=fs.readFileSync(src),audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
 const result=extract(JSON.parse(bytes.toString('utf8')),audit);
 result.source_file=src;
 result.source_sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('MI_INDEX_RESEARCH_BREADTH_RECONCILIATION_PASS',JSON.stringify({stock:result.stock,all_securities:result.whole_securities,source_sha256:result.source_sha256}));
}
if(require.main===module)main();
module.exports={extract};
