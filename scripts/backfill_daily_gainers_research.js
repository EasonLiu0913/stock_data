#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIST_DIR = path.join(ROOT, 'data_daily_gain_over_5');
const CAUSE_DIR = path.join(LIST_DIR, 'analysis');
const FLOW_DIR = path.join(LIST_DIR, 'analysis-flow');

const SOURCES = {
  passive: [
    { title: '中央社：AI需求旺、被動元件供應吃緊價格看漲', url: 'https://www.cna.com.tw/news/afe/202605200066.aspx', published_at: '2026-05-20' },
    { title: '今周刊：AI伺服器推升MLCC需求與缺貨循環', url: 'https://www.businesstoday.com.tw/article/category/183008/post/202606160008/', published_at: '2026-06-16' },
  ],
  memory: [
    { title: '中央社：旺宏營收創高、記憶體供需缺口與漲價', url: 'https://www.cna.com.tw/news/afe/202606080243.aspx', published_at: '2026-06-08' },
    { title: '中央社：南亞科預期2026年多種DRAM持續缺貨', url: 'https://www.cna.com.tw/news/afe/202601200048.aspx', published_at: '2026-01-20' },
  ],
  pcb: [
    { title: '中央社：AI功能升級帶動高階PCB與IC載板需求', url: 'https://www.cna.com.tw/news/afe/202605140043.aspx', published_at: '2026-05-14' },
  ],
  defense: [
    { title: '中央社：國防預算與無人機、無人艇商機', url: 'https://www.cna.com.tw/news/afe/202601210096.aspx', published_at: '2026-01-21' },
    { title: '中央社：無人系統籌獲策略與友盟供應鏈', url: 'https://www.cna.com.tw/news/aipl/202607140191.aspx', published_at: '2026-07-14' },
  ],
  generic: [],
};

