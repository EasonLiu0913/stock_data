'use strict';

// Remove accidental adjacent repetition of domain-specific multi-character
// words before the plan is used by captions, TTS, and lip sync.
// Do not touch single-character reduplication (看看、慢慢、天天), or
// arbitrary multi-character repetitions that could be intentional.
const DUPLICATE_WORDS = [
  '追蹤', '觀察', '確認', '分析', '整理', '關注', '檢查',
  '留意', '比較', '評估', '注意', '持續', '驗證', '研究'
];

function normalizeNarrationRepetition(value) {
  let result = String(value ?? '');
  for (const word of DUPLICATE_WORDS) {
    result = result.replace(new RegExp('(' + word + ')(?:[ \\t]*\\1)+', 'g'), '$1');
  }
  return result;
}

module.exports = { normalizeNarrationRepetition };
