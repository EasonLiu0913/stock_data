#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TAG_EXPRESSION_ENTRYPOINT = 'prediction-tag-strategy-expression-semantics.js?v=1';
const FORMULA_BUILDER_ENTRYPOINT = 'prediction-formula-builder.js?v=1';
const TARGETS = Object.freeze({
  'prediction-dashboard.html': FORMULA_BUILDER_ENTRYPOINT,
  'prediction-groups.html': TAG_EXPRESSION_ENTRYPOINT,
  'prediction-industry-dashboard.html': TAG_EXPRESSION_ENTRYPOINT,
  'prediction-replay-dashboard-view.html': 'prediction-replay-tag-strategy-enhancement.js?v=2',
});
const EXTRA_SCRIPTS = Object.freeze({
  'prediction-dashboard.html': [FORMULA_BUILDER_ENTRYPOINT],
});

const FILTER_ADAPTER_MARKER = 'function matchesTagStrategyFilter(stock)';
const GROUP_EXPERIMENT_MARKER = 'function usesAllStocksForTagStrategyExperiment()';
const GROUP_EMPTY_MESSAGE_MARKER = "const emptyMessage=usesAllStocksForTagStrategyExperiment()";

function scriptPattern(script) {
  const base = script.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<script\\s+src=["']${base}(?:\\?[^"']*)?["']\\s*><\\/script>`, 'i');
}

function legacyPredictionScriptPattern() {
  return /<script\s+src=["']prediction-tag-strategy-enhancement\.js(?:\?[^"']*)?["']\s*><\/script>/i;
}

function dashboardLegacyTagUiPattern() {
  return /[ \t]*<script\s+src=["']prediction-(?:tag-strategy-enhancement|tag-strategy-expression-semantics)\.js(?:\?[^"']*)?["']\s*><\/script>\s*/gi;
}

function removeDashboardLegacyTagUi(html) {
  return html.replace(dashboardLegacyTagUiPattern(), '\n');
}

function injectScript(html, script) {
  let updated = script === FORMULA_BUILDER_ENTRYPOINT
    ? removeDashboardLegacyTagUi(html)
    : html;
  const pattern = scriptPattern(script);
  const tag = `<script src="${script}"></script>`;
  if (pattern.test(updated)) return updated.replace(pattern, tag);
  if (script === TAG_EXPRESSION_ENTRYPOINT && legacyPredictionScriptPattern().test(updated)) {
    return updated.replace(legacyPredictionScriptPattern(), tag);
  }
  if (/<\/body>/i.test(updated)) return updated.replace(/<\/body>/i, `  ${tag}\n</body>`);
  if (/<\/html>/i.test(updated)) return updated.replace(/<\/html>/i, `${tag}\n</html>`);
  return `${updated.trimEnd()}\n${tag}\n`;
}

function injectScripts(html, scripts) {
  return scripts.reduce((updated, script) => injectScript(updated, script), html);
}

function injectAnchor(html, sectionPattern) {
  if (html.includes('id="marketEnvironmentBanner"')) return html;
  return html.replace(sectionPattern, '<div id="marketEnvironmentBanner" hidden></div>\n    $&');
}

function groupFilterAdapterBlock() {
  return `let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];
    const quickFilters={};let activeQuickFilter='';
    function matchesTagStrategyFilter(stock){const filter=quickFilters[activeQuickFilter];return !filter||filter.test(stock);}
    function setQuickFilter(key){activeQuickFilter=key||'';if(dashboard)renderStocks();}
    function usesAllStocksForTagStrategyExperiment(){return Boolean(activeQuickFilter&&quickFilters[activeQuickFilter]);}
    function stocksForCurrentView(memberSet){return usesAllStocksForTagStrategyExperiment()?dashboard.stocks:dashboard.stocks.filter(stock=>memberSet.has(stock.stock_code));}
    function stockListTitle(rowCount){const filter=quickFilters[activeQuickFilter];return filter?\`標籤策略實驗：\${filter.label||'自訂組合'}｜從全部 \${dashboard.stocks.length.toLocaleString('zh-TW')} 檔篩選，符合 \${rowCount.toLocaleString('zh-TW')} 檔\`:\`\${selected.group}：\${Number(selected.count||0).toLocaleString('zh-TW')} 檔\`;}`;
}

