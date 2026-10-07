#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const planArg = process.argv[2];
if (!planArg) {
  console.error('Usage: node scripts/build_daily_gainers_srt.js <plan.json>');
  process.exit(1);
}

const planPath = path.resolve(planArg);
if (!fs.existsSync(planPath)) throw new Error(`Missing plan: ${planPath}`);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const audioDir = path.join(path.dirname(planPath), 'audio');
const outPath = path.join(path.dirname(planPath), `daily-gainers-${plan.target_date}.zh-TW.srt`);

function durationSeconds(file) {
  const r = spawnSync('ffprobe', [
    '-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1', file
  ], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed for ${file}: ${r.stderr}`);
  const n = Number(r.stdout.trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid audio duration for ${file}`);
  return n;
}

function splitSubtitleText(text, maxChars = 24) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [normalized];
  const chunks = [];
  for (const raw of sentences) {
    let sentence = raw.trim();
    while ([...sentence].length > maxChars) {
      const chars = [...sentence];
      let cut = Math.min(maxChars, chars.length);
      const floor = Math.max(8, Math.floor(maxChars * 0.55));
      for (let i = cut; i >= floor; i--) {
        if ('，、：,: '.includes(chars[i - 1])) { cut = i; break; }
      }
      chunks.push(chars.slice(0, cut).join('').trim());
      sentence = chars.slice(cut).join('').trim();
    }
    if (sentence) chunks.push(sentence);
  }
  return chunks.filter(Boolean);
}

function fmtSrt(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const z = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(z).padStart(3,'0')}`;
}

let cursor = 0;
let cueNo = 1;
const cues = [];
const sceneTiming = [];

for (const scene of plan.scenes || []) {
  const sid = String(scene.id).padStart(2, '0');
  const audio = path.join(audioDir, `${sid}.mp3`);
  if (!fs.existsSync(audio)) throw new Error(`Missing audio: ${audio}`);
  const duration = durationSeconds(audio);
  const chunks = splitSubtitleText(scene.narration);
  if (!chunks.length) continue;

  const weights = chunks.map(c => Math.max(1, [...c].filter(ch => !/\s|[，。！？、；：,.!?;:]/.test(ch)).length));
  const totalWeight = weights.reduce((a,b) => a + b, 0);
  let local = cursor;
  for (let i = 0; i < chunks.length; i++) {
    const remainingDuration = cursor + duration - local;
    const remainingCues = chunks.length - i;
    let allocated = duration * (weights[i] / totalWeight);
    const min = Math.min(1.2, remainingDuration / remainingCues);
    allocated = Math.max(min, allocated);
    if (i === chunks.length - 1 || local + allocated > cursor + duration) {
      allocated = cursor + duration - local;
    }
    const start = local;
    const end = Math.max(start + 0.25, local + allocated);
    cues.push(`${cueNo++}\n${fmtSrt(start)} --> ${fmtSrt(end)}\n${chunks[i]}\n`);
    local = end;
  }
  sceneTiming.push({ id: scene.id, start_seconds: cursor, duration_seconds: duration, cue_count: chunks.length });
  cursor += duration + 0.15;
}

fs.writeFileSync(outPath, cues.join('\n') + '\n', 'utf8');
const manifest = {
  schema_version: 1,
  target_date: plan.target_date,
  language: 'zh-TW',
  source: 'scene narration + exact TTS scene durations',
  cue_count: cueNo - 1,
  duration_seconds: Number(cursor.toFixed(3)),
  subtitle_file: path.basename(outPath),
  scenes: sceneTiming
};
fs.writeFileSync(path.join(path.dirname(planPath), 'subtitle-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
