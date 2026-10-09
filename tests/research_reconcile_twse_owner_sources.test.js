'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseIsin,parseCompany,reconcile,roc,sha}=require('../scripts/research_reconcile_twse_owner_sources');
test('ROC dates cannot be mistaken for source acquisition timestamps',()=>{
 assert.equal(roc('115.09.22'),'20260922');assert.equal(roc('114.12.31'),'20251231');
 assert.equal(sha(Buffer.from('a')).length,64);
});
test('Big5-HTML parser only selects explicit Stocks section',()=>{
 const html='Date Stock Updated:2026/10/10<table><tr><td colspan="7">Stocks</td></tr><tr><td>1101 TCC</td><td>TW0001101004</td><td>1962/02/09</td><td>TWSE LISTED</td><td>Cement</td><td>ESVUFR</td><td></td></tr><tr><td colspan="7">ETF</td></tr><tr><td>0050 ETF</td><td>TW0000050004</td><td>2020/01/01</td><td>TWSE LISTED</td><td>ETF</td><td>CEOGEU</td><td></td></tr></table>';
 const parsed=parseIsin(Buffer.from(html));assert.equal(parsed.updated,'20261010');assert.equal(parsed.bySection.Stocks.length,1);assert.equal(parsed.bySection.ETF.length,1);
});
test('issuer report TDR extra and post-target ISIN must remain blocked',()=>{
 const isin={updated:'20261010',bySection:{Stocks:[{code:'1101',name:'TCC',isin:'TW0001101004',listed_date:'19620209',market:'TWSE LISTED',cfi:'ESVUFR'}]}};
 const company=parseCompany(Buffer.from(JSON.stringify([{出表日期:'1151008',公司代號:'1101',上市日期:'19620209'},{出表日期:'1151008',公司代號:'9103',公司簡稱:'DR'}])));
 const result=reconcile(isin,company,{data:[]},'20261008');
 assert.equal(result.company_extra.length,1);assert.equal(result.decision,'BLOCKED_DATE_EFFECTIVENESS');assert.equal(result.per_code[0].historical_effective_date_verified,false);
 assert.deepEqual(result.per_code[0].issues,['ISIN_POST_TARGET_SNAPSHOT']);
});
test('conflicting dates and nondefault CFI are flagged separately',()=>{
 const isin={updated:'20261010',bySection:{Stocks:[{code:'3673',listed_date:'20101029',market:'TWSE LISTED',cfi:'ESVTFR'}]}};
 const company=parseCompany(Buffer.from(JSON.stringify([{出表日期:'1151008',公司代號:'3673',上市日期:'20101030'}])));
 const r=reconcile(isin,company,{data:[['3673','','','','','','','','','115.10.08']]},'20261008');
 assert.equal(r.differences.length,1);assert.ok(r.differences[0].issues.includes('CFI_REQUIRES_INDEPENDENT_CLASSIFICATION'));
 assert.ok(r.differences[0].issues.includes('LISTING_DATE_CONFLICT'));
 assert.ok(r.differences[0].issues.includes('RECENT_LISTING_DATE_CONFLICT'));
});
