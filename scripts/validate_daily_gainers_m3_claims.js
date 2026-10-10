'use strict';
const banned=[/外資.{0,12}賣給.{0,8}散戶/,/產業.{0,12}(資金淨流入|法人買超)/,/全面(走空|翻多|崩盤)/,/證明.{0,10}(趨勢反轉|資金撤離)/,/35檔.{0,12}(全部|所有)普通股/];
function validate(ledger,phrases){
 if(ledger?.contract!=='M3-MARKET-REGIME-PHRASING-v1'||ledger.publication_authorized!==false||!Array.isArray(ledger.evidence))throw Error('INVALID_RESEARCH_LEDGER');
 if(!Array.isArray(phrases)||!phrases.length)throw Error('MISSING_CLAIMS');
 const ids=new Set(ledger.evidence.map(x=>x.id));
 for(const p of phrases){
  if(typeof p.text!=='string'||!Array.isArray(p.evidence_ids)||!p.evidence_ids.length||p.evidence_ids.some(id=>!ids.has(id)))throw Error('UNSUPPORTED_ASSERTION');
  if(banned.some(re=>re.test(p.text)))throw Error('OVERCONFIDENT_OR_UNSUPPORTED_PHRASING');
  if(p.publication_authorized!==false)throw Error('PREMATURE_PUBLICATION');
 }
 return {checked:phrases.length,publication_authorized:false};
}
module.exports={validate};
