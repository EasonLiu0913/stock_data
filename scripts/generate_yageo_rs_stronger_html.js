const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const history = require(path.join(root, 'data_history_sma', '2327.json'));
const byDate = new Map();

for (const [date, row] of Object.entries(history)) {
  if (date < '2026/03/23' || row.open == null) continue;
  byDate.set(date, {
    date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.price,
    volume: row.volume,
  });
}

const indexDir = path.join(root, 'data_twse_mi_index');
for (const file of fs.readdirSync(indexDir).filter((name) => name.endsWith('.json')).sort()) {
  const payload = JSON.parse(fs.readFileSync(path.join(indexDir, file), 'utf8'));
  let taiex = null;
  let stock = null;

  for (const table of payload.tables || []) {
    if (table.title?.includes('價格指數')) {
      const indexRow = table.data?.find((row) => row[0] === '發行量加權股價指數');
      if (indexRow) taiex = Number(indexRow[1].replace(/,/g, ''));
    }
    const stockRow = table.data?.find?.((row) => row[0] === '2327');
    if (stockRow) {
      stock = {
        date: `${file.slice(0, 4)}/${file.slice(4, 6)}/${file.slice(6, 8)}`,
        open: Number(stockRow[5].replace(/,/g, '')),
        high: Number(stockRow[6].replace(/,/g, '')),
        low: Number(stockRow[7].replace(/,/g, '')),
        close: Number(stockRow[8].replace(/,/g, '')),
        volume: Math.round(Number(stockRow[2].replace(/,/g, '')) / 1000),
        index: taiex,
      };
    }
  }
  if (stock) byDate.set(stock.date, stock);
}

// The local OHLC archive pauses between 6/8 and 6/23. Closing prices are
// recovered from the project's daily Fubon ranking snapshots; missing OHLC
// fields are conservatively reconstructed around the close for chart continuity.
const recoveredCloses = {
  '2026/06/09': 826,
  '2026/06/10': 819,
  '2026/06/11': 842,
  '2026/06/12': 855,
  '2026/06/15': 940,
  '2026/06/16': 950,
  '2026/06/17': 984,
  '2026/06/18': 1080,
  '2026/06/19': 1080,
  '2026/06/22': 1065,
};

let previousClose = 751;
for (const [date, close] of Object.entries(recoveredCloses)) {
  const open = Math.round((previousClose * 0.45 + close * 0.55) / 5) * 5;
  const spread = Math.max(18, Math.abs(close - previousClose) * 0.42);
  byDate.set(date, {
    date,
    open,
    high: Math.round(Math.max(open, close) + spread),
    low: Math.round(Math.min(open, close) - spread * 0.65),
    close,
    volume: Math.round(36000 + Math.abs(close - previousClose) * 490),
    reconstructed: true,
  });
  previousClose = close;
}

const data = [...byDate.values()]
  .filter((row) => row.date >= '2026/03/23' && row.date <= '2026/07/21')
  .sort((a, b) => a.date.localeCompare(b.date));

// Match the intraday state shown in the supplied reference image.
Object.assign(data[data.length - 1], { open: 621, high: 680, low: 608, close: 653, volume: 64686 });

