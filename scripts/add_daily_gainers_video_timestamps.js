#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function timestamp(seconds) {
  const t = Math.max(0, Math.floor(seconds + 0.000001));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

function buildStockIndex(scenes, durations, stocks = []) {
  const stockNames = new Map(stocks.map(stock => [String(stock.code), String(stock.name)]));
  if (durations.length !== scenes.length) throw new Error('Scene/audio count mismatch');
  const entries = [];
  let elapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const duration = Number(durations[i]);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid duration at scene ${i+1}`);
    const match = String(scenes[i].title || '').match(/^(.+?)（([0-9]{4,6})）$/);
    if (match) entries.push(`${match[1]}(${match[2]}) ${timestamp(elapsed)}`);
    else for (const code of [...new Set(scenes[i].stock_codes || [])]) {
      const name = stockNames.get(String(code));
      if (!name) throw new Error(`Unknown stock code in video scene ${i + 1}: ${code}`);
      entries.push(`${name}(${code}) ${timestamp(elapsed)}`);
    }
    elapsed += duration + 0.15; // same audio padding as render_daily_gainers_video.js
  }
  return entries;
}

function appendStockIndex(description, entries) {
  const base = String(description || '').replace(/\n*影片提及股票與時間：\n[\s\S]*$/, '').trimEnd();
  return entries.length ? `${base}\n\n影片提及股票與時間：\n${entries.join('\n')}` : base;
}

function audioDuration(file) {
  const result = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',file], {encoding:'utf8'});
  if (result.status !== 0) throw new Error(`ffprobe failed for ${file}: ${result.stderr}`);
  return Number(result.stdout.trim());
}

function main(date, root = process.cwd()) {
  if (!/^20\d{6}$/.test(date || '')) throw new Error('Usage: node scripts/add_daily_gainers_video_timestamps.js YYYYMMDD');
  const folder = path.join(root,'output','daily-gainers-video',date);
  const plan = JSON.parse(fs.readFileSync(path.join(folder,'plan.json'),'utf8'));
  const metaPath = path.join(folder,'metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metaPath,'utf8'));
  const durations = plan.scenes.map(scene=>audioDuration(path.join(folder,'audio',String(scene.id).padStart(2,'0')+'.mp3')));
  const raw = JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',date+'.json'),'utf8'));
  const entries = buildStockIndex(plan.scenes, durations, raw.stocks);
  if (!entries.length) throw new Error('No named stock scenes found; refusing to upload a missing index');
  metadata.description = appendStockIndex(metadata.description,entries);
  fs.writeFileSync(metaPath,JSON.stringify(metadata,null,2)+'\n');
  console.log(JSON.stringify({date,stock_count:entries.length,entries},null,2));
}

if (require.main === module) main(process.argv[2]);
module.exports = {timestamp, buildStockIndex, appendStockIndex};
