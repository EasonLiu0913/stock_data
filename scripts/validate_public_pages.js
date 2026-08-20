#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  INDEX_FILE,
  enabledPages,
  generateIndex,
  loadRegistry,
} = require('./generate_public_index');

const PUBLIC_DIR = path.join(ROOT, 'public');

function fail(message) {
  throw new Error(message);
}

function isRootHtmlFilename(value) {
  return /^[^/]+\.html$/.test(String(value || ''));
}

function validateRegistry() {
  const registry = loadRegistry();
  const ids = new Set();
  const canonicalFiles = new Set();
  const legacyFiles = new Set();
  const nonHomepageFiles = new Set();

  for (const [index, page] of registry.pages.entries()) {
    const prefix = `pages[${index}]`;
    for (const key of ['id', 'file', 'title', 'description']) {
      if (!String(page?.[key] ?? '').trim()) fail(`${prefix}.${key} is required`);
    }
    if (!/^[a-z0-9_]+$/.test(page.id)) fail(`${prefix}.id must match [a-z0-9_]+: ${page.id}`);
    if (!isRootHtmlFilename(page.file)) fail(`${prefix}.file must be a public root HTML filename: ${page.file}`);
    if (ids.has(page.id)) fail(`Duplicate page id: ${page.id}`);
    if (canonicalFiles.has(page.file)) fail(`Duplicate canonical page file: ${page.file}`);
    ids.add(page.id);
    canonicalFiles.add(page.file);

    const legacy = Array.isArray(page.legacy_files) ? page.legacy_files : [];
    for (const legacyFile of legacy) {
      if (!isRootHtmlFilename(legacyFile)) fail(`Invalid legacy file for ${page.id}: ${legacyFile}`);
      if (legacyFile === page.file) fail(`Legacy file duplicates canonical file for ${page.id}: ${legacyFile}`);
      if (legacyFiles.has(legacyFile)) fail(`Duplicate legacy file: ${legacyFile}`);
      legacyFiles.add(legacyFile);
    }
  }

  const nonHomepage = Array.isArray(registry.non_homepage_html) ? registry.non_homepage_html : [];
  for (const [index, entry] of nonHomepage.entries()) {
    const prefix = `non_homepage_html[${index}]`;
    if (!isRootHtmlFilename(entry?.file)) fail(`${prefix}.file must be a public root HTML filename`);
    if (!String(entry?.reason ?? '').trim()) fail(`${prefix}.reason is required for ${entry?.file || '(unknown)'}`);
    if (nonHomepageFiles.has(entry.file)) fail(`Duplicate non-homepage HTML file: ${entry.file}`);
    if (canonicalFiles.has(entry.file)) fail(`Non-homepage file conflicts with canonical page: ${entry.file}`);
    if (legacyFiles.has(entry.file)) fail(`Non-homepage file conflicts with legacy page: ${entry.file}`);
    nonHomepageFiles.add(entry.file);
  }

  for (const page of enabledPages(registry)) {
    const file = path.join(PUBLIC_DIR, page.file);
    if (!fs.existsSync(file)) fail(`Enabled registry page is missing: public/${page.file}`);
  }

  for (const legacyFile of legacyFiles) {
    if (canonicalFiles.has(legacyFile)) fail(`Legacy file conflicts with another canonical page: ${legacyFile}`);
    const file = path.join(PUBLIC_DIR, legacyFile);
    if (!fs.existsSync(file)) fail(`Declared legacy page is missing: public/${legacyFile}`);
  }

  for (const file of nonHomepageFiles) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, file))) fail(`Declared non-homepage page is missing: public/${file}`);
  }

  return { registry, ids, canonicalFiles, legacyFiles, nonHomepageFiles };
}

function validateIndex() {
  const source = fs.readFileSync(INDEX_FILE, 'utf8');
  const generated = generateIndex(source);
  if (source !== generated) {
    fail('public/index.html tool list is out of sync; run: node scripts/generate_public_index.js');
  }
  return source;
}

