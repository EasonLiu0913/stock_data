'use strict';
// Research only. Coverage is about independently documented issuer validity,
// not the existence of a price row or a verified market-wide common-stock master.
const fs=require('node:fs');
const {inspect,parseCsv}=require('./audit_twse_isin_category_snapshot');
const DATE='20261008';
const KNOWN=Object.freeze({
 '1589':{status:'SUSPENDED',from:'20260903',through:'20261008',source:'https://brks.twse.com.tw/t56sb18_htm.htm',proof:'official issuer announcement; later delisted 20261118'},
 '2323':{status:'SUSPENDED',from:'20261001',through:'20261008',source:'https://wwwc.twse.com.tw/en/announcement/announcement/list.html',proof:'TWSE notice 1150018275'},
 '4155':{status:'SUSPENDED',from:'20261007',through:'20261016',source:'https://m.moneydj.com/f1a.aspx?a=0302764f-53e1-4414-a52d-52058b635f44&c=MB06',proof:'secondary reproduction of 20260903 issuer disclosure; verify first-party original'}
});
function report({root='data_twse',known=KNOWN}={}){
 const integrity=inspect({root});
 const entries=[];
 for(const category of ['Stock','InnovationBoard']){
  const records=parseCsv(fs.readFileSync(root+'/twse_industry_'+category+'.csv'),category);
  for(const [code,name] of records){
   const e=known[code];const valid=!!e&&e.status==='SUSPENDED'&&e.from<=DATE&&e.through>=DATE;
   entries.push({code,name,category,as_of:DATE,evidence_status:valid?'DOCUMENTED_SUSPENSION':'UNVERIFIED_HISTORICAL_STATUS',
    source:valid?e.source:null,proof:valid?e.proof:null,
    common_stock_type_proven:false,listing_window_proven:false,quote_present:null});
  }
 }
 const documented=entries.filter(x=>x.evidence_status==='DOCUMENTED_SUSPENSION');
 const unresolved=entries.filter(x=>x.evidence_status==='UNVERIFIED_HISTORICAL_STATUS');
 return {date:DATE,snapshot_commit:integrity.snapshot_commit,source_integrity_verified:true,
   roster_count:entries.length,documented_exception_count:documented.length,
   unresolved_history_count:unresolved.length,historical_master_complete:false,
   publication_authorized:false,category_counts:Object.fromEntries(
      Object.entries(integrity.categories).filter(([k])=>['Stock','InnovationBoard'].includes(k)).map(([k,v])=>[k,v.count])),
   entries};
}
if(require.main===module){try{console.log(JSON.stringify(report(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={report,KNOWN};