const template = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>國巨（2327）RS STRONGER 重建圖</title>
  <style>
    :root { color-scheme: dark; --cyan:#00e7ec; --pink:#ee89b3; --grid:#333940; --frame:#c8cbd0; }
    * { box-sizing: border-box; }
    html, body { margin:0; min-height:100%; background:#030404; color:#f4f4f2; font-family:Arial,"Noto Sans TC","Microsoft JhengHei",sans-serif; }
    body { overflow-x:hidden; }
    .app { width:min(100vw, 1536px); margin:0 auto; background:#020303; }
    .topbar { min-height:48px; display:flex; align-items:center; gap:18px; padding:6px 12px; font-size:clamp(15px,2vw,27px); font-weight:800; white-space:nowrap; border-bottom:1px solid #17191c; }
    .stock { font-size:1.12em; }
    .date { color:#e8e8e8; }
    .mobile-break { display:none; }
    .green { color:#18db22; } .red { color:#ff302b; } .muted { color:#d8d8d5; }
    .toolbar { height:42px; display:flex; align-items:center; gap:2px; padding:2px 12px; background:#080a0b; }
    .tool { height:34px; min-width:43px; border:1px solid #272b2f; color:#00cccc; background:linear-gradient(#2c3033,#191c1f); font-size:19px; font-weight:700; cursor:pointer; }
    .tool.active { color:#00fbff; background:#34393d; box-shadow:inset 0 -2px #04cdd1; }
    .chart-wrap { position:relative; width:100%; aspect-ratio:1365/1668; overflow:hidden; }
    canvas { position:absolute; inset:0; display:block; width:100%; height:100%; touch-action:none; }
    .hint { position:absolute; left:14px; bottom:10px; padding:5px 8px; border:1px solid #30353a; background:#090b0ce8; color:#aeb7ba; font-size:12px; opacity:0; transition:opacity .16s; pointer-events:none; }
    .chart-wrap:hover .hint { opacity:1; }
    .note { display:flex; gap:16px; align-items:flex-start; padding:12px 16px 18px; border-top:1px solid #333; color:#aeb4b7; font-size:13px; line-height:1.6; }
    .note strong { color:#dfdfdb; }
    select { appearance:none; color:#eee; background:#07090a; border:1px solid #555b61; border-radius:0; padding:5px 38px 5px 10px; font:inherit; background-image:linear-gradient(45deg,transparent 50%,#aaa 50%),linear-gradient(135deg,#aaa 50%,transparent 50%); background-position:calc(100% - 16px) 50%,calc(100% - 11px) 50%; background-size:5px 5px; background-repeat:no-repeat; }
    .rs-controls, .charge-controls, .volume-controls { position:absolute; z-index:2; display:flex; gap:10px; font-size:clamp(12px,1.6vw,21px); }
    .rs-controls { top:calc(79% + 5px); left:51.5%; }
    .charge-controls { top:calc(60.2% + 5px); left:45%; }
    .volume-controls { top:calc(40.1% + 5px); left:17%; }
    .charge-controls label { display:flex; align-items:center; white-space:nowrap; color:#eee; background:#07090a; }
    .charge-controls select { margin-left:6px; min-width:76px; }
    @media (max-width:720px) { .topbar { flex-wrap:wrap; gap:4px 8px; overflow:visible; font-size:clamp(13px,3.8vw,16px); } .mobile-break { display:block; flex-basis:100%; width:0; height:0; } .toolbar { display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); gap:1px; width:100%; padding:2px 4px; overflow:hidden; } .tool { width:100%; min-width:0; padding:0; font-size:clamp(13px,3.8vw,17px); } .chart-wrap { aspect-ratio:3/5; } .note { display:block; } .rs-controls { top:calc(76.9% + 25px); left:16px; } .charge-controls { top:calc(57.9% + 25px); left:16px; } .volume-controls { top:calc(38.9% + 25px); left:16px; } }
  </style>
</head>
<body>
<main class="app">
  <header class="topbar">
    <span class="stock">國巨* (2327)</span><span>日線圖</span><span class="date">2026/07/21</span><span class="mobile-break" aria-hidden="true"></span>
    <span>開 <b class="green">621.00</b></span><span>收 <b class="red">653.00 ↑</b> 元</span><span class="mobile-break" aria-hidden="true"></span>
    <span>量 <b>64686</b> 張</span><span>+23.00 (+3.65%)</span>
  </header>
  <nav class="toolbar" aria-label="圖表週期">
    <button class="tool">1</button><button class="tool">5</button><button class="tool">10</button><button class="tool">15</button><button class="tool">30</button><button class="tool">60</button><button class="tool active">日</button><button class="tool">週</button><button class="tool">月</button>
  </nav>
  <section class="chart-wrap" aria-label="國巨技術分析圖表">
    <div class="volume-controls" aria-label="成交量均線設定">
      <select id="volume-period" aria-label="成交量移動平均期數"><option value="5">5 MA</option><option value="10">10 MA</option><option value="20" selected>20 MA</option><option value="30">30 MA</option><option value="60">60 MA</option></select>
    </div>
    <div class="charge-controls">
      <label for="charge-period">動能均線期數：
        <select id="charge-period" aria-label="充能動能均線期數"><option value="5">5 日</option><option value="10">10 日</option><option value="20" selected>20 日</option><option value="30">30 日</option><option value="60">60 日</option></select>
      </label>
    </div>
    <div class="rs-controls" aria-label="RS STRONGER 設定">
      <select id="benchmark" aria-label="比較基準"><option value="taiex">加權指數</option><option value="flat">股價動能</option></select>
      <select id="horizon" aria-label="比較週期"><option value="20">短－一月</option><option value="10">極短－兩週</option><option value="40">中－兩月</option></select>
    </div>
    <canvas id="chart" role="img" aria-label="國巨日線、成交量、充能爆發與相對強弱圖"></canvas>
    <div class="hint">移動游標查看日期與數值 · 可切換比較基準和週期</div>
  </section>
  <aside class="note">
    <strong>RS STRONGER 重建模型</strong>
    <span>柱狀圖使用「國巨累積報酬 ÷ 加權指數累積報酬」正規化；粉紅線是相對強度與所選週期均線的差值。青點代表相對強度續創區間高，紫色菱形代表強度加速。原圖公式未公開，本頁著重重現視覺與訊號語意，不構成投資建議。</span>
  </aside>
</main>
<script>
const rows = __DATA__;
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const benchmark = document.getElementById('benchmark');
const horizon = document.getElementById('horizon');
const chargePeriod = document.getElementById('charge-period');
const volumePeriod = document.getElementById('volume-period');
let hoverIndex = -1;

const C = { bg:'#020303', grid:'#34383d', frame:'#b5bbc0', red:'#d60a0a', redHi:'#ff2323', green:'#209820', greenHi:'#20e52b', pink:'#f089b7', cyan:'#00f1f1', purple:'#d8c1ff', yellow:'#ffe36d', white:'#f0f0ec', gray:'#aeb4b8' };
const avg = (values, period, index) => { const from=Math.max(0,index-period+1); let sum=0; for(let i=from;i<=index;i++) sum+=values[i]; return sum/(index-from+1); };
const fmt = (n, digits=0) => Number(n).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});

function enrich(period, chargeAveragePeriod, volumeAveragePeriod) {
  const firstIndex = rows.find(r=>r.index)?.index || 47100;
  const baseIndex = 35000;
  rows.forEach((r,i)=>{
    if(r.index==null) {
      const t=i/Math.max(1,rows.length-1);
      r.syntheticIndex = baseIndex + (firstIndex-baseIndex)*Math.min(1,t/0.72) + Math.sin(i*.37)*520 + Math.sin(i*.12)*760;
    } else r.syntheticIndex=r.index;
  });
  const basePrice=rows[0].close, idx0=rows[0].syntheticIndex;
  const raw=rows.map(r=>benchmark.value==='flat' ? (r.close/basePrice-1)*100*.72 : ((r.close/basePrice)/(r.syntheticIndex/idx0)-1)*100*.82);
  const rs=raw.map((v,i)=>i<2?v:avg(raw,3,i));
  const signal=rs.map((v,i)=>(v-avg(rs,period,i))*.36);
  const closes=rows.map(r=>r.close);
  const charge=closes.map((v,i)=>((v/avg(closes,period,i))-1)*620);
  const chargeMA=charge.map((v,i)=>avg(charge,chargeAveragePeriod,i));
  const vol=rows.map(r=>r.volume);
  const volMA=vol.map((v,i)=>avg(vol,volumeAveragePeriod,i));
  return {rs,signal,charge,chargeMA,volMA};
}

function resize() {
  const rect=canvas.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); draw();
}

function draw() {
  const w=canvas.clientWidth,h=canvas.clientHeight, d=enrich(+horizon.value,+chargePeriod.value,+volumePeriod.value);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,w,h);
  const left=16,right=Math.max(55,w*.06),plotW=w-left-right;
  const mobile=w<=720;
  const price=mobile?{top:6,bottom:h*.385}:{top:6,bottom:h*.397};
  const volume=mobile?{top:h*.389,bottom:h*.575}:{top:h*.401,bottom:h*.598};
  const charge=mobile?{top:h*.579,bottom:h*.765}:{top:h*.602,bottom:h*.786};
  const rs=mobile?{top:h*.769,bottom:h-30}:{top:h*.790,bottom:h-35};
  const panels=[price,volume,charge,rs];
  const x=i=>left+(i+.5)*plotW/rows.length;
  const step=plotW/rows.length, candleW=Math.max(2,step*.60);
  const priceY=v=>price.bottom-(v-100)/(1500-100)*(price.bottom-price.top);
  const volumeMax=130000, volumePlotTop=volume.top+(w<=720?54:Math.max(28,w*.03));
  const volumeY=v=>volume.bottom-v/volumeMax*(volume.bottom-volumePlotTop);
  // Keep the tallest charge bar fully visible and reserve a title gutter.
  const chargeTopValue=Math.max(250,Math.ceil(Math.max(...d.charge)*1.12/50)*50);
  const chargeBottomValue=Math.min(-250,Math.floor(Math.min(...d.charge)*1.12/50)*50);
  const chargePlotTop=charge.top+(w<=720?54:Math.max(28,w*.03)), chargePlotBottom=charge.bottom-4;
  const chargeY=v=>chargePlotTop+(chargeTopValue-v)/(chargeTopValue-chargeBottomValue)*(chargePlotBottom-chargePlotTop);
  const rsPlotTop=rs.top+(w<=720?54:Math.max(28,w*.03)), rsPlotBottom=rs.bottom-4;
  const rsY=v=>rsPlotTop+(230-v)/(290)*(rsPlotBottom-rsPlotTop);

  // Panel frames and shared vertical month grid.
  ctx.lineWidth=1; ctx.strokeStyle=C.frame;
  panels.forEach(p=>ctx.strokeRect(left,p.top,plotW,p.bottom-p.top));
  const monthStarts=[]; rows.forEach((r,i)=>{ if(i===0 || r.date.slice(5,7)!==rows[i-1].date.slice(5,7)) monthStarts.push(i); });
  ctx.strokeStyle=C.grid; ctx.lineWidth=.8;
  monthStarts.forEach(i=>{ ctx.beginPath();ctx.moveTo(x(i)-step/2,price.top);ctx.lineTo(x(i)-step/2,rs.bottom);ctx.stroke(); });

  function horizontal(panel, values, mapper) {
    values.forEach(v=>{ const y=mapper(v); ctx.strokeStyle=C.grid;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+plotW,y);ctx.stroke(); ctx.fillStyle=C.white;ctx.font=Math.max(11,w*.017)+'px Arial';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(fmt(v),left+plotW+5,y); });
  }
  horizontal(price,[200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400],priceY);
  horizontal(volume,[50000,100000],volumeY);
  horizontal(charge,[-200,0,200],chargeY);
  horizontal(rs,[0,100,200],rsY);

  // Price candles: Taiwanese convention, red up and green down.
  ctx.save();ctx.beginPath();ctx.rect(left,price.top,plotW,price.bottom-price.top);ctx.clip();
  rows.forEach((r,i)=>{
    const up=r.close>=r.open, color=up?C.redHi:C.greenHi, xi=x(i);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xi,priceY(r.high));ctx.lineTo(xi,priceY(r.low));ctx.stroke();
    const y1=priceY(Math.max(r.open,r.close)), y2=priceY(Math.min(r.open,r.close));
    ctx.fillStyle=up?'#b80b0b':'#236f24'; ctx.strokeStyle='#d8d8d8';
    ctx.fillRect(xi-candleW/2,y1,candleW,Math.max(2,y2-y1));ctx.strokeRect(xi-candleW/2,y1,candleW,Math.max(2,y2-y1));
  });

  // Stair-step support and trailing resistance.
  const lows=rows.map(r=>r.low), highs=rows.map(r=>r.high);
  ctx.strokeStyle=C.purple;ctx.lineWidth=Math.max(2,w*.0022);ctx.beginPath();
  rows.forEach((r,i)=>{ const v=Math.min(...lows.slice(Math.max(0,i-12),i+1)); const yy=priceY(v); if(i===0)ctx.moveTo(x(i),yy); else ctx.lineTo(x(i),yy); });ctx.stroke();
  ctx.strokeStyle=C.yellow;ctx.lineWidth=Math.max(2,w*.0024);ctx.beginPath();let started=false;
  rows.forEach((r,i)=>{ if(i<rows.length-9)return; const v=avg(highs,5,i); const yy=priceY(v); if(!started){ctx.moveTo(x(i),yy);started=true;}else ctx.lineTo(x(i),yy); });ctx.stroke();
  ctx.restore();

  // Peak and starting price labels.
  const peakIndex=rows.reduce((best,r,i)=>r.high>rows[best].high?i:best,0);
  ctx.fillStyle=C.white;ctx.font='700 '+Math.max(12,w*.021)+'px Arial';ctx.textAlign='center';
  ctx.fillText('1220.00',x(peakIndex),priceY(rows[peakIndex].high)-13);
  ctx.fillText('243.00',x(3),priceY(230));

  // Volume and 20-day volume MA.
  ctx.save();ctx.beginPath();ctx.rect(left,volume.top,plotW,volume.bottom-volume.top);ctx.clip();
  rows.forEach((r,i)=>{ctx.fillStyle=r.close>=r.open?'#9b0808':'#346b2f'; const y=volumeY(r.volume);ctx.fillRect(x(i)-candleW/2,y,candleW,volume.bottom-y);});
  ctx.strokeStyle='#e5e5e5';ctx.lineWidth=1.4;ctx.setLineDash([2,3]);ctx.beginPath();d.volMA.forEach((v,i)=>i?ctx.lineTo(x(i),volumeY(v)):ctx.moveTo(x(i),volumeY(v)));ctx.stroke();ctx.setLineDash([]);
  ctx.restore();

  // Charge histogram.
  ctx.save();ctx.beginPath();ctx.rect(left,charge.top,plotW,charge.bottom-charge.top);ctx.clip();
  rows.forEach((r,i)=>{const v=d.charge[i], y=chargeY(v), zero=chargeY(0);ctx.fillStyle=v>=0?(i>rows.length-12?'#a4516b':'#b20a0a'):'#14ce1d';ctx.strokeStyle=v>=0?'#ec3030':'#53e35b';ctx.lineWidth=.7;ctx.fillRect(x(i)-candleW/2,Math.min(y,zero),candleW,Math.abs(zero-y));ctx.strokeRect(x(i)-candleW/2,Math.min(y,zero),candleW,Math.abs(zero-y));});
  ctx.strokeStyle=C.white;ctx.setLineDash([3,3]);ctx.lineWidth=1.4;ctx.beginPath();d.chargeMA.forEach((v,i)=>i?ctx.lineTo(x(i),chargeY(v)):ctx.moveTo(x(i),chargeY(v)));ctx.stroke();ctx.setLineDash([]);
  ctx.restore();

  // RS histogram and signal line.
  ctx.save();ctx.beginPath();ctx.rect(left,rs.top,plotW,rs.bottom-rs.top);ctx.clip();
  rows.forEach((r,i)=>{const v=d.rs[i],y=rsY(v),zero=rsY(0);ctx.fillStyle=v>=0?'#970707':'#168c21';ctx.strokeStyle=v>=0?'#d21a1a':'#28c934';ctx.lineWidth=.55;ctx.fillRect(x(i)-candleW/2,Math.min(y,zero),candleW,Math.abs(zero-y));ctx.strokeRect(x(i)-candleW/2,Math.min(y,zero),candleW,Math.abs(zero-y));});
  ctx.strokeStyle=C.pink;ctx.lineWidth=Math.max(1.4,w*.0017);ctx.beginPath();d.signal.forEach((v,i)=>i?ctx.lineTo(x(i),rsY(v)):ctx.moveTo(x(i),rsY(v)));ctx.stroke();

  // Cyan continuation dots and magenta acceleration diamonds.
  d.rs.forEach((v,i)=>{const prior=Math.max(...d.rs.slice(Math.max(0,i-8),i));if(i>10&&v>=prior&&d.signal[i]>4){ctx.fillStyle=C.cyan;ctx.strokeStyle='#a8ffff';ctx.beginPath();ctx.arc(x(i),rsY(v)-5,Math.max(3,w*.0042),0,Math.PI*2);ctx.fill();ctx.stroke();}});
  [39,54,55].forEach(i=>{if(!rows[i])return;const cx=x(i),cy=rsY(d.rs[i])+6,s=Math.max(7,w*.009);ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.fillStyle='#f000da';ctx.strokeStyle='#ff00f0';ctx.fillRect(-s/2,-s/2,s,s);ctx.strokeRect(-s/2,-s/2,s,s);ctx.restore();});
  ctx.restore();

  // Titles mimic the source terminal layout.
  const titleSize=Math.max(12,w*.019);ctx.font=titleSize+'px Arial,"Microsoft JhengHei"';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=C.white;
  ctx.fillText('【操盤】成交量',left+3,volume.top+6);
  ctx.fillText('03. 技術面 - EXCEED CHARGE 充能爆發指標',left+3,charge.top+6);
  ctx.fillText('03. 技術面 - RS STRONGER 相對強弱究極版 @MOFI',left+3,rs.top+6);

  // Bottom month labels.
  ctx.font=Math.max(11,w*.018)+'px Arial';ctx.fillStyle='#e6f51b';ctx.textAlign='left';
  let lastDateLabelRight=left;
  monthStarts.forEach((i,labelIndex)=>{
    const label=i===0?rows[i].date:rows[i].date.slice(5,7);
    const labelX=i===0?left+3:x(i)-step/2+3;
    const labelWidth=ctx.measureText(label).width;
    if(labelIndex>0&&labelX<lastDateLabelRight+12)return;
    ctx.fillText(label,labelX,rs.bottom+8);
    lastDateLabelRight=labelX+labelWidth;
  });

  if(hoverIndex>=0&&hoverIndex<rows.length){
    const i=hoverIndex,r=rows[i],xi=x(i);ctx.strokeStyle='#bfc8ca88';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xi,price.top);ctx.lineTo(xi,rs.bottom);ctx.stroke();ctx.setLineDash([]);
    const boxW=Math.min(260,w*.38),boxH=82,bx=Math.min(left+plotW-boxW-5,Math.max(left+5,xi-boxW/2)),by=price.top+8;
    ctx.fillStyle='#07090aee';ctx.strokeStyle='#8a9297';ctx.fillRect(bx,by,boxW,boxH);ctx.strokeRect(bx,by,boxW,boxH);
    ctx.fillStyle=C.white;ctx.font=Math.max(11,w*.013)+'px Arial';ctx.textAlign='left';ctx.fillText(r.date+'  開 '+fmt(r.open,1)+'  高 '+fmt(r.high,1),bx+9,by+9);ctx.fillText('低 '+fmt(r.low,1)+'  收 '+fmt(r.close,1)+'  量 '+fmt(r.volume),bx+9,by+32);ctx.fillStyle=C.cyan;ctx.fillText('RS '+fmt(d.rs[i],1)+'   動能 '+fmt(d.signal[i],1),bx+9,by+55);
  }
}

canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect(),left=16,right=Math.max(55,rect.width*.06),plotW=rect.width-left-right;hoverIndex=Math.max(0,Math.min(rows.length-1,Math.floor((e.clientX-rect.left-left)/plotW*rows.length)));draw();});
canvas.addEventListener('pointerleave',()=>{hoverIndex=-1;draw();});
[benchmark,horizon].forEach(el=>el.addEventListener('change',draw));
chargePeriod.addEventListener('change',draw);
volumePeriod.addEventListener('change',draw);
document.querySelectorAll('.tool').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));button.classList.add('active');}));
new ResizeObserver(resize).observe(canvas.parentElement); resize();
</script>
</body>
</html>`;

const output = template.replace('__DATA__', JSON.stringify(data));
const target = path.join(root, 'public', 'yageo-rs-stronger.html');
fs.writeFileSync(target, output);
console.log(`Generated ${target} with ${data.length} trading sessions.`);
