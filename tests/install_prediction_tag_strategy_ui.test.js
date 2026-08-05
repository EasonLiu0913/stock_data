'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  TARGETS,
  TAG_EXPRESSION_ENTRYPOINT,
  injectScript,
  injectPageAdapter,
  install,
} = require('../scripts/install_prediction_tag_strategy_ui');
const predictionUi = require('../public/prediction-tag-strategy-enhancement');
const replayUi = require('../public/prediction-replay-tag-strategy-enhancement');

test('injectScript replaces the legacy tag UI with one expression entrypoint', () => {
  const source = '<!doctype html><html><body><script src="prediction-tag-strategy-enhancement.js?v=1"></script></body></html>';
  const updated = injectScript(source, TAG_EXPRESSION_ENTRYPOINT);
  assert.match(updated, /prediction-tag-strategy-expression-semantics\.js\?v=1/);
  assert.equal((updated.match(/prediction-tag-strategy-expression-semantics\.js/g) || []).length, 1);
  assert.equal((updated.match(/prediction-tag-strategy-enhancement\.js/g) || []).length, 0);
});

test('group and industry adapters expose shared quick-filter hooks', () => {
  const groupSource = `<main><div class="topbar"></div><section class="grid group-grid"></section></main><script>
    let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];
    function renderStocks(){const memberSet=new Set(selected.members||[]);const rows=dashboard.stocks.filter(s=>memberSet.has(s.stock_code));document.getElementById('stockRows').innerHTML=rows.map(s=>s.stock_code).join('')||'<tr class="empty-row"><td colspan="15">此分類目前沒有符合股票</td></tr>';}
  </script>`;
  const group = injectPageAdapter(groupSource, 'prediction-groups.html');
  assert.match(group, /function matchesTagStrategyFilter\(stock\)/);
  assert.match(group, /function usesAllStocksForTagStrategyExperiment\(\)/);
  assert.match(group, /function stocksForCurrentView\(memberSet\)/);
  assert.match(group, /stocksForCurrentView\(memberSet\)\.filter\(s=>matchesTagStrategyFilter\(s\)/);
  assert.doesNotMatch(group, /matchesTagStrategyFilter\(s\)&&memberSet\.has/);
  assert.match(group, /id="marketEnvironmentBanner"/);

  const industrySource = `<main><div class="topbar"></div><section class="grid layout"></section></main><script>
    let dashboard, basePriceData=null, selected, currentManifest;
    function renderIndustry(){const rows=dashboard.stocks.filter(s=>s.industry===selected.industry);}
  </script>`;
  const industry = injectPageAdapter(industrySource, 'prediction-industry-dashboard.html');
  assert.match(industry, /function matchesTagStrategyFilter\(stock\)/);
  assert.match(industry, /matchesTagStrategyFilter\(s\)&&s\.industry===selected\.industry/);
  assert.match(industry, /id="marketEnvironmentBanner"/);
});

test('prediction groups page uses all stocks for tag experiments and group members otherwise', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'prediction-groups.html'), 'utf8');
  assert.match(html, /usesAllStocksForTagStrategyExperiment\(\)\?dashboard\.stocks:dashboard\.stocks\.filter/);
  assert.match(html, /stocksForCurrentView\(memberSet\)\.filter\(s=>matchesTagStrategyFilter\(s\)/);
  assert.match(html, /標籤策略實驗：/);
  assert.doesNotMatch(html, /matchesTagStrategyFilter\(s\)&&memberSet\.has\(s\.stock_code\)/);
});