function injectGroupAdapter(html) {
  let updated = injectAnchor(html, /<section class="grid group-grid"/);
  if (!updated.includes(FILTER_ADAPTER_MARKER)) {
    updated = updated.replace(
      'let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];',
      groupFilterAdapterBlock(),
    );
  } else if (!updated.includes(GROUP_EXPERIMENT_MARKER)) {
    updated = updated.replace(
      "function setQuickFilter(key){activeQuickFilter=key||'';if(dashboard)renderStocks();}",
      `function setQuickFilter(key){activeQuickFilter=key||'';if(dashboard)renderStocks();}
    function usesAllStocksForTagStrategyExperiment(){return Boolean(activeQuickFilter&&quickFilters[activeQuickFilter]);}
    function stocksForCurrentView(memberSet){return usesAllStocksForTagStrategyExperiment()?dashboard.stocks:dashboard.stocks.filter(stock=>memberSet.has(stock.stock_code));}
    function stockListTitle(rowCount){const filter=quickFilters[activeQuickFilter];return filter?\`標籤策略實驗：\${filter.label||'自訂組合'}｜從全部 \${dashboard.stocks.length.toLocaleString('zh-TW')} 檔篩選，符合 \${rowCount.toLocaleString('zh-TW')} 檔\`:\`\${selected.group}：\${Number(selected.count||0).toLocaleString('zh-TW')} 檔\`;}`,
    );
  }

  updated = updated.replace(
    'const rows=dashboard.stocks.filter(s=>matchesTagStrategyFilter(s)&&memberSet.has(s.stock_code)',
    'const rows=stocksForCurrentView(memberSet).filter(s=>matchesTagStrategyFilter(s)',
  );
  updated = updated.replace(
    'const rows=dashboard.stocks.filter(s=>memberSet.has(s.stock_code)',
    'const rows=stocksForCurrentView(memberSet).filter(s=>matchesTagStrategyFilter(s)',
  );
  updated = updated.replace(
    'function renderStocks(){if(!selected)return;document.getElementById(\'groupTitle\').textContent=`${selected.group}：${selected.count.toLocaleString()} 檔`;const q=',
    'function renderStocks(){if(!selected)return;const q=',
  );

  if (!updated.includes(GROUP_EMPTY_MESSAGE_MARKER)) {
    updated = updated.replace(
      "document.getElementById('stockRows').innerHTML=rows.map",
      "document.getElementById('groupTitle').textContent=stockListTitle(rows.length);const emptyMessage=usesAllStocksForTagStrategyExperiment()?'目前沒有股票符合這組標籤條件':'此分類目前沒有符合股票';document.getElementById('stockRows').innerHTML=rows.map",
    );
    updated = updated.replace(
      "||'<tr class=\"empty-row\"><td colspan=\"15\">此分類目前沒有符合股票</td></tr>';",
      "||`<tr class=\"empty-row\"><td colspan=\"15\">${emptyMessage}</td></tr>`;",
    );
  }

  if (!updated.includes("document.querySelector('[data-clear-tag-strategy]')?.click()")) {
    updated = updated.replace(
      'function selectGroup(name){selected=orderedGroups.find(g=>g.group===decodeURIComponent(name));',
      "function selectGroup(name){document.querySelector('[data-clear-tag-strategy]')?.click();activeQuickFilter='';selected=orderedGroups.find(g=>g.group===decodeURIComponent(name));",
    );
  }
  return updated;
}

function injectIndustryAdapter(html) {
  let updated = injectAnchor(html, /<section class="grid layout"/);
  if (!updated.includes(FILTER_ADAPTER_MARKER)) {
    updated = updated.replace(
      'let dashboard, basePriceData=null, selected, currentManifest;',
      `let dashboard, basePriceData=null, selected, currentManifest;
    const quickFilters={};let activeQuickFilter='';
    function matchesTagStrategyFilter(stock){const filter=quickFilters[activeQuickFilter];return !filter||filter.test(stock);}
    function setQuickFilter(key){activeQuickFilter=key||'';if(dashboard&&selected)renderIndustry();}`,
    );
  }
  updated = updated.replace(
    'const rows=dashboard.stocks.filter(s=>s.industry===selected.industry)',
    'const rows=dashboard.stocks.filter(s=>matchesTagStrategyFilter(s)&&s.industry===selected.industry)',
  );
  return updated;
}

function injectPageAdapter(html, filename) {
  if (filename === 'prediction-groups.html') return injectGroupAdapter(html);
  if (filename === 'prediction-industry-dashboard.html') return injectIndustryAdapter(html);
  return html;
}

function install(publicDir = PUBLIC_DIR, options = {}) {
  const changed = [];
  const missing = [];
  for (const [filename, script] of Object.entries(TARGETS)) {
    const file = path.join(publicDir, filename);
    if (!fs.existsSync(file)) {
      missing.push(filename);
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    const adapted = injectPageAdapter(source, filename);
    const scripts = [script, ...(EXTRA_SCRIPTS[filename] || [])];
    const updated = injectScripts(adapted, scripts);
    if (updated === source) continue;
    changed.push(filename);
    if (!options.dryRun) fs.writeFileSync(file, updated, 'utf8');
  }
  return { changed, missing, targets: Object.keys(TARGETS) };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const result = install(PUBLIC_DIR, { dryRun });
  if (result.missing.length) throw new Error(`Missing target pages: ${result.missing.join(', ')}`);
  console.log(JSON.stringify({ ...result, dry_run: dryRun }, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  PUBLIC_DIR,
  TARGETS,
  EXTRA_SCRIPTS,
  TAG_EXPRESSION_ENTRYPOINT,
  FORMULA_BUILDER_ENTRYPOINT,
  FILTER_ADAPTER_MARKER,
  GROUP_EXPERIMENT_MARKER,
  scriptPattern,
  legacyPredictionScriptPattern,
  dashboardLegacyTagUiPattern,
  removeDashboardLegacyTagUi,
  injectScript,
  injectScripts,
  injectPageAdapter,
  install,
  main,
};
