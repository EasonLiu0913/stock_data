#!/usr/bin/env node
'use strict';
// Research narration DRAFT from staged dated facts; never promote to original final.
const fs=require('node:fs'),path=require('node:path');
function draft(root){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const raw=read('data_daily_gain_over_5/20261013.json');
 const facts=read('data_daily_gain_over_5/analysis-facts/20261013.json');
 const gate=read('research-mvp10-20261013-staging.json');
 if(raw.target_date!=='20261013'||raw.stock_count!==20||facts.stock_count!==20||
  facts.stocks.length!==20||gate.provisional_stock_count!==20||
  gate.analysis_final_rebuilt!==false||gate.render_authorized!==false||
  gate.source_date_classification_certified!==false)throw Error('STAGE_NOT_APPROVED_FOR_DRAFT');
 const ids=raw.stocks.map(x=>String(x.code));
 if(JSON.stringify(ids)!==JSON.stringify(facts.stocks.map(x=>String(x.code)))||
    new Set(ids).size!==20)throw Error('FACTS_AND_RAW_OUT_OF_SYNC');
 if(ids.some(x=>['1312A','6645','6924','7730','9103'].includes(x)))throw Error('EXCLUDED_NONORDINARY_SECURITY');
 const by=new Map(facts.stocks.map(x=>[String(x.code),x]));
 const pct=code=>'百分之'+Number(by.get(code).price.change_pct).toFixed(2);
 const stat=(code,key)=>{const v=by.get(code)?.flow?.[key]?.net_lots;
  return v==null?'尚無紀錄':v>0?'買超'+v+'張':v<0?'賣超'+Math.abs(v)+'張':'淨額持平';};
 const mg=code=>{const n=by.get(code)?.flow?.margin?.margin_delta;
  return n==null?'融資缺資料':n>0?'融資增加'+n+'張':n<0?'融資減少'+Math.abs(n)+'張':'融資持平';};
 const broker=code=>{const n=by.get(code)?.flow?.broker?.totals?.net;
  return n==null?'分點資料缺漏':n>0?'分點淨買'+n+'張':n<0?'分點淨賣'+Math.abs(n)+'張':'分點持平';};
 const groups=[[],['1312','6505','1710','1303','6668','3406','6834'],['6834'],['1312','6505','1710'],['3406','6668'],['1303','3311'],['6834','1312','3406','1303','6668','3311']];
 const count=(a,b)=>raw.stocks.filter(x=>x.change_pct>=a&&x.change_pct<b).length;
 const c1=count(9.5,Infinity),c2=count(7,9.5),c3=count(5,7);
 if(c1+c2+c3!==20)throw Error('BREADTH_MISMATCH');
 const scenes=[
  ['十月十三日｜20 檔普通股候選觀察','先正確界定交易範圍',
   '今天是十月十三日。本集先觀察二十檔上市普通股候選，並不是原始二十五檔證券全部照單全收。原始清單還包含創新板、存託憑證與特別股，因此需要另外確認交易日有效的證券分類。這二十檔之中，漲幅達百分之9.5以上有'+c1+'檔，百分之7到9.5有'+c2+'檔，其餘百分之5到7有'+c3+'檔。漲得快不代表利多一定成立，接下來要對照法人、融資、分點和成交量，避免把盤面熱度當成公司事件證明。',
   ['20 檔普通股候選','9.5% 以上 '+c1+'檔','7%–9.5% '+c2+'檔','5%–7% '+c3+'檔']],
  ['資金結構｜法人方向和融資槓桿','相同漲幅可能是完全不同的交易結構',
   '我們選幾檔具代表性的個股交叉比對。國喬漲幅'+pct('1312')+'，外資'+stat('1312','foreign')+'，但'+mg('1312')+'。台塑化則是外資'+stat('6505','foreign')+'，投信'+stat('6505','investment_trust')+'，方向並不一致。中揚光是外資'+stat('6668','foreign')+'，分點卻'+broker('6668')+'。這些例子證明不能用單一指標解釋整個強勢股清單。即使今天呈現上漲，市場資金結構仍然可能很分歧，隔天的承接仍需要重新驗證。',
   ['國喬 '+pct('1312'),'台塑化 '+pct('6505'),'中揚光 '+pct('6668')]],
  ['天二科技｜買盤與融資方向值得追蹤','外資買進，但成交量延續性要觀察',
   '天二科技，代號6834，當天漲幅'+pct('6834')+'。外資'+stat('6834','foreign')+'，分點統計'+broker('6834')+'，同時'+mg('6834')+'。外資買入與融資下降的組合值得注意，但它只是當天的交易結構，不是保證隔天繼續上漲的訊號。單日漲停並不能證明任何未公開的公司利多。下一個交易日要確認量能是否跟上，也要觀察外資買盤是否延續；如果價格漲幅大於後續成交量的支持，就應該把追價風險列在前面。',
   ['6834 '+pct('6834'),'外資 '+stat('6834','foreign'),mg('6834')]],
  ['國喬與台塑化｜追價資金並不相同','分辨外資、投信與融資的矛盾',
   '國喬當天上漲'+pct('1312')+'，外資'+stat('1312','foreign')+'，分點'+broker('1312')+'，但也出現'+mg('1312')+'。大量融資增加代表槓桿參與升高，不能只看到買超就忽略風險。反過來看台塑化，外資'+stat('6505','foreign')+'，投信'+stat('6505','investment_trust')+'；即使同屬塑化題材，兩種機構方向也不相同。東聯的外資'+stat('1710','foreign')+'，同時'+mg('1710')+'。今天能確認的是交易記錄，尚不能直接認定哪一項消息造成了上漲。',
   ['1312 '+pct('1312'),'6505 '+pct('6505'),'1710 '+pct('1710')]],
  ['玉晶光與中揚光｜光學股的訊號分歧','不要把分點淨買當成外資買超',
   '玉晶光當天漲幅'+pct('3406')+'，外資'+stat('3406','foreign')+'，投信'+stat('3406','investment_trust')+'，而'+mg('3406')+'。中揚光同樣強勢，漲幅'+pct('6668')+'，外資卻'+stat('6668','foreign')+'，分點是'+broker('6668')+'，並伴隨'+mg('6668')+'。券商分點資料反映交易通路，不能直接推論投資人身分，因此兩種買賣數字不應互相替代。短線光學族群是否延續，還要觀察個別股票的量價和融資，而不只是新聞題材的熱度。',
   ['3406 '+pct('3406'),'6668 '+pct('6668'),'外資與分點方向有別']],
  ['南亞與閎暉｜量價強勢也可能帶來波動','看見量能，也要同時看融資與分點',
   '南亞當日漲幅'+pct('1303')+'，外資'+stat('1303','foreign')+'，投信'+stat('1303','investment_trust')+'，同時'+mg('1303')+'。閎暉當日漲幅'+pct('3311')+'，外資'+stat('3311','foreign')+'，但是分點'+broker('3311')+'，而'+mg('3311')+'。這類價格強勢又伴隨槓桿變化的股票，需要特別分辨短線換手和長期基本面，不能靠一天的資金流向宣告催化已獲證實。後續觀察重點是外資、分點是否續買，以及高檔成交量縮減後價格能否維持。',
   ['1303 '+pct('1303'),'3311 '+pct('3311'),'聚焦量價與槓桿']],
  ['收盤整理｜三項下一交易日檢查','先看續買，再看槓桿，最後看量能',
   '整理這二十檔普通股候選研究，最重要的是證據與推測要分開。第一，觀察法人是否續買，尤其是天二科技和國喬的外資買盤。第二，檢查融資是否繼續擴張，例如國喬與東聯的追價槓桿，和天二科技融資下降是不同訊號。第三，回到成交量與價格結構，玉晶光、中揚光以及閎暉的高檔換手，都需要隔天新的交易紀錄才能驗證。所有這些只是十月十三日已知資料的追蹤方向，不是對隔天漲跌的保證，也不是投資買賣建議。感謝收看，我們下次繼續追蹤資金。',
   ['外資方向','融資風險','量價續航']]
 ];
 const output=scenes.map((s,i)=>({
  title:s[0],subtitle:s[1],narration:s[2],bullets:s[3],stock_codes:groups[i],
  footer:'10/13｜20檔候選研究｜尚未完成編輯驗收',
  research_review_status:'REQUIRES_SOURCE_AND_EDITORIAL_REAPPROVAL'
 }));
 const total=output.reduce((n,s)=>n+[...s.narration].length,0);
 if(total<1100||total>5500||output.some(x=>x.narration.length<75||
  x.stock_codes.some(c=>!by.has(c))))throw Error('DRAFT_SCENE_OR_LENGTH_INVALID:'+total);
 return {script:{
  schema_version:1,methodology_version:'chatgpt-video-script-v1',
  target_date:'20261013',source_summary_generated_at:null,
  stock_count:20,privacy_status:'private',scenes:output,
  research_only:true,editorial_approved:false,
  original_video_validator_pass:false,render_authorized:false,
  publication_authorized:false
 },review:{
  target_date:'20261013',stock_count:20,scene_count:7,narration_characters:total,
  date_effective_stock_classification_certified:false,
  original_final_market_summary_approved:false,
  original_video_validator_pass:false,regenerated_tts_exists:false,
  regenerated_srt_exists:false,regenerated_mp4_exists:false,
  render_authorized:false,publication_authorized:false,
  decision:'SEVEN_SCENE_QUANTITATIVE_RESEARCH_DRAFT_AWAITING_REVIEW'
 }};
}
if(require.main===module){
 const [root,out]=process.argv.slice(2);
 if(!root||!out)throw Error('Usage: node draft_mvp10_20261013_20stock_script.js ROOT OUTPUT_DIR');
 const x=draft(root);fs.mkdirSync(out,{recursive:true});
 for(const [name,v] of [['20261013-20stock-draft-script.json',x.script],
  ['20261013-20stock-draft-review.json',x.review]]){
  fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 }
 console.log(JSON.stringify(x.review));
}
module.exports={draft};
