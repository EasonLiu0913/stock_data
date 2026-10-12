'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const original=path.resolve(__dirname,'../generate_daily_gainers_over_5.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'video-recovery-exp03-'));
try {
 fs.mkdirSync(path.join(tmp,'scripts'));fs.mkdirSync(path.join(tmp,'data_fubon'));fs.mkdirSync(path.join(tmp,'data_daily_gain_over_5'));
 fs.copyFileSync(original,path.join(tmp,'scripts/generate_daily_gainers_over_5.js'));
 function sma(date,price){return {'2330':{StockName:'synthetic-test', [date.slice(0,4)+'/'+date.slice(4,6)+'/'+date.slice(6,8)]:{Price:price,Open:price,High:price,Low:price,Volume:1000}}};}
 fs.writeFileSync(path.join(tmp,'data_fubon/fubon_20261012_sma.json'),JSON.stringify(sma('20261012',100)));
 fs.writeFileSync(path.join(tmp,'data_fubon/fubon_20261013_sma.json'),JSON.stringify(sma('20261013',106)));
 const child=cp.spawnSync(process.execPath,['scripts/generate_daily_gainers_over_5.js','--date','20261013'],{cwd:tmp,encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 const output=JSON.parse(fs.readFileSync(path.join(tmp,'data_daily_gain_over_5/20261013.json'),'utf8'));
 assert.equal(output.target_date,'20261013');assert.equal(output.stock_count,1);assert.equal(output.stocks[0].code,'2330');assert.equal(output.stocks[0].change_pct,6);
 const index=JSON.parse(fs.readFileSync(path.join(tmp,'data_daily_gain_over_5/files.json'),'utf8'));assert.equal(index.latest_date,'20261013');
 assert.equal(fs.existsSync('data_daily_gain_over_5/20261013.json') && fs.realpathSync('data_daily_gain_over_5/20261013.json').startsWith(tmp),false);
 console.log('EXPERIMENT_03_DATA_ONLY_PASS: synthetic SMA -> actual list producer -> exact-date validated; output confined to temporary directory; no push/deploy');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
