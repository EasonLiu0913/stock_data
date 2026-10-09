'use strict';
// Research only. Coverage is about independently documented issuer validity,
// not the existence of a price row or a verified market-wide common-stock master.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {stockTable}=require('./build_twse_common_stock_breadth');
const EXPECTED_MI_SHA='c93be0a5fae5a9aa4ee9a02c83e7a7354fb1a3e715a09cc0f2d3cfe7e76709a5';
function quoteCodes(quotePath,expectedSha=EXPECTED_MI_SHA){
 const bytes=fs.readFileSync(quotePath),sha=crypto.createHash('sha256').update(bytes).digest('hex');
 if(sha!==expectedSha)throw Error('QUOTE_ARCHIVE_DIGEST_MISMATCH');
 const payload=JSON.parse(bytes.toString('utf8'));
 if(payload.date!==DATE)throw Error('QUOTE_ARCHIVE_DATE_MISMATCH');
 const table=stockTable(payload),index=table.fields.indexOf('證券代號');
 const found=new Set();
 for(const row of table.data){
  const code=String(row[index]??'').replace(/<[^>]*>/g,'').trim();
  if(!code)continue;
  if(found.has(code))throw Error('DUPLICATE_QUOTE_CODE:'+code);
  found.add(code);
 }
 return {codes:found,sha256:sha,rows:table.data.length};
}
const {inspect,parseCsv}=require('./audit_twse_isin_category_snapshot');
const DATE='20261008';
const KNOWN=Object.freeze({
 '1589':{status:'SUSPENDED',from:'20260903',through:'20261008',source:'https://brks.twse.com.tw/t56sb18_htm.htm',proof:'official issuer announcement; later delisted 20261118'},
 '2323':{status:'SUSPENDED',from:'20261001',through:'20261008',source:'https://wwwc.twse.com.tw/en/announcement/announcement/list.html',proof:'TWSE notice 1150018275'},
 '4155':{status:'SUSPENDED',from:'20261007',through:'20261016',source:'https://m.moneydj.com/f1a.aspx?a=0302764f-53e1-4414-a52d-52058b635f44&c=MB06',proof:'secondary reproduction of 20260903 issuer disclosure; verify first-party original'}
});
function report({root='data_twse',known=KNOWN,quotePath=null,expectedQuoteSha=EXPECTED_MI_SHA}={}){
 const quote=quotePath?quoteCodes(quotePath,expectedQuoteSha):null;
 const integrity=inspect({root});
 const entries=[];
 for(const category of ['Stock','InnovationBoard']){
  const records=parseCsv(fs.readFileSync(root+'/twse_industry_'+category+'.csv'),category);
  for(const [code,name] of records){
   const e=known[code];const valid=!!e&&e.status==='SUSPENDED'&&e.from<=DATE&&e.through>=DATE;
   entries.push({code,name,category,as_of:DATE,evidence_status:valid?'DOCUMENTED_SUSPENSION':'UNVERIFIED_HISTORICAL_STATUS',
    source:valid?e.source:null,proof:valid?e.proof:null,
    common_stock_type_proven:false,listing_window_proven:false,quote_present:quote?quote.codes.has(code):null});
  }
 }
 const documented=entries.filter(x=>x.evidence_status==='DOCUMENTED_SUSPENSION');
 const unresolved=entries.filter(x=>x.evidence_status==='UNVERIFIED_HISTORICAL_STATUS');
 const present=entries.filter(x=>x.quote_present===true).length;
 const absent=entries.filter(x=>x.quote_present===false);
 if(quote && (present+absent.length!==entries.length || absent.some(x=>x.evidence_status!=='DOCUMENTED_SUSPENSION')))throw Error('UNEXPLAINED_QUOTE_ABSENCE');
 return {date:DATE,snapshot_commit:integrity.snapshot_commit,source_integrity_verified:true,
   quote_join_performed:!!quote,quote_archive_sha256:quote?.sha256??null,
   quote_table_rows:quote?.rows??null,quote_present_count:quote?present:null,
   quote_absent_count:quote?absent.length:null,absent_codes:quote?absent.map(x=>x.code):null,
   roster_count:entries.length,documented_exception_count:documented.length,
   unresolved_history_count:unresolved.length,historical_master_complete:false,
   publication_authorized:false,category_counts:Object.fromEntries(
      Object.entries(integrity.categories).filter(([k])=>['Stock','InnovationBoard'].includes(k)).map(([k,v])=>[k,v.count])),
   entries};
}
if(require.main===module){try{console.log(JSON.stringify(report(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={report,KNOWN,quoteCodes,EXPECTED_MI_SHA};
