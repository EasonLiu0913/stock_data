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

function fail(message) {
  throw new Error(message);
}

function validateRegistry() {
  const registry = loadRegistry();
  const ids = new Set();
  const canonicalFiles = new Set();
  const legacyFiles = new Set();

  for (const [index, page] of registry.pages.entries()) {
    const prefix = `pages[${index}]`;
    for (const key of ['id', 'file', 'title', 'description']) {
      if (!String(page?.[key] ?? '').trim()) fail(`${prefix}.${key} is required`);
    }
    if (!/^[a-z0-9_]+$/.test(page.id)) fail(`${prefix}.id must match [a-z0-9_]+: ${page.id}`);
    if (!/^[^/]+\.html$/.test(page.file)) fail(`${prefix}.file must be a public root HTML filename: ${page.file}`);
    if (ids.has(page.id)) fail(`Duplicate page id: ${page.id}`);
    if (canonicalFiles.has(page.file)) fail(`Duplicate canonical page file: ${page.file}`);
    ids.add(page.id);
    canonicalFiles.add(page.file);

    const legacy = Array.isArray(page.legacy_files) ? page.legacy_files : [];
    for (const legacyFile of legacy) {
      if (!/^[^/]+\.html$/.test(legacyFile)) fail(`Invalid legacy file for ${page.id}: ${legacyFile}`);
      if (legacyFile === page.file) fail(`Legacy file duplicates canonical file for ${page.id}: ${legacyFile}`);
      if (legacyFiles.has(legacyFile)) fail(`Duplicate legacy file: ${legacyFile}`);
      legacyFiles.add(legacyFile);
    }
  }

  for (const page of enabledPages(registry)) {
    const file = path.join(ROOT, 'public', page.file);
    if (!fs.existsSync(file)) fail(`Enabled registry page is missing: public/${page.file}`);
  }

  for (const legacyFile of legacyFiles) {
    if (canonicalFiles.has(legacyFile)) fail(`Legacy file conflicts with another canonical page: ${legacyFile}`);
  }

  return { registry, ids, canonicalFiles, legacyFiles };
}

function validateIndex() {
  const source = fs.readFileSync(INDEX_FILE, 'utf8');
  const generated = generateIndex(source);
  if (source !== generated) {
    fail('public/index.html tool list is out of sync; run: node scripts/generate_public_index.js');
  }
  return source;
}

function main() {
  const { registry, legacyFiles } = validateRegistry();
  validateIndex();
  console.log(JSON.stringify({
    ok: true,
    registered_pages: registry.pages.length,
    enabled_pages: enabledPages(registry).length,
    legacy_files: legacyFiles.size,
    index: path.relative(ROOT, INDEX_FILE),
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { validateIndex, validateRegistry };
