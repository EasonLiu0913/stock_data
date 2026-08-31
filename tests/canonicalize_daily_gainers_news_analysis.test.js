'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalizePayload } = require('../scripts/canonicalize_daily_gainers_news_analysis');

test('canonicalizes string evidence, follow_up, and URL sources without changing semantics', () => {
  const input = {
    analyses: [{
      code: '6933',
      evidence: 'AI server demand remained strong.',
      follow_up: 'Track monthly revenue.',
      sources: ['https://www.cmoney.tw/notes/note-detail.aspx?nid=1258582'],
    }],
  };
  const { payload, changed } = canonicalizePayload(input);
  assert.equal(changed, true);
  assert.deepEqual(payload.analyses[0].evidence, ['AI server demand remained strong.']);
  assert.deepEqual(payload.analyses[0].follow_up, ['Track monthly revenue.']);
  assert.deepEqual(payload.analyses[0].sources, [{
    title: 'cmoney.tw',
    url: 'https://www.cmoney.tw/notes/note-detail.aspx?nid=1258582',
  }]);
});

test('keeps already-canonical fields unchanged', () => {
  const source = { title: 'Example', url: 'https://example.com/a' };
  const input = { analyses: [{ code: '1', evidence: ['e'], follow_up: ['f'], sources: [source] }] };
  const { payload, changed } = canonicalizePayload(input);
  assert.equal(changed, false);
  assert.deepEqual(payload.analyses[0].sources, [source]);
});

test('rejects non-http source strings instead of hiding invalid data', () => {
  assert.throws(() => canonicalizePayload({
    analyses: [{ code: '1', evidence: 'e', follow_up: 'f', sources: ['not-a-url'] }],
  }), /source invalid 1/);
});
