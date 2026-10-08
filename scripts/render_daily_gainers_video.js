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
function captureBuffer(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: null, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr || '')}`);
  return r.stdout;
}

const vtuberDir = path.join(root, 'assets', 'vtuber', 'daily-gainers');
const vtuberAssets = {
  closed: path.join(vtuberDir, 'closed.webp'),
  small: path.join(vtuberDir, 'small.webp'),
  o: path.join(vtuberDir, 'o.webp'),
  wide: path.join(vtuberDir, 'wide.webp'),
};
const vtuberEnabled = process.env.YOUTUBE_VTUBER_ENABLED !== '0'
  && Object.values(vtuberAssets).every(p => fs.existsSync(p));

function buildLipSyncConcat(mp3, sid) {
  const sampleRate = 8000;
  const stepSeconds = 0.10;
  const samplesPerStep = Math.round(sampleRate * stepSeconds);
  const pcm = captureBuffer('ffmpeg', [
    '-v','error','-i',mp3,'-ac','1','-ar',String(sampleRate),'-f','s16le','pipe:1'
  ]);
  const sampleCount = Math.floor(pcm.length / 2);
  const rms = [];
  for (let start = 0; start < sampleCount; start += samplesPerStep) {
    const end = Math.min(sampleCount, start + samplesPerStep);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const v = pcm.readInt16LE(i * 2) / 32768;
      sumSq += v * v;
    }
    rms.push(Math.sqrt(sumSq / Math.max(1, end - start)));
  }
  const voiced = rms.filter(v => v > 0.003).sort((a,b) => a-b);
  const p90 = voiced.length ? voiced[Math.floor((voiced.length - 1) * 0.90)] : 0.02;
  const reference = Math.max(0.012, p90);
  const choose = (v, index) => {
    const n = v / reference;
    if (n < 0.10) return 'closed';
    if (n < 0.32) return 'small';
    if (n < 0.62) return index % 2 === 0 ? 'o' : 'small';
    return index % 3 === 0 ? 'o' : 'wide';
  };
  const lines = [];
  let last = 'closed';
  rms.forEach((v, i) => {
    last = choose(v, i);
    lines.push(`file '${vtuberAssets[last].replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${stepSeconds.toFixed(2)}`);
  });
  lines.push(`file '${vtuberAssets[last].replace(/'/g, "'\\''")}'`);
  const listPath = path.join(renderDir, `vtuber-${sid}.txt`);
  fs.writeFileSync(listPath, lines.join('\n') + '\n');
  return listPath;
}

const concatLines = [];
const durations = [];
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
  durations.push(duration);

  if (vtuberEnabled) {
    const lipSyncList = buildLipSyncConcat(mp3, sid);
    run('ffmpeg', [
      '-y','-loglevel','error',
      '-loop','1','-framerate','24','-i',png,
      '-f','concat','-safe','0','-i',lipSyncList,
      '-i',mp3,
      '-filter_complex',
      '[0:v]scale=1920:1080[base];[1:v]fps=24,scale=430:-1[avatar];[base][avatar]overlay=W-w-24:H-h+42:format=auto,format=yuv420p[v]',
      '-map','[v]','-map','2:a',
      '-c:v','libx264','-preset','ultrafast','-tune','stillimage',
      '-c:a','aac','-b:a','160k','-pix_fmt','yuv420p',
      '-t',String(duration + 0.15),
      '-shortest',mp4
    ]);
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
  vtuber_lipsync: vtuberEnabled ? 'audio-rms-100ms-4-state' : 'disabled'
};
fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
console.log(JSON.stringify(qa, null, 2));

if (!qa.duration_pass) throw new Error(`Video duration ${qa.duration_minutes} min is outside required 5-10 minute validation window`);
if (!qa.size_pass) throw new Error('Rendered video is unexpectedly small');
