#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const { OPENING_TEXT } = require('./daily_gainers_brand_opening');
const MAX_WIDTH = 26;
function captionWidth(value) {
  return [...value].reduce((sum, ch) => sum + (/[^\x00-\xff]/.test(ch) ? 1 : 0.65), 0);
}
function check(ok, message) { if (!ok) throw Error(message); }
function validate(script) {
  check(script.schema_version === 2, 'V2 script required: no V1 fallback');
  check(Array.isArray(script.scenes) && script.scenes.length >= 1, 'Missing V2 scenes');
  script.scenes.forEach((scene, index) => {
    const cues = scene.caption_cues;
    check(Array.isArray(cues) && cues.length > 0, 'Missing paired cues in scene ' + (index + 1));
    check(cues.every(x => typeof x.caption === 'string' && x.caption.length && typeof x.speech === 'string' && x.speech.length), 'Invalid paired cue');
    check(cues.map(x => x.caption).join('') === scene.caption_text, 'Caption content mismatch');
    check(cues.map(x => x.speech).join('') === scene.speech_text, 'Speech content mismatch');
    check(!cues.some(x => /[\r\n]/.test(x.caption)), 'Cue contains preformatted line break');
    check(!cues.some(x => [...x.caption].length > 30), 'Caption cue exceeds 30 code points including punctuation');
    check(!cues.some(x => captionWidth(x.caption) > MAX_WIDTH), 'Caption cue exceeds conservative width budget');
    check(!cues.some(x => /(?:代號[零〇一二兩三四五六七八九]{4}|百分之[零〇一二兩三四五六七八九十百千點]+|[零〇一二兩三四五六七八九][零〇一二兩三四五六七八九十百千萬億點]*(?:元|張))/.test(x.caption)), 'Caption contains spoken-form financial number');
    if (index === 0) {
      check(scene.caption_text.startsWith(OPENING_TEXT), 'Caption brand opening mismatch');
      check(scene.speech_text.startsWith(OPENING_TEXT), 'Speech brand opening mismatch');
    }
  });
  return {status:'PASS',schema_version:2,scenes:script.scenes.length};
}
if (require.main === module) {
  const date = process.argv[2];
  check(/^20\d{6}$/.test(date || ''), 'Expected YYYYMMDD');
  const script = JSON.parse(fs.readFileSync('video_scripts/daily-gainers/' + date + '.json', 'utf8'));
  check(script.target_date === date, 'Date mismatch');
  console.log(JSON.stringify(validate(script)));
}
module.exports = {validate};
