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

const vtuberDir = path.join(root, 'assets', 'vtuber', 'daily-gainers');
const sourceAssets = {
  closed: path.join(vtuberDir, 'closed.webp'),
  small: path.join(vtuberDir, 'small.webp'),
  wide: path.join(vtuberDir, 'wide.webp'),
  o: path.join(vtuberDir, 'o.webp'),
};
const vtuberEnabled = process.env.YOUTUBE_VTUBER_ENABLED !== '0'
  && fs.existsSync(lipSyncPath)
  && Object.values(sourceAssets).every(p => fs.existsSync(p));

let lipSync = null;
const vtuberAssets = {};
if (vtuberEnabled) {
  lipSync = JSON.parse(fs.readFileSync(lipSyncPath, 'utf8'));
  for (const [name, source] of Object.entries(sourceAssets)) {
    const png = path.join(renderDir, `vtuber-${name}.png`);
    run('ffmpeg', ['-y','-loglevel','error','-i',source,png]);
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
    '[base][closed]overlay=W-w-18:H-h:format=auto[v0]',
    '[3:v]scale=390:-1,format=rgba[small]',
    `[v0][small]overlay=W-w-18:H-h:enable='${smallEnable}':format=auto[v1]`,
    '[4:v]scale=390:-1,format=rgba[wide]',
    `[v1][wide]overlay=W-w-18:H-h:enable='${wideEnable}':format=auto[v2]`,
    '[5:v]scale=390:-1,format=rgba[o]',
    `[v2][o]overlay=W-w-18:H-h:enable='${oEnable}':format=auto,format=yuv420p[v]`,
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

const concatLines = [];
for (const scene of plan.scenes) {
  const sid = String(scene.id).padStart(2,'0');
  const svg = path.join(slidesDir, `${sid}.svg`);
  const png = path.join(renderDir, `${sid}.png`);
  const mp3 = path.join(audioDir, `${sid}.mp3`);
  const mp4 = path.join(renderDir, `${sid}.mp4`);

  if (!fs.existsSync(svg)) throw new Error(`Missing slide: ${svg}`);
  if (!fs.existsSync(mp3)) throw new Error(`Missing audio: ${mp3}`);

  run('rsvg-convert', ['-w','1920','-h','1080','-o',png,svg]);

  const duration = Number(capture('ffprobe', [
    '-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',mp3
  ]));
  if (!Number.isFinite(duration) || duration < 1) throw new Error(`Invalid audio duration for ${mp3}`);

  if (vtuberEnabled) {
    renderVtuberScene(png, mp3, mp4, duration, scene.id);
  } else {
    run('ffmpeg', [
      '-y','-loglevel','error',
      '-loop','1','-framerate','24','-i',png,
      '-i',mp3,
      '-c:v','libx264','-preset','ultrafast','-tune','stillimage',
      '-c:a','aac','-b:a','160k','-pix_fmt','yuv420p',
      '-vf','scale=1920:1080,format=yuv420p',
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
  vtuber_presenter: vtuberEnabled ? 'assets/vtuber/daily-gainers/closed.webp' : null
};
fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
console.log(JSON.stringify(qa, null, 2));

if (!qa.duration_pass) throw new Error(`Video duration ${qa.duration_minutes} min is outside required 5-10 minute validation window`);
if (!qa.size_pass) throw new Error('Rendered video is unexpectedly small');
