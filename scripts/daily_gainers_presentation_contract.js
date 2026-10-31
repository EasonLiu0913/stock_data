'use strict';
// Research-only prospective MVP10-V4 content contract. Do not alter historical evidence.
const VERSION = 'TAIWAN-STOCK-MVP10-V4-20261031';
const BRAND = 'TAIWANSTOCK｜每日5%強勢股研究';
const OBSOLETE_CC_PROMPT = /\bCC\b|ＣＣ|(?:歡迎|請)?(?:打開|開啟|打開來|啟用)\s*(?:繁體|中文)?字幕(?:觀賞)?|中文字幕觀賞/iu;
const FIELDS = ['title','subtitle','narration','footer','speech_text','caption_text','display_text'];
function rejectObsoleteCC(value, context = 'content') {
  if (typeof value === 'string' && OBSOLETE_CC_PROMPT.test(value)) {
    throw new Error('Obsolete CC prompt forbidden in ' + context);
  }
  return value;
}
function verifySceneContent(scene, index) {
  if (!scene || typeof scene !== 'object') throw new Error('Invalid scene ' + index);
  for (const field of FIELDS) rejectObsoleteCC(scene[field], 'scene ' + index + '.' + field);
  for (const field of ['bullets','caption_cues']) {
    if (!Array.isArray(scene[field])) continue;
    scene[field].forEach((item,j) => {
      const context = 'scene ' + index + '.' + field + '[' + j + ']';
      if (typeof item === 'string') rejectObsoleteCC(item,context);
      else if (item && typeof item === 'object') {
        for (const key of ['caption','speech','text','display']) rejectObsoleteCC(item[key],context + '.' + key);
      }
    });
  }
  return true;
}
function verifyPresentationDocument(document) {
  if (!document || !Array.isArray(document.scenes) || !document.scenes.length) throw new Error('Missing presentation scenes');
  document.scenes.forEach((s,i)=>verifySceneContent(s,i+1));
  return {version:VERSION,scene_count:document.scenes.length,obsolete_cc_prompt_allowed:false};
}
module.exports = {VERSION,BRAND,rejectObsoleteCC,verifySceneContent,verifyPresentationDocument};
