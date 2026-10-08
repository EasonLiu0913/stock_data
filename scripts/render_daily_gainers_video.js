#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const date = process.argv[2];
if (!/^20\d{6}$/.test(date || '')) {
  console.error('Usage: node scripts/render_daily_gainers_video.js YYYYMMDD');
  process.exit(1);
}

const root = process.cwd();
const outDir = path.join(root, 'output', 'daily-gainers-video', date);
const planPath = path.join(outDir, 'plan.json');
const lipSyncPath = path.join(outDir, 'lipsync.json');
const slidesDir = path.join(outDir, 'slides');
const audioDir = path.join(outDir, 'audio');
const renderDir = path.join(outDir, 'render');
fs.mkdirSync(renderDir, { recursive: true });

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (r.status !== 0) throw new Error(`${cmd} failed with exit code ${r.status}`);
}
function capture(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout.trim();
}

const vtuberSprite = path.join(root, 'assets', 'daily-gainers-vtuber-sprite.webp');
const vtuberEnabled = process.env.YOUTUBE_VTUBER_ENABLED !== '0'
  && fs.existsSync(lipSyncPath)
  && fs.existsSync(vtuberSprite);

let lipSync = null;
const vtuberAssets = {};
if (vtuberEnabled) {
  lipSync = JSON.parse(fs.readFileSync(lipSyncPath, 'utf8'));

  // The sprite contains four identical presenter poses with only the mouth
  // changed. Cell order: closed, small, o, wide.
  const spriteMeta = JSON.parse(capture('ffprobe', [
    '-v','error','-select_streams','v:0',
    '-show_entries','stream=width,height',
    '-of','json',vtuberSprite
  ]));
  const stream = spriteMeta.streams?.[0];
  const spriteWidth = Number(stream?.width);
  const spriteHeight = Number(stream?.height);
  if (!Number.isInteger(spriteWidth) || !Number.isInteger(spriteHeight) || spriteWidth % 4 !== 0) {
    throw new Error(`Invalid VTuber sprite dimensions: ${spriteWidth}x${spriteHeight}`);
  }
  const cellWidth = spriteWidth / 4;
  const cells = { closed: 0, small: 1, o: 2, wide: 3 };
  for (const [name, index] of Object.entries(cells)) {
    const png = path.join(renderDir, `vtuber-${name}.png`);
    run('ffmpeg', [
      '-y','-loglevel','error','-i',vtuberSprite,
      '-vf',`crop=${cellWidth}:${spriteHeight}:${index * cellWidth}:0`,
      '-frames:v','1',png
    ]);
    vtuberAssets[name] = png;
  }
}

function enableExpression(sceneLipSync, shape) {
  const intervals = (sceneLipSync?.intervals || []).filter(x => x.shape === shape);
  if (!intervals.length) return '0';
  return intervals
    .map(x => `between(t,${Number(x.start).toFixed(3)},${Number(x.end).toFixed(3)})`)
    .join('+');
}

function renderVtuberScene(png, mp3, mp4, duration, sceneId) {
  const sceneLipSync = (lipSync.scenes || []).find(x => Number(x.id) === Number(sceneId));
  if (!sceneLipSync) throw new Error(`Missing VTuber lip sync data for scene ${sceneId}`);

  const smallEnable = enableExpression(sceneLipSync, 'small');
  const wideEnable = enableExpression(sceneLipSync, 'wide');
  const oEnable = enableExpression(sceneLipSync, 'o');

  // Keep the closed-mouth presenter visible at all times. Overlay the other
  // complete presenter states only during their text-derived mouth intervals.
  // This avoids the invalid 16-byte PNG placeholders and avoids concat demuxing.
  const filter = [
    '[0:v]scale=1920:1080,format=rgba[base]',
    '[2:v]scale=390:-1,format=rgba[closed]',
    '[base][closed]overlay=W-w-18:H-h-235:format=auto[v0]',
    '[3:v]scale=390:-1,format=rgba[small]',
    `[v0][small]overlay=W-w-18:H-h-235:enable='${smallEnable}':format=auto[v1]`,
    '[4:v]scale=390:-1,format=rgba[wide]',
    `[v1][wide]overlay=W-w-18:H-h-235:enable='${wideEnable}':format=auto[v2]`,
    '[5:v]scale=390:-1,format=rgba[o]',
    `[v2][o]overlay=W-w-18:H-h-235:enable='${oEnable}':format=auto,format=yuv420p[v]`,
  ].join(';');

  run('ffmpeg', [
    '-y','-loglevel','error',
    '-loop','1','-framerate','24','-i',png,
    '-i',mp3,
    '-loop','1','-framerate','24','-i',vtuberAssets.closed,
    '-loop','1','-framerate','24','-i',vtuberAssets.small,
    '-loop','1','-framerate','24','-i',vtuberAssets.wide,
    '-loop','1','-framerate','24','-i',vtuberAssets.o,
    '-filter_complex',filter,
    '-map','[v]','-map','1:a',
    '-c:v','libx264','-preset','ultrafast','-tune','stillimage',
    '-c:a','aac','-b:a','160k','-pix_fmt','yuv420p',
    '-t',String(duration + 0.15),
    '-shortest',mp4
  ]);
}