test('installer targets all prediction content pages and is idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-strategy-ui-'));
  const fixtures = {
    'prediction-dashboard.html': '<html><body><main></main><script src="prediction-tag-strategy-enhancement.js?v=4"></script></body></html>',
    'prediction-groups.html': '<html><body><main><section class="grid group-grid"></section></main><script>let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];function renderStocks(){const memberSet=new Set(selected.members||[]);const rows=dashboard.stocks.filter(s=>memberSet.has(s.stock_code));document.getElementById(\'stockRows\').innerHTML=rows.map(s=>s.stock_code).join(\'\')||\'<tr class="empty-row"><td colspan="15">此分類目前沒有符合股票</td></tr>\';}</script><script src="prediction-tag-strategy-enhancement.js?v=4"></script></body></html>',
    'prediction-industry-dashboard.html': '<html><body><main><section class="grid layout"></section></main><script>let dashboard, basePriceData=null, selected, currentManifest;function renderIndustry(){const rows=dashboard.stocks.filter(s=>s.industry===selected.industry);}</script><script src="prediction-tag-strategy-enhancement.js?v=4"></script></body></html>',
  };
  for (const filename of Object.keys(TARGETS)) {
    fs.writeFileSync(path.join(directory, filename), fixtures[filename] || '<html><body><main></main></body></html>');
  }
  const first = install(directory);
  const second = install(directory);
  assert.deepEqual(first.changed.sort(), Object.keys(TARGETS).sort());
  assert.deepEqual(second.changed, []);
  for (const [filename, script] of Object.entries(TARGETS)) {
    const html = fs.readFileSync(path.join(directory, filename), 'utf8');
    assert.match(html, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const filename of ['prediction-dashboard.html', 'prediction-groups.html', 'prediction-industry-dashboard.html']) {
    const html = fs.readFileSync(path.join(directory, filename), 'utf8');
    assert.doesNotMatch(html, /<script\s+src=["']prediction-tag-strategy-enhancement\.js/);
  }
  const installedGroup = fs.readFileSync(path.join(directory, 'prediction-groups.html'), 'utf8');
  assert.match(installedGroup, /stocksForCurrentView\(memberSet\)\.filter\(s=>matchesTagStrategyFilter\(s\)/);
  assert.doesNotMatch(installedGroup, /matchesTagStrategyFilter\(s\)&&memberSet\.has/);
});

test('prediction UI reads canonical registry fields and AND OR NOT selections', () => {
  const payload = predictionUi.normalizePayload({
    forecast_date: '20260803',
    tag_registry: [{ tag_id: 'a' }],
    strategy_registry_v2: [{ strategy_id: 's' }],
    strategy_classifications_v2: { s: { count: 0 } },
    stocks: [{ stock_code: '1', atomic_tags: ['a'], registered_strategy_matches: ['s'] }],
  });
  assert.equal(payload.tags[0].tag_id, 'a');
  assert.equal(payload.strategies[0].strategy_id, 's');
  assert.equal(payload.strategyClassifications.s.count, 0);
  assert.equal(predictionUi.compositeMatches(payload.stocks[0], { all: ['a'], any: [], not: ['b'] }), true);
  assert.equal(predictionUi.compositeMatches(payload.stocks[0], { all: [], any: ['b'], not: [] }), false);
  assert.equal(predictionUi.cycleMode(''), 'all');
  assert.equal(predictionUi.cycleMode('all'), 'any');
  assert.equal(predictionUi.cycleMode('any'), 'not');
  assert.equal(predictionUi.cycleMode('not'), '');
});

test('replay UI evaluates supported targets and keeps unavailable 5-day data unverified', () => {
  assert.deepEqual(replayUi.targetResult({ market_relative: { classification: 'relative_leadership' } }, 'relative_leadership').hit, true);
  assert.equal(replayUi.targetResult({ actual: { close_return: 5.1 } }, 'close_return_gt_5').hit, true);
  assert.equal(replayUi.targetResult({ actual: { max_return_5d: 10 } }, 'intraday_rebound_5d_10pct').hit, true);
  assert.equal(replayUi.targetResult({ actual: {} }, 'intraday_rebound_5d_10pct').verified, false);
});

test('browser enhancement scripts parse as JavaScript', () => {
  for (const filename of [
    'prediction-tag-strategy-enhancement.js',
    'prediction-tag-strategy-expression-semantics.js',
    'prediction-replay-tag-strategy-enhancement.js',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', filename), 'utf8');
    assert.doesNotThrow(() => new vm.Script(source), filename);
  }
});