const GROUPS = [
  { key:'passive', codes:new Set(['2327','2492','3026','3090','2375','2428','6834','2472','6173','6449','2478','6175','6155']), reason:'被動元件／MLCC族群受AI伺服器高階元件用量增加、供應吃緊與漲價預期支撐，且同族群多檔同步走強，屬產業趨勢與資金共振。' },
  { key:'memory', codes:new Set(['2408','2344','2337','6770','3260','2451','8299','8112']), reason:'記憶體族群受AI資料中心需求、DRAM/NAND供應偏緊與價格上行循環支撐；若同日南亞科、華邦電、旺宏等同步走強，較偏產業循環型行情。' },
  { key:'pcb', codes:new Set(['3044','8021','6213','8046','2383','8039','2467','6278','6672','3229','7795','3037']), reason:'PCB／CCL／IC載板供應鏈受AI伺服器、高速交換器與高階板材需求推升，當日多檔供應鏈同步走強，較像高階電子材料與載板族群共振。' },
  { key:'pcb', codes:new Set(['6442','3450','4977','2455','6451','6426']), reason:'CPO／高速光通訊受AI資料中心高速互連需求支撐，族群通常伴隨光模組、雷射與連接相關供應鏈同步走強。' },
  { key:'pcb', codes:new Set(['2308','2301','3017','3653','3443','8996','7711','2324','2377','6285','6831','2359','2465','6933']), reason:'AI伺服器／高階運算供應鏈資金回流，電源、散熱、伺服器、ASIC與周邊零組件同時受惠資本支出與算力需求，偏大型成長主線。' },
  { key:'generic', codes:new Set(['3481','2409','6116','4960','6456','3149','2438']), reason:'面板／顯示器供應鏈出現族群性資金輪動；若同日群創、友達、彩晶等同步上漲，較適合解讀為低基期與產業循環反彈，而非單一公司消息。' },
  { key:'defense', codes:new Set(['8033','2634','2630','2645','6753','2208','4571','8222']), reason:'軍工／無人機／航太維修與無人艇題材受國防預算、非紅供應鏈與標案需求支撐；同日漢翔、雷虎、亞航、長榮航太、龍德造船同步走強時，族群訊號明確。' },
  { key:'generic', codes:new Set(['9921','9914']), reason:'自行車族群同步反彈，較可能反映庫存循環改善、低基期與市場風險偏好回升；若巨大、美利達同漲，族群因素高於單一公司催化。' },
];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function numeric(v) { const n=Number(String(v ?? '').replaceAll(',','').trim()); return Number.isFinite(n)?n:null; }
function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  const text=fs.readFileSync(file,'utf8').trim(); if(!text)return[];
  const lines=text.split(/\r?\n/);
  const parse=line=>{const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;};
  const header=parse(lines[0]); return lines.slice(1).filter(Boolean).map(line=>Object.fromEntries(header.map((h,i)=>[h,parse(line)[i]??''])));
}
function findFieldIndex(fields, candidates) {
  const normalized = fields.map(v => String(v ?? '').replace(/\s+/g, '').trim());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.replace(/\s+/g, ''));
    if (idx >= 0) return idx;
  }
  return -1;
}
function mapInstitutional(file, netIndex) {
  const payload=readJson(file,{}); const rows=Array.isArray(payload?.data)?payload.data:[]; const fields=Array.isArray(payload?.fields)?payload.fields:[];
  const codeIndex = findFieldIndex(fields, ['證券代號','股票代號','證券代碼','股票代碼']);
  if (rows.length && codeIndex < 0) throw new Error(`Cannot locate institutional stock-code field: ${file}`);
  const map=new Map();
  for(const row of rows){const code=String(row?.[codeIndex]??'').trim();if(!code)continue;const n=numeric(row?.[netIndex]);if(n!=null)map.set(code,Math.round(n/1000));}
  return map;
}
function mapMargin(file){const map=new Map();for(const row of readCsv(file)){const code=String(row['股票代號']??'').trim();if(!code)continue;const prev=numeric(row['融資前日餘額']),now=numeric(row['融資今日餘額']),shortPrev=numeric(row['融券前日餘額']),shortNow=numeric(row['融券今日餘額']);map.set(code,{prev,now,delta:prev!=null&&now!=null?now-prev:null,shortDelta:shortPrev!=null&&shortNow!=null?shortNow-shortPrev:null});}return map;}
function findGroup(code){return GROUPS.find(g=>g.codes.has(String(code)))||null;}
function causeFor(stock,dayCount){const group=findGroup(stock.code);if(group)return{reason_summary:group.reason,evidence:[`當日漲幅 +${stock.change_pct.toFixed(2)}%`,`成交量 ${Number(stock.volume||0).toLocaleString('zh-TW')} 張`,dayCount>=100?`當日共有 ${dayCount} 檔漲幅達5%，屬廣泛型風險偏好回升`:`當日共有 ${dayCount} 檔漲幅達5%`],confidence:group.key==='generic'?'medium':'high',follow_up:'觀察隔日是否續量、同族群是否維持多檔同步，以及法人買盤是否延續。',sources:SOURCES[group.key]||[]};const lowLiquidity=numeric(stock.volume)!=null&&numeric(stock.volume)<500;return{reason_summary:lowLiquidity?'未找到可直接驗證的單一公開催化劑；成交量偏低，低流動性與短線籌碼可能放大價格波動，不宜硬解讀為基本面轉折。':dayCount>=100?'未找到可直接驗證的單一公開催化劑；當日屬廣泛型反彈，較可能是市場風險偏好回升、低基期與資金輪動共同推升。':'未找到可直接驗證的單一公開催化劑；先以族群輪動、價量與籌碼變化解讀，不把上漲本身倒果為因。',evidence:[`當日漲幅 +${stock.change_pct.toFixed(2)}%`,`成交量 ${Number(stock.volume||0).toLocaleString('zh-TW')} 張`,`當日5%以上股票 ${dayCount} 檔`],confidence:'low',follow_up:'優先比對法人、融資與後續2至5日價格延續性；若後續出現公司公告或產業消息，再提高原因可信度。',sources:[]};}
function technicalFor(code,date,smaPayload){const row=smaPayload?.[code]?.[`${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`];if(!row)return'unavailable';const close=numeric(row.close),s5=numeric(row.sma5),s20=numeric(row.sma20),s60=numeric(row.sma60);const bits=[];if(close!=null&&s5!=null)bits.push(close>=s5?'站上SMA5':'跌破SMA5');if(close!=null&&s20!=null)bits.push(close>=s20?'站上SMA20':'跌破SMA20');if(close!=null&&s60!=null)bits.push(close>=s60?'站上SMA60':'跌破SMA60');return bits.join('、')||'unavailable';}
function volumeFor(stock,code,prevDate,prevSma){const row=prevSma?.[code]?.[`${prevDate.slice(0,4)}/${prevDate.slice(4,6)}/${prevDate.slice(6,8)}`];const prev=numeric(row?.volume),now=numeric(stock.volume);if(prev==null||now==null||prev<=0)return'unavailable';const ratio=now/prev;return`成交量為前一交易日 ${ratio.toFixed(2)} 倍（${prev.toLocaleString('zh-TW')}→${now.toLocaleString('zh-TW')} 張）`;}
function flowInterpretation(f,t,m,s){const inst=f+t;const ratio=numeric(s.volume)>0?inst/numeric(s.volume):0;let text='法人方向中性或分歧，價格上漲較可能同時受題材、短線資金與技術面推動。',confidence='medium';if(inst>0&&ratio>0.03){text='法人淨買超與股價上漲同向，籌碼對當日強勢有明顯確認；若同時放量，延續性優於純題材急拉。';confidence='high';}else if(inst<0){text='股價上漲但外資／投信合計偏賣，法人未確認漲勢；需防短線題材或低流動性造成的價格放大。';confidence='medium';}if(m?.delta!=null&&m.delta>0&&inst<=0)text+=' 融資同步增加時，更偏散戶／槓桿資金推動。';if(m?.delta!=null&&m.delta<0&&inst>0)text+=' 融資下降而法人買超，籌碼結構相對乾淨。';return[text,confidence];}
function generateDate(date){
  const list=readJson(path.join(LIST_DIR,`${date}.json`));if(!list||!Array.isArray(list.stocks))throw new Error(`Missing daily gainer list: ${date}`);const stocks=list.stocks;
  const cause={schema_version:1,target_date:date,generated_at:new Date().toISOString(),source_list_file:`data_daily_gain_over_5/${date}.json`,stock_count:stocks.length,retrospective:true,methodology_note:'事後歸因研究：允許使用交易日之後發布、但能補充當日基本面或產業背景的公開資訊；不作為事前預測。無直接證據時降低可信度。',analyses:stocks.map(s=>({code:s.code,name:s.name,change_pct:s.change_pct,...causeFor(s,stocks.length)}))};
  fs.mkdirSync(CAUSE_DIR,{recursive:true});fs.writeFileSync(path.join(CAUSE_DIR,`${date}.json`),`${JSON.stringify(cause,null,2)}\n`);
  const foreignFile=path.join(ROOT,'data_twse_foreign_investors',`${date}_twse_foreign_investors.json`),trustFile=path.join(ROOT,'data_twse_investment_trust',`${date}_twse_investment_trust.json`),dealerFile=path.join(ROOT,'data_twse_dealers',`${date}_twse_dealers.json`),marginFile=path.join(ROOT,'data_twse_margin_balance',`${date}_twse_margin_balance.csv`),smaFile=path.join(ROOT,'data_fubon',`fubon_${date}_sma.json`),prevSmaFile=path.join(ROOT,'data_fubon',`fubon_${list.previous_date}_sma.json`);
  const foreign=mapInstitutional(foreignFile,11),trust=mapInstitutional(trustFile,5);const dealerPayload=readJson(dealerFile,null),dealerAvailable=!!(dealerPayload&&Array.isArray(dealerPayload.data)&&dealerPayload.data.length);const dealer=dealerAvailable?mapInstitutional(dealerFile,(dealerPayload.fields||[]).length-1):new Map();const margin=mapMargin(marginFile),sma=readJson(smaFile,{}),prevSma=readJson(prevSmaFile,{});
  const analyses=stocks.map(s=>{const f=foreign.has(String(s.code))?foreign.get(String(s.code)):0,t=trust.has(String(s.code))?trust.get(String(s.code)):0,d=dealerAvailable?(dealer.get(String(s.code))||0):'unavailable',m=margin.get(String(s.code)),[interp,confidence]=flowInterpretation(f,t,m,s);const marginSignal=m?`融資餘額 ${m.prev?.toLocaleString('zh-TW')??'—'}→${m.now?.toLocaleString('zh-TW')??'—'} 張，變化 ${m.delta==null?'—':`${m.delta>=0?'+':''}${m.delta.toLocaleString('zh-TW')} 張`}${m.shortDelta==null?'':`；融券變化 ${m.shortDelta>=0?'+':''}${m.shortDelta.toLocaleString('zh-TW')} 張`}`:'unavailable';return{code:s.code,name:s.name,change_pct:s.change_pct,institutional_summary:`外資 ${f>=0?'+':''}${f.toLocaleString('zh-TW')} 張；投信 ${t>=0?'+':''}${t.toLocaleString('zh-TW')} 張；自營商 ${d==='unavailable'?'資料 unavailable':`${d>=0?'+':''}${d.toLocaleString('zh-TW')} 張`}`,foreign_net:f,trust_net:t,dealer_net:d,margin_signal:marginSignal,broker_signal:'unavailable',volume_signal:volumeFor(s,String(s.code),list.previous_date,prevSma),technical_signal:technicalFor(String(s.code),date,sma),flow_interpretation:interp,confidence,follow_up:'觀察下一交易日法人是否續買、融資是否過度增加，以及放量後能否守住突破區。',data_sources:[fs.existsSync(foreignFile)?`data_twse_foreign_investors/${date}_twse_foreign_investors.json`:null,fs.existsSync(trustFile)?`data_twse_investment_trust/${date}_twse_investment_trust.json`:null,dealerAvailable?`data_twse_dealers/${date}_twse_dealers.json`:null,fs.existsSync(marginFile)?`data_twse_margin_balance/${date}_twse_margin_balance.csv`:null,`data_fubon/fubon_${date}_sma.json`,`data_fubon/fubon_${list.previous_date}_sma.json`].filter(Boolean)};});
  const flow={schema_version:1,target_date:date,generated_at:new Date().toISOString(),source_list_file:`data_daily_gain_over_5/${date}.json`,source_catalyst_analysis_file:`data_daily_gain_over_5/analysis/${date}.json`,stock_count:stocks.length,angle:'flow_and_positioning',methodology_note:'僅使用該交易日及前一交易日的實際市場/籌碼數據。法人股票代號依各來源 fields 欄名定位，不假設固定 row index；自營商檔若為空則標示 unavailable；券商分點本批未找到穩定同日結構化來源時亦不杜撰。',analyses};
  fs.mkdirSync(FLOW_DIR,{recursive:true});fs.writeFileSync(path.join(FLOW_DIR,`${date}.json`),`${JSON.stringify(flow,null,2)}\n`);return{date,stock_count:stocks.length,foreign_rows:foreign.size,trust_rows:trust.size,margin_rows:margin.size,dealer_available:dealerAvailable};
}
function main(){const dates=process.argv.slice(2).filter(x=>/^20\d{6}$/.test(x));if(!dates.length)throw new Error('Usage: node scripts/backfill_daily_gainers_research.js YYYYMMDD [YYYYMMDD...]');console.log(JSON.stringify({results:dates.map(generateDate)},null,2));}
try{main();}catch(error){console.error(error.stack||error);process.exit(1);}
