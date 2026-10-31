'use strict';
// MVP10 research-only opening. Never silently reintroduce the obsolete CC reminder.
const OPENING_LINES = Object.freeze([
  '大家好，歡迎來到 TAIWAN STOCK！',
  '追蹤資金，解讀行情。',
  '錢在哪，我們就在哪！',
  '那麼我們開始囉。'
]);
const OPENING_TEXT = OPENING_LINES.join('');
const LEGACY_OPENING_TEXT = OPENING_LINES.slice(0, 3).join('');
const OBSOLETE_CC = /(?:歡迎)?(?:打開|開啟)\s*CC\s*(?:中文字幕)?(?:觀賞)?/i;

function addOpening(narration) {
  if (typeof narration !== 'string' || !narration.trim()) throw new Error('Missing first-scene narration');
  const trimmed = narration.trim();
  if (OBSOLETE_CC.test(trimmed)) throw new Error('Obsolete CC opening reminder prohibited');
  if (trimmed.startsWith(OPENING_TEXT)) return trimmed;
  if (trimmed.startsWith(LEGACY_OPENING_TEXT)) {
    // Historical three-line scripts can be upgraded without altering their daily analysis.
    return OPENING_TEXT + trimmed.slice(LEGACY_OPENING_TEXT.length).trimStart();
  }
  if (/^(大家好|歡迎來到|追蹤資金|錢在哪|那麼我們)/.test(trimmed)) {
    throw new Error('First-scene opening conflicts with immutable TAIWAN STOCK V4 opening');
  }
  return OPENING_TEXT + '\n' + trimmed;
}
function assertOpening(narration) {
  if (typeof narration !== 'string' || !narration.trimStart().startsWith(OPENING_TEXT)) {
    throw new Error('First scene does not begin with exact immutable TAIWAN STOCK V4 opening');
  }
  if (OBSOLETE_CC.test(narration)) throw new Error('Obsolete CC opening reminder prohibited');
}
module.exports = { OPENING_LINES, OPENING_TEXT, addOpening, assertOpening };
