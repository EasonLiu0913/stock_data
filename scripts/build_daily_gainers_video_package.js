#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { normalizeNarrationRepetition } = require('./daily_gainers_text_cleanup');

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

const videoScriptPath = path.join(root, 'video_scripts', 'daily-gainers', date + '.json');
if (!fs.existsSync(videoScriptPath)) throw new Error('Missing ChatGPT-authored video script: ' + videoScriptPath);
const videoScript = JSON.parse(fs.readFileSync(videoScriptPath, 'utf8'));
if (videoScript.target_date !== date || videoScript.source_summary_generated_at !== summary.generated_at || videoScript.stock_count !== raw.stock_count || videoScript.privacy_status !== 'private') {
  throw new Error('Video script failed date, source freshness, stock count, or privacy gate');
}
const scenes = videoScript.scenes.map((s, i) => ({
  id: i + 1,
  title: s.title,
  subtitle: s.subtitle,
  bullets: s.bullets,
  narration: normalizeNarrationRepetition(s.narration),
  footer: s.footer || ''
}));
const outDir = path.join(root, 'output', 'daily-gainers-video', date);
const slidesDir = path.join(outDir, 'slides');
fs.mkdirSync(slidesDir, { recursive: true });
const fmtDate = `${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`;
const topThemes = summary.theme_summary?.theme_ranking?.slice(0, 4) || [];
function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(/\\.00$/, '')}%` : '—';
}
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
  source_files: [rawPath.replace(root + path.sep,''), aiPath.replace(root + path.sep,''), summaryPath.replace(root + path.sep,''), videoScriptPath.replace(root + path.sep,'')],
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
