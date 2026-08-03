#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TARGETS = Object.freeze({
  'prediction-dashboard.html': 'prediction-tag-strategy-enhancement.js?v=3',
  'prediction-groups.html': 'prediction-tag-strategy-enhancement.js?v=3',
  'prediction-industry-dashboard.html': 'prediction-tag-strategy-enhancement.js?v=3',
  'prediction-replay-dashboard-view.html': 'prediction-replay-tag-strategy-enhancement.js?v=2',
});

const FILTER_ADAPTER_MARKER = 'function matchesTagStrategyFilter(stock)';

function scriptPattern(script) {
  const base = script.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<script\\s+src=["']${base}(?:\\?[^"']*)?["']\\s*><\\/script>`, 'i');
}

function injectScript(html, script) {
  const pattern = scriptPattern(script);
  const tag = `<script src="${script}"></script>`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}\n</html>`);
  return `${html.trimEnd()}\n${tag}\n`;
}

function injectAnchor(html, sectionPattern) {
  if (html.includes('id="marketEnvironmentBanner"')) return html;
  return html.replace(sectionPattern, '<div id="marketEnvironmentBanner" hidden></div>\n    $&');
}

function injectGroupAdapter(html) {
  let updated = injectAnchor(html, /<section class="grid group-grid"/);
  if (!updated.includes(FILTER_ADAPTER_MARKER)) {
    updated = updated.replace(
      'let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];',
      `let dashboard,basePriceData=null,selected,currentManifest,orderedGroups=[];
    const quickFilters={};let activeQuickFilter='';
    function matchesTagStrategyFilter(stock){const filter=quickFilters[activeQuickFilter];return !filter||filter.test(stock);}
    function setQuickFilter(key){activeQuickFilter=key||'';if(dashboard)renderStocks();}`,
    );
  }
  updated = updated.replace(
    'const rows=dashboard.stocks.filter(s=>memberSet.has(s.stock_code)',
    'const rows=dashboard.stocks.filter(s=>matchesTagStrategyFilter(s)&&memberSet.has(s.stock_code)',
  );
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
    const updated = injectScript(adapted, script);
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
  FILTER_ADAPTER_MARKER,
  scriptPattern,
  injectScript,
  injectPageAdapter,
  install,
  main,
};
