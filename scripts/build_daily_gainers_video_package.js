#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const date = process.argv[2];
if (!/^20\d{6}$/.test(date || '')) {
  console.error('Usage: node scripts/build_daily_gainers_video_package.js YYYYMMDD');
  process.exit(1);
}

const root = process.cwd();
const rawPath = path.join(root, 'data_daily_gain_over_5', `${date}.json`);
const aiPath = path.join(root, 'data_daily_gain_over_5', 'analysis-ai', `${date}.json`);
const summaryPath = path.join(root, 'data_daily_gain_over_5', 'market-summary', `${date}.json`);

for (const p of [rawPath, aiPath, summaryPath]) {
  if (!fs.existsSync(p)) throw new Error(`Missing required input: ${p}`);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const ai = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

if (summary.status !== 'final') throw new Error(`Market summary is not final: ${summary.status}`);
if (summary.coverage?.overall !== 'complete') throw new Error(`Market summary coverage is not complete: ${summary.coverage?.overall}`);

const stocks = new Map(raw.stocks.map(s => [String(s.code), s]));
const analyses = new Map(ai.analyses.map(a => [String(a.code), a]));
const outDir = path.join(root, 'output', 'daily-gainers-video', date);
const slidesDir = path.join(outDir, 'slides');
fs.mkdirSync(slidesDir, { recursive: true });

const fmtDate = `${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`;
const topThemes = summary.theme_summary?.theme_ranking?.slice(0, 4) || [];
const priority = (ai.priority_watchlist || []).filter(c => stocks.has(String(c)));

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(/\.00$/, '')}%` : '—';
}
function compact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('zh-TW').format(n);
}
function stockLabel(code) {
  const s = stocks.get(String(code));
  return s ? `${s.name}（${s.code}）` : String(code);
}
function analysisNarration(code) {
  const s = stocks.get(String(code));
  const a = analyses.get(String(code));
  if (!s || !a) return null;
  const evidence = (a.evidence || []).slice(0, 3).join('；');
  const follow = (a.follow_up || []).slice(0, 2).join('、');
  const conf = a.confidence === 'high' ? '高' : a.confidence === 'medium' ? '中等' : '較低';
  return `接著看 ${s.name}，代號 ${s.code}。今天收在 ${s.close} 元，上漲 ${pct(s.change_pct)}，成交量約 ${compact(s.volume)} 張。AI 綜合判讀是：${a.reason_summary} 目前證據信心為${conf}。可驗證的重點包括：${evidence}。這裡要特別注意，強勢上漲不等於隔天一定延續，接下來應該追蹤${follow || '隔日量價與籌碼是否延續'}，如果量能快速退潮或法人轉賣，就要降低追價預期。`;
}
function stockBullets(code) {
  const s = stocks.get(String(code));
  const a = analyses.get(String(code));
  if (!s || !a) return [];
  return [
    `收盤 ${s.close}｜漲幅 ${pct(s.change_pct)}｜量 ${compact(s.volume)} 張`,
    a.reason_summary,
    ...(a.evidence || []).slice(0, 2),
  ];
}

const scenes = [];
function addScene(title, subtitle, bullets, narration, footer = '') {
  scenes.push({
    id: scenes.length + 1,
    title,
    subtitle,
    bullets: bullets.filter(Boolean).slice(0, 5),
    narration,
    footer
  });
}

addScene(
  `${fmtDate} 台股 5% 強勢股`,
  `${raw.stock_count} 檔股票單日漲幅達 5% 以上`,
  [
    summary.headline,
    `市場結構：${summary.market_context?.source?.breadth_regime || summary.market_context?.regime || 'mixed'}`,
    `公開催化覆蓋：${summary.catalyst_coverage?.public_catalyst_coverage_pct ?? '—'}%`,
    `法人偏多：${summary.funding_summary?.institutional_support_count ?? '—'} / ${raw.stock_count} 檔`
  ],
  `歡迎來到 TAIWANSTOCK。今天要用五到十分鐘，快速拆解 ${fmtDate} 台股漲幅超過百分之五的強勢股。今天一共有 ${raw.stock_count} 檔入選，比前一個交易日增加 ${summary.breadth?.stock_count_change ?? 0} 檔。重點不是把三十六檔逐一念完，而是找出真正有題材、籌碼與量價共振的主線，以及哪些股票雖然大漲，但公開催化仍然不足。以下內容依據當日收盤資料、新聞、法人、融資與分點資訊整理，僅供研究，不構成投資建議。我們有提供中文 CC 字幕，記得打開觀賞，那我們開始囉`
);

addScene(
  '今天盤面怎麼看？',
  summary.headline,
  topThemes.map(t => `${t.label}：${t.stock_count} 檔｜平均漲幅 ${pct(t.average_gain_pct)}｜${t.strength}`),
  `先看整體結構。今天的市場比較像選擇性 risk-on，而不是全面無差別上漲。強勢股集中在幾條可辨識主線，其中被動元件有 ${topThemes[0]?.stock_count ?? 0} 檔，塑化與化工有 ${topThemes.find(t=>t.theme_id==='petrochemical')?.stock_count ?? 0} 檔，PCB 與電子材料也有明顯表現。公開直接或交叉佐證的催化覆蓋率只有 ${summary.catalyst_coverage?.public_catalyst_coverage_pct ?? 0}%，這代表今天有一部分股票主要是資金與動能推升，而不是每一檔都有清楚基本面事件。這種盤面最重要的是分辨主線共振與單純追價。`
);

const featured = ['2492','1301','3026','3532','1303','6505','6442','6672'].filter(c => stocks.has(c) && analyses.has(c));
for (const code of featured) {
  const s = stocks.get(code);
  const a = analyses.get(code);
  addScene(
    stockLabel(code),
    `${a.cause_type || 'unknown'}｜證據 ${a.evidence_strength || 'unknown'}｜信心 ${a.confidence || 'unknown'}`,
    stockBullets(code),
    analysisNarration(code),
    `後續：${(a.follow_up || []).slice(0,2).join('｜')}`
  );
}

const remaining = priority.filter(c => !featured.includes(String(c))).slice(0, 6);
addScene(
  '其他優先觀察股',
  '從 36 檔中再挑出值得追蹤的強勢股',
  remaining.map(code => {
    const s = stocks.get(String(code));
    const a = analyses.get(String(code));
    return `${stockLabel(code)}｜+${pct(s?.change_pct).replace('+','')}｜${a?.cause_tags?.slice(0,2).join('/') || a?.cause_type || '待驗證'}`;
  }),
  `除了前面的個股，AI 優先觀察清單還包含 ${remaining.map(stockLabel).join('、')}。這些股票之所以值得放在第二層觀察，不一定代表基本面催化最強，而是當日量價、題材或籌碼至少有一項具辨識度。實際操作上，比起看到漲幅就追，更重要的是隔天確認成交量有沒有維持、法人與分點是否延續，以及股價是否能守住突破區。如果只剩價格上漲，其他證據快速消失，就應該把它視為短線動能，而不是新的中期趨勢。`
);

addScene(
  '籌碼與風險',
  '強勢不代表沒有擁擠風險',
  [
    `法人偏多 ${summary.funding_summary?.institutional_support_count ?? 0} 檔；偏空 ${summary.funding_summary?.institutional_opposition_count ?? 0} 檔`,
    `融資增加 ${summary.funding_summary?.margin_increase_count ?? 0} 檔；融資減少 ${summary.funding_summary?.margin_decrease_count ?? 0} 檔`,
    `直接/交叉佐證催化：${summary.catalyst_coverage?.public_catalyst_count ?? 0} 檔`,
    ...(summary.next_day_watch || [])
  ],
  `最後一定要看風險。今天三十六檔強勢股裡，法人偏多的有 ${summary.funding_summary?.institutional_support_count ?? 0} 檔，但同時融資增加的有 ${summary.funding_summary?.margin_increase_count ?? 0} 檔。這種組合代表市場風險偏好升高，但也可能讓部分熱門股的短線籌碼變得擁擠。另外，公開催化只有 ${summary.catalyst_coverage?.public_catalyst_count ?? 0} 檔達到直接或交叉佐證，因此沒有明確消息的股票，隔日若量縮、法人轉賣，就要特別小心動能退潮。明天最值得追蹤的是主流族群能不能續量，以及強勢股是否從單點擴散成族群行情。`
);

addScene(
  '明日觀察重點',
  '把「今天大漲」轉成「明天可驗證」',
  [
    '一、被動元件是否續量並維持族群擴散',
    '二、塑化股法人買盤是否延續',
    '三、PCB / CPO 是否維持題材與量價共振',
    '四、融資快速增加的強勢股是否出現隔日獲利了結'
  ],
  `總結今天的訊號：第一，被動元件是最清楚的群聚主線；第二，塑化與化工有低基期、報價預期與法人回補共振；第三，PCB、電子材料與 CPO 各有代表股，但個股證據強弱不一。明天不要只問哪一檔還會漲，而是逐一驗證四件事：族群有沒有擴散、成交量是否健康、法人與分點是否延續、以及融資是否過度追高。當題材、量價與籌碼三者同方向時，延續性才比較值得期待。`
);

addScene(
  'TAIWANSTOCK',
  `${fmtDate} 每日 5% 強勢股整理`,
  ['資料驅動｜題材驗證｜籌碼交叉比對', '本影片僅供研究與資訊整理，不構成投資建議'],
  `以上就是 ${fmtDate} 的每日百分之五強勢股整理。如果你希望每天快速掌握強勢股背後到底是題材、法人、分點還是單純短線動能，可以持續追蹤 TAIWANSTOCK。再次提醒，影片內容是資料整理與研究用途，不是買賣建議；股價在大漲之後波動通常也會同步放大，請依自己的風險承受能力做判斷。我們下一個交易日再見。`
);

function escapeXml(s) {
  return String(s ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
}
function wrap(text, max = 28) {
  const chars = [...String(text ?? '')];
  const lines = [];
  for (let i=0;i<chars.length;i+=max) lines.push(chars.slice(i,i+max).join(''));
  return lines.slice(0, 3);
}
function textBlock(x, y, text, size, weight='400', lineHeight=1.35, opacity=1) {
  const lines = wrap(text);
  return `<text x="${x}" y="${y}" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="${size}" font-weight="${weight}" fill="#f8fafc" opacity="${opacity}">${lines.map((l,i)=>`<tspan x="${x}" dy="${i===0?0:size*lineHeight}">${escapeXml(l)}</tspan>`).join('')}</text>`;
}
function singleLineTextBlock(x, y, text, baseSize, weight='400', opacity=1, maxWidth=1580) {
  const value = String(text ?? '');
  const glyphCount = Math.max(1, [...value].length);
  const estimatedWidth = glyphCount * baseSize;
  const size = Math.max(24, Math.min(baseSize, Math.floor(baseSize * maxWidth / estimatedWidth)));
  return `<text x="${x}" y="${y}" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="${size}" font-weight="${weight}" fill="#f8fafc" opacity="${opacity}" textLength="${Math.min(maxWidth, Math.max(1, estimatedWidth * size / baseSize))}" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text>`;
}
function renderSvg(scene) {
  let y = 330;
  const bulletSvg = scene.bullets.map((b, idx) => {
    const lines = wrap(b, 34);
    const h = Math.max(1, lines.length) * 48 + 34;
    const txt = `<text x="220" y="${y}" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="38" fill="#e2e8f0">${lines.map((l,i)=>`<tspan x="220" dy="${i===0?0:52}">${escapeXml(l)}</tspan>`).join('')}</text>`;
    const dot = `<circle cx="170" cy="${y-13}" r="10" fill="#38bdf8"/>`;
    y += h;
    return dot + txt;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#07111f"/>
  <rect x="0" y="0" width="1920" height="18" fill="#38bdf8"/>
  <rect x="118" y="95" width="14" height="150" rx="7" fill="#38bdf8"/>
  ${textBlock(165, 150, scene.title, 70, '700')}
  ${singleLineTextBlock(165, 252, scene.subtitle, 34, '500', 0.82)}
  ${bulletSvg}
  <text x="165" y="1010" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="26" fill="#94a3b8">${escapeXml(scene.footer || 'TAIWANSTOCK｜每日 5% 強勢股研究')}</text>
  <text x="1390" y="1010" text-anchor="middle" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="22" font-weight="400" fill="#94a3b8" opacity="0.68">歡迎打開 CC中文字幕觀賞</text>
  <text x="1755" y="1010" font-family="Noto Sans CJK TC, sans-serif" font-size="24" fill="#64748b">${scene.id}/${scenes.length}</text>
</svg>`;
}