function validatePublicHtmlCoverage(classification) {
  const { canonicalFiles, legacyFiles, nonHomepageFiles } = classification;
  const classified = new Set(['index.html', ...canonicalFiles, ...legacyFiles, ...nonHomepageFiles]);
  const rootHtmlFiles = fs.readdirSync(PUBLIC_DIR)
    .filter((file) => isRootHtmlFilename(file))
    .sort();
  const unclassified = rootHtmlFiles.filter((file) => !classified.has(file));
  if (unclassified.length) {
    fail(
      `Unclassified public root HTML page(s): ${unclassified.map((file) => `public/${file}`).join(', ')}. ` +
      'Homepage-visible pages must be added to config/public-page-registry.json pages[]; intentional detail/embedded/research pages must be added to non_homepage_html[] with a reason.'
    );
  }
  return { rootHtmlFiles, unclassified };
}

function validateDailyGainersResponsiveContract() {
  const htmlFile = path.join(PUBLIC_DIR, 'daily-gainers-over-5.html');
  const adapterFile = path.join(PUBLIC_DIR, 'components', 'daily-gainers-mobile-cards.js');
  const cardFile = path.join(PUBLIC_DIR, 'components', 'responsive-stock-card.js');

  for (const file of [htmlFile, adapterFile, cardFile]) {
    if (!fs.existsSync(file)) fail(`Daily gainers responsive dependency is missing: ${path.relative(ROOT, file)}`);
  }

  const html = fs.readFileSync(htmlFile, 'utf8');
  const adapter = fs.readFileSync(adapterFile, 'utf8');

  if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">')) {
    fail('daily-gainers-over-5.html must keep the mobile viewport meta tag');
  }
  if (!html.includes('<script src="components/responsive-stock-card.js"></script>')) {
    fail('daily-gainers-over-5.html must load responsive-stock-card.js');
  }
  if (!html.includes('<script src="components/daily-gainers-mobile-cards.js"></script>')) {
    fail('daily-gainers-over-5.html must load daily-gainers-mobile-cards.js');
  }
  if (!html.includes('class="card table-wrap" id="content"')) {
    fail('daily-gainers-over-5.html desktop table container contract changed');
  }
  if (!html.includes('class="mobile-content" id="mobileContent"')) {
    fail('daily-gainers-over-5.html mobile card container contract changed');
  }

  const mobileMedia = html.match(/@media\s*\(max-width:\s*760px\)\s*\{([\s\S]*?)\n\s*\}/);
  if (!mobileMedia) fail('daily-gainers-over-5.html must define the canonical 760px mobile breakpoint');
  const mobileCss = mobileMedia[1];
  if (!/\.table-wrap\s*\{\s*display:\s*none;\s*\}/.test(mobileCss)) {
    fail('daily-gainers-over-5.html must hide the desktop table at <=760px');
  }
  if (!/\.mobile-content\s*\{\s*display:\s*block;\s*\}/.test(mobileCss)) {
    fail('daily-gainers-over-5.html must show mobile cards at <=760px');
  }

  if (!adapter.includes('DailyGainersMobileCards') || !adapter.includes('ResponsiveStockCard.render')) {
    fail('daily-gainers-mobile-cards.js must render through ResponsiveStockCard');
  }
  if (!html.includes('DailyGainersMobileCards.render(mobileContent')) {
    fail('daily-gainers-over-5.html must render the mobile adapter for every loaded date');
  }

  return {
    breakpoint_px: 760,
    html: path.relative(ROOT, htmlFile),
    adapter: path.relative(ROOT, adapterFile),
    card_component: path.relative(ROOT, cardFile),
  };
}

function main() {
  const classification = validateRegistry();
  validateIndex();
  const coverage = validatePublicHtmlCoverage(classification);
  const dailyGainersResponsive = validateDailyGainersResponsiveContract();
  console.log(JSON.stringify({
    ok: true,
    registered_pages: classification.registry.pages.length,
    enabled_pages: enabledPages(classification.registry).length,
    legacy_files: classification.legacyFiles.size,
    non_homepage_html: classification.nonHomepageFiles.size,
    classified_root_html: coverage.rootHtmlFiles.length,
    daily_gainers_responsive: dailyGainersResponsive,
    index: path.relative(ROOT, INDEX_FILE),
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = {
  validateDailyGainersResponsiveContract,
  validateIndex,
  validatePublicHtmlCoverage,
  validateRegistry,
};