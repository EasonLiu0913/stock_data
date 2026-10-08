#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const date = process.argv[2];
if (!/^20\d{6}$/.test(date || '')) throw Error('Expected YYYYMMDD');
const root = 'data_daily_gain_over_5';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const raw = read(path.join(root, date + '.json'));
const ai = read(path.join(root, 'analysis-ai', date + '.json'));
const summary = read(path.join(root, 'market-summary', date + '.json'));
const script = read(path.join('video_scripts', 'daily-gainers', date + '.json'));
function check(cond, msg) { if (!cond) throw Error(msg); }
check(raw.target_date === date && ai.target_date === date && summary.target_date === date && script.target_date === date, 'date mismatch');
check(summary.status === 'final' && summary.coverage?.overall === 'complete', 'summary not final/complete');
check(raw.stock_count === raw.stocks.length && ai.stock_count === raw.stock_count && script.stock_count === raw.stock_count, 'stock count mismatch');
check(script.schema_version === 1 && script.methodology_version === 'chatgpt-video-script-v1', 'script schema mismatch');
check(script.source_summary_generated_at === summary.generated_at, 'stale script: source summary timestamp differs');
check(Array.isArray(script.scenes) && script.scenes.length >= 5 && script.scenes.length <= 20, 'scene count must be 5-20');
const codes = new Set(raw.stocks.map(s => String(s.code)));
let chars = 0;
for (const [i,s] of script.scenes.entries()) {
  check(typeof s.title === 'string' && s.title.trim().length > 0 && s.title.length <= 85, 'invalid scene title ' + i);
  check(typeof s.subtitle === 'string' && s.subtitle.length <= 160, 'invalid scene subtitle ' + i);
  check(Array.isArray(s.bullets) && s.bullets.length <= 5 && s.bullets.every(b=>typeof b === 'string' && b.length <= 220), 'invalid bullets ' + i);
  check(typeof s.narration === 'string' && s.narration.length >= 75 && s.narration.length <= 1800, 'invalid narration ' + i);
  check(!s.stock_codes || (Array.isArray(s.stock_codes) && s.stock_codes.every(c => codes.has(String(c)))), 'invalid stock code ' + i);
  chars += [...s.narration].length;
}
check(chars >= 1100 && chars <= 5500, 'narration length outside video bounds: ' + chars);
check(script.privacy_status === 'private', 'video must be private');
console.log(JSON.stringify({target_date:date,scenes:script.scenes.length,narration_chars:chars,status:'PASS'}));