// Preflight narration durations before rendering, so the progress UI reflects
// the final timeline instead of assuming each slide is the same length.
const timings = plan.scenes.map(scene => {
  const sid = String(scene.id).padStart(2, '0');
  const mp3 = path.join(audioDir, `${sid}.mp3`);
  if (!fs.existsSync(mp3)) throw new Error(`Missing audio: ${mp3}`);
  const duration = Number(capture('ffprobe', [
    '-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',mp3
  ]));
  if (!Number.isFinite(duration) || duration < 1) throw new Error(`Invalid audio duration for ${mp3}`);
  return { scene, duration, start: 0 };
});
let fullDuration = 0;
for (const timing of timings) {
  timing.start = fullDuration;
  fullDuration += timing.duration + 0.15;
}
// ChatGPT-authored scripts choose scene titles and counts freely.
// Use every actual scene as a progress segment; never assume legacy fixed headings.
if (!Array.isArray(plan.scenes) || plan.scenes.length < 1) {
  throw new Error('Video plan has no scenes');
}
const segments = timings.map((timing, index) => ({
  index: index + 1,
  title: String(timing.scene.title || `第 ${index + 1} 段`),
  start: timing.start,
  end: timing.start + timing.duration + 0.15
}));
const segmentCount = segments.length;
const activeDefs = segments.map(seg => ({
  title: [...seg.title].slice(0, 9).join('')
}));
function findSegment(scene, index) {
  if (!Number.isInteger(index) || index < 0 || index >= segmentCount) {
    throw new Error(`Invalid scene segment index: ${index}`);
  }
  return index;
}
function mmss(seconds) {
  const n = Math.max(0,Math.ceil(seconds));
  return `${String(Math.floor(n / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`;
}
function escapeSvg(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
function writeProgressOverlay(timing, sceneIndex) {
  const index = findSegment(timing.scene, sceneIndex);
  const segWidth = 1110 / segmentCount;
  const rects = segments.map((seg,i) => {
    const x = 290 + i * segWidth, w = segWidth - 8;
    const color = i < index ? '#0ea5e9' : i === index ? '#facc15' : '#334155';
    const titleColor = i === index ? '#ffffff' : i < index ? '#bae6fd' : '#94a3b8';
    return `<text x="${x+w/2}" y="858" font-size="19" text-anchor="middle" fill="${titleColor}">${escapeSvg(seg.title)}</text>
      <rect x="${x}" y="869" width="${w}" height="12" rx="5" fill="${color}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <rect x="0" y="815" width="1920" height="113" fill="#020617" fill-opacity=".96"/>
    <text x="24" y="843" fill="#f8fafc" font-size="25" font-family="Noto Sans CJK TC,sans-serif" font-weight="bold">${escapeSvg(activeDefs[index].title)}</text>
    <text x="24" y="882" fill="#38bdf8" font-size="25" font-family="Noto Sans CJK TC,sans-serif">第 ${index+1} / ${segmentCount} 段</text>
    <text x="1460" y="883" fill="#f8fafc" font-size="23" font-family="Noto Sans CJK TC,sans-serif">總長 ${mmss(fullDuration)}</text>
    ${rects}
  </svg>`;
  const overlaySvg = path.join(renderDir,`progress-${String(timing.scene.id).padStart(2,'0')}.svg`);
  const overlayPng = overlaySvg.replace(/\.svg$/,'.png');
  fs.writeFileSync(overlaySvg,svg);
  run('rsvg-convert',['-w','1920','-h','1080','-o',overlayPng,overlaySvg]);
  return overlayPng;
}
function writeRemainingAss(timing) {
  const assPath = path.join(renderDir,`remaining-${String(timing.scene.id).padStart(2,'0')}.ass`);
  const duration = timing.duration + 0.15;
  const assTime = n => {
    const c = Math.max(0,Math.round(n*100));
    return `${Math.floor(c/360000)}:${String(Math.floor(c/6000)%60).padStart(2,'0')}:${String(Math.floor(c/100)%60).padStart(2,'0')}.${String(c%100).padStart(2,'0')}`;
  };
  const events = [];
  for(let t=0;t<duration;t+=1) {
    events.push(`Dialogue: 0,${assTime(t)},${assTime(Math.min(duration,t+1))},Timer,,0,0,0,,剩餘 ${mmss(fullDuration-timing.start-t)}`);
  }
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Timer,Noto Sans CJK TC,23,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,3,0,22,186,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  fs.writeFileSync(assPath,header+events.join('\n')+'\n');
  return assPath;
}

const concatLines = [];
for (const [sceneIndex, timing] of timings.entries()) {
  const scene = timing.scene;
  const sid = String(scene.id).padStart(2,'0');
  const svg = path.join(slidesDir, `${sid}.svg`);
  const png = path.join(renderDir, `${sid}.png`);
  const mp3 = path.join(audioDir, `${sid}.mp3`);
  const mp4 = path.join(renderDir, `${sid}.mp4`);

  if (!fs.existsSync(svg)) throw new Error(`Missing slide: ${svg}`);
  if (!fs.existsSync(mp3)) throw new Error(`Missing audio: ${mp3}`);

  run('rsvg-convert', ['-w','1920','-h','1080','-o',png,svg]);

  const duration = timing.duration;
  const progressPng = writeProgressOverlay(timing, sceneIndex);
  const remainingAss = writeRemainingAss(timing);
  // Keep the entire lower-third UI above a 152px YouTube two-line caption safe area.
  // Composite the information bar into the slide before the existing four-state
  // lip-sync render. This preserves all presenter mouth intervals.
  const composed = path.join(renderDir, `${sid}-progress.png`);
  run('ffmpeg',['-y','-loglevel','error','-i',png,'-i',progressPng,
    '-filter_complex','[0:v][1:v]overlay=0:0:format=auto','-frames:v','1',composed]);
  // Burn a second-accurate remaining-time ticker into each scene via libass.
  // FFmpeg subtitle escaping is safe because generated paths contain no colons.
  if (vtuberEnabled) {
    const intermediate = path.join(renderDir, `${sid}-lip.mp4`);
    renderVtuberScene(composed, mp3, intermediate, duration, scene.id);
    run('ffmpeg',['-y','-loglevel','error','-i',intermediate,'-vf',`subtitles=${remainingAss}`,
      '-c:v','libx264','-preset','ultrafast','-c:a','copy',mp4]);
  } else {
    run('ffmpeg', [
      '-y','-loglevel','error',
      '-loop','1','-framerate','24','-i',composed,
      '-i',mp3,
      '-c:v','libx264','-preset','ultrafast','-tune','stillimage',
      '-c:a','aac','-b:a','160k','-pix_fmt','yuv420p',
      '-vf',`scale=1920:1080,subtitles=${remainingAss},format=yuv420p`,
      '-t',String(duration + 0.15),
      '-shortest',mp4
    ]);
  }

  concatLines.push(`file '${mp4.replace(/'/g, "'\\''")}'`);
  console.log(`scene ${sid}: ${duration.toFixed(2)}s`);
}

const concatFile = path.join(renderDir, 'concat.txt');
fs.writeFileSync(concatFile, concatLines.join('\n') + '\n');
const finalPath = path.join(outDir, `daily-gainers-${date}.mp4`);

run('ffmpeg', [
  '-y','-loglevel','error',
  '-f','concat','-safe','0','-i',concatFile,
  '-c','copy',
  finalPath
]);

const finalDuration = Number(capture('ffprobe', [
  '-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',finalPath
]));
// Subtitle offsets must use measured rendered MP4 scene lengths, not MP3
// estimates plus a fixed padding. A small per-scene error accumulates.
let measuredCursor = 0;
const renderedScenes = timings.map(timing => {
  const sid = String(timing.scene.id).padStart(2,'0');
  const segmentPath = path.join(renderDir, sid + '.mp4');
  const duration = Number(capture('ffprobe', [
    '-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',segmentPath
  ]));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid rendered segment: '+sid);
  const record = {id:Number(timing.scene.id),start_seconds:measuredCursor,duration_seconds:duration};
  measuredCursor += duration;
  return record;
});
if (Math.abs(measuredCursor-finalDuration) > 0.30) {
  throw new Error('Rendered scene/MP4 timeline divergence: '+measuredCursor+' vs '+finalDuration);
}
fs.writeFileSync(path.join(outDir,'render-timings.json'),
  JSON.stringify({source:'measured-rendered-mp4-segments',duration_seconds:finalDuration,scenes:renderedScenes},null,2)+'\n');
const stat = fs.statSync(finalPath);
const qa = {
  target_date: date,
  scene_count: plan.scenes.length,
  narration_chars: plan.narration_chars,
  duration_seconds: finalDuration,
  duration_minutes: Number((finalDuration / 60).toFixed(2)),
  file_size_bytes: stat.size,
  file_size_mib: Number((stat.size / 1024 / 1024).toFixed(2)),
  duration_pass: finalDuration >= 300 && finalDuration <= 600,
  size_pass: stat.size >= 1024 * 1024,
  vtuber_enabled: vtuberEnabled,
  vtuber_lipsync: vtuberEnabled ? (lipSync.methodology || 'text-aware') : 'disabled',
  vtuber_presenter: vtuberEnabled ? 'assets/daily-gainers-vtuber-sprite.webp' : null,
  segment_count: segmentCount,
  segment_titles: segments.map(s=>s.title),
  progress_bar: 'segmented-caption-safe-v2',
  total_duration_label: mmss(finalDuration)
};
fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
console.log(JSON.stringify(qa, null, 2));

if (!qa.duration_pass) throw new Error(`Video duration ${qa.duration_minutes} min is outside required 5-10 minute validation window`);
if (!qa.size_pass) throw new Error('Rendered video is unexpectedly small');
