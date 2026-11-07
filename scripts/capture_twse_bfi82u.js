'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function parseAmount(value){
  const n=Number(String(value).replaceAll(',','').trim());
  if(!Number.isSafeInteger(n)) throw new Error('INVALID_BFI82U_AMOUNT:'+value);
  return n;
}
function normalizeBfi82u(payload,date,rawText,sourceUrl){
  if(payload?.date!==date) throw new Error('BFI82U_DATE_MISMATCH');
  const table=(payload.tables||[]).find(x=>Array.isArray(x.fields)&&x.fields.includes('單位名稱')&&x.fields.includes('買進金額')&&x.fields.includes('賣出金額')&&x.fields.includes('買賣差額'));
  if(!table) throw new Error('BFI82U_SUMMARY_TABLE_MISSING');
  const rows=new Map(table.data.map(row=>[String(row[0]).trim(),row]));
  const item=(name)=>{const row=rows.get(name);if(!row)throw new Error('BFI82U_ROW_MISSING:'+name);const buy=parseAmount(row[1]),sell=parseAmount(row[2]),net=parseAmount(row[3]);if(buy-sell!==net)throw new Error('BFI82U_ROW_ARITHMETIC:'+name);return {buy_twd:buy,sell_twd:sell,net_twd:net};};
  const proprietary=item('自營商(自行買賣)'),hedging=item('自營商(避險)'),trust=item('投信'),foreign=item('外資及陸資(不含外資自營商)'),foreignDealer=item('外資自營商'),total=item('合計');
  const dealers={buy_twd:proprietary.buy_twd+hedging.buy_twd,sell_twd:proprietary.sell_twd+hedging.sell_twd,net_twd:proprietary.net_twd+hedging.net_twd};
  if(foreignDealer.net_twd!==0) throw new Error('FOREIGN_DEALER_DOUBLE_COUNT_POLICY_CHANGED');
  if(foreign.net_twd+trust.net_twd+dealers.net_twd!==total.net_twd) throw new Error('BFI82U_TOTAL_RECONCILIATION');
  return {schema_version:1,target_date:date,market:'TWSE',source:'TWSE BFI82U',source_url:sourceUrl,captured_at:new Date().toISOString(),unit:'TWD',capture_method:'official-json',raw_response_sha256:crypto.createHash('sha256').update(rawText).digest('hex'),raw_response:rawText,foreign,investment_trust:trust,dealers,dealers_components:{proprietary,hedging},foreign_dealer:foreignDealer,total};
}
async function capture(date,root=path.resolve(__dirname,'..')){
  if(!/^20\d{6}$/.test(date||'')) throw new Error('INVALID_DATE');
  const url=`https://www.twse.com.tw/rwd/zh/fund/BFI82U?dayDate=${date}&response=json&type=day`;
  const response=await fetch(url,{headers:{'user-agent':'TAIWAN-STOCK-official-market-opening/1.0','accept':'application/json'}});
  const rawText=await response.text();
  if(!response.ok) throw new Error(`BFI82U_HTTP_${response.status}`);
  let payload;try{payload=JSON.parse(rawText);}catch{throw new Error('BFI82U_INVALID_JSON');}
  const normalized=normalizeBfi82u(payload,date,rawText,url);
  const output=path.join(root,'data_twse_bfi82u',date+'_twse_bfi82u.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(normalized,null,2)+'\n');
  return {date,output:path.relative(root,output),raw_response_sha256:normalized.raw_response_sha256,total_net_twd:normalized.total.net_twd};
}
if(require.main===module) capture(process.argv[2]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('BFI82U_CAPTURE_FAILED:'+e.message);process.exitCode=1;});
module.exports={parseAmount,normalizeBfi82u,capture};
