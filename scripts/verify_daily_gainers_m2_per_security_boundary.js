'use strict';
const assert=require('node:assert/strict');
/**
 * M2 market facts are aggregates. A stock-level 5% assertion MUST include its
 * own immutable dated MI_INDEX row, a verified same-date official ordinary-share
 * identity, and the untouched strict five-percent computation.
 */
function checkPerSecurityFivePercent(candidate){
 assert(candidate && typeof candidate==='object','missing per-security candidate');
 assert.equal(candidate.source,'TWSE_MI_INDEX_SECURITY_ROW','market aggregates cannot substitute security rows');
 assert.match(candidate.date||'',/^20\d{6}$/);
 assert.match(candidate.stock_code||'',/^\d{4,6}$/);
 assert.equal(candidate.identity_source,'OFFICIAL_DATED_ORDINARY_STOCK_MASTER');
 assert.equal(candidate.identity_date,candidate.date,'identity date must match quote date');
 assert.equal(candidate.identity_verified,true,'ordinary-stock identity not independently verified');
 assert.equal(candidate.is_etf,false,'ETF is not ordinary stock');
 assert.equal(candidate.is_warrant,false,'warrant is not ordinary stock');
 assert.equal(candidate.is_suspended,false,'suspended security is not tradable');
 assert.equal(candidate.is_disposition,false,'disposition eligibility not verified');
 assert.equal(candidate.strict_price_rule_verified,true,'existing strict 5% checker must pass');
 assert.equal(typeof candidate.gain_percent,'number');
 assert(Number.isFinite(candidate.gain_percent) && candidate.gain_percent>=5,'below strict 5% threshold');
 return {stock_code:candidate.stock_code,date:candidate.date,independent_security_5pct_verified:true};
}
module.exports={checkPerSecurityFivePercent};
