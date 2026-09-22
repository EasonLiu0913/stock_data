const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('AI material bottleneck event contract keeps event interpretation separate from entry score', () => {
  const eventPath = path.join(root, 'data_ai_material_bottleneck', 'events.json');
  const dashboardPath = path.join(root, 'public', 'ai-material-bottleneck-watchlist.html');
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const html = fs.readFileSync(dashboardPath, 'utf8');

  assert.equal(payload.schema_version, 1);
  assert.ok(Array.isArray(payload.events) && payload.events.length >= 1);

  for (const event of payload.events) {
    assert.match(event.id, /^[a-zA-Z0-9-]+$/);
    assert.match(event.stock_code, /^\d{4,6}$/);
    assert.match(event.event_date, /^20\d{6}$/);
    assert.ok(payload.policy.direction_values.includes(event.direction));
    assert.ok(payload.policy.confidence_values.includes(event.confidence));
    assert.ok(payload.policy.confirmation_values.includes(event.market_confirmation));
    assert.ok(Array.isArray(event.sources) && event.sources.length > 0);
    event.sources.forEach(source => assert.match(source.url, /^https:\/\//));
    for (const window of payload.policy.reaction_windows) {
      assert.ok(event.reaction[window], event.id + ' missing ' + window);
      assert.ok(['pending', 'available', 'unavailable'].includes(event.reaction[window].status));
    }
  }

  assert.match(html, /data_ai_material_bottleneck\/events\.json/);
  assert.match(html, /事件／催化劑/);
  assert.match(html, /D1\/D3\/D5/);
  assert.match(html, /事件訊號獨立於 10 分進場條件雷達/);
  assert.match(html, /id="evt"/);
  assert.match(html, /市場確認與 D1\/D3\/D5/);

  const entryRadar = html.match(/function entryRadar\(x\)\{[\s\S]*?return\{entryScore:/);
  assert.ok(entryRadar, 'entryRadar function not found');
  assert.doesNotMatch(entryRadar[0], /event|catalyst/i);
});