for (const scene of scenes) {
  fs.writeFileSync(path.join(slidesDir, `${String(scene.id).padStart(2,'0')}.svg`), renderSvg(scene));
}

const narrationChars = scenes.reduce((n,s)=>n+[...s.narration].length,0);
const plan = {
  schema_version: 1,
  methodology_version: 'daily-gainers-video-v1',
  target_date: date,
  generated_at: new Date().toISOString(),
  source_files: [rawPath.replace(root + path.sep,''), aiPath.replace(root + path.sep,''), summaryPath.replace(root + path.sep,'')],
  narration_chars: narrationChars,
  scene_count: scenes.length,
  scenes
};
fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');

const metadata = {
  title: `${date.slice(4,6)}/${date.slice(6,8)} 台股 5% 強勢股｜${summary.headline}`,
  description: [
    `${fmtDate} 台股每日 5% 強勢股整理。`,
    '',
    summary.market_summary,
    '',
    '重點題材：',
    ...topThemes.slice(0,4).map(t => `- ${t.label}：${t.stock_count} 檔，平均漲幅 ${pct(t.average_gain_pct)}`),
    '',
    '本影片依據當日收盤、新聞、法人、融資與分點資料自動整理。',
    '內容僅供研究與資訊用途，不構成投資建議。'
  ].join('\n'),
  tags: ['台股','強勢股','漲停股','法人籌碼','每日盤勢','TAIWANSTOCK', ...topThemes.slice(0,3).map(t=>t.label)],
  categoryId: '25',
  privacyStatus: 'private'
};
fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');

console.log(JSON.stringify({date, outDir:path.relative(root,outDir), scenes:scenes.length, narration_chars:narrationChars, title:metadata.title}, null, 2));
