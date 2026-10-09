'use strict';
// Immutable spoken brand opening. Do not let daily AI rewrite these sentences.
const OPENING_LINES = Object.freeze([
  '大家好，歡迎來到 TAIWAN STOCK！',
  '追蹤資金，解讀行情。',
  '錢在哪，我們就在哪！'
]);
const OPENING_TEXT = OPENING_LINES.join('');
function addOpening(narration) {
  if (typeof narration !== 'string' || !narration.trim()) throw new Error('Missing first-scene narration');
  const trimmed = narration.trim();
  if (trimmed.startsWith(OPENING_TEXT)) return trimmed;
  let rest = trimmed;
  let complete = true;
  for (const line of OPENING_LINES) {
    if (!rest.startsWith(line)) { complete = false; break; }
    rest = rest.slice(line.length).trimStart();
  }
  if (complete) return OPENING_TEXT + rest;
  if (/^(大家好|歡迎來到|追蹤資金|錢在哪)/.test(trimmed)) {
    throw new Error('First-scene opening conflicts with immutable TAIWAN STOCK brand opening');
  }
  return OPENING_TEXT + '\n' + trimmed;
}
function assertOpening(narration) {
  if (typeof narration !== 'string' || !narration.trimStart().startsWith(OPENING_TEXT)) {
    throw new Error('First scene does not begin with exact immutable TAIWAN STOCK opening');
  }
}
module.exports = { OPENING_LINES, OPENING_TEXT, addOpening, assertOpening };
