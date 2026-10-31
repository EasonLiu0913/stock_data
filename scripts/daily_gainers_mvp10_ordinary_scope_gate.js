'use strict';
// Strict minimum verified ordinary-share exclusion; research MVP10 candidate path only.
// Other names, including -KY and -創, require authoritative date-bound classification
// and are NOT classified by this helper.
function assertNoDepositaryReceipts(raw, script) {
  if (!raw || !Array.isArray(raw.stocks)) throw new Error('Missing source stock universe');
  const excluded=raw.stocks.filter(x=>typeof x.name==='string' && /(?:[-－])DR\s*$/i.test(x.name));
  if (!excluded.length) return {checked:raw.stocks.length,excluded_depositary_receipts:0};
  const codes=new Set(excluded.map(x=>String(x.code)));
  const scenes=(script?.scenes||[]).flatMap((s,i)=>(s.stock_codes||[]).filter(code=>codes.has(String(code))).map(code=>i+1));
  throw new Error('Non-ordinary DR security in TWSE common-stock candidate: '+excluded.map(x=>x.code+' '+x.name).join('; ')+'; referenced_scene_numbers='+[...new Set(scenes)].join(',')+'; regenerate date-aligned raw/analysis/script, do not silently filter');
}
module.exports={assertNoDepositaryReceipts};
