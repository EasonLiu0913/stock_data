#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'config', 'public-page-registry.json');
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');
const TOOLS_BLOCK_RE = /const tools = \[[\s\S]*?\n\s*\];/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function escapeJs(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
}

function loadRegistry() {
  const registry = readJson(REGISTRY_FILE);
  if (registry?.schema_version !== 1 || !Array.isArray(registry.pages)) {
    throw new Error('config/public-page-registry.json must use schema_version=1 and contain pages[]');
  }
  return registry;
}

function enabledPages(registry = loadRegistry()) {
  return registry.pages
    .filter((page) => page.enabled !== false)
    .slice()
    .sort((a, b) => Number(a.order ?? 999999) - Number(b.order ?? 999999) || String(a.id).localeCompare(String(b.id)));
}

function renderToolsBlock(registry = loadRegistry()) {
  const lines = enabledPages(registry).map((page) =>
    `            { file: '${escapeJs(page.file)}', title: '${escapeJs(page.title)}', description: '${escapeJs(page.description)}' }`
  );
  return `const tools = [\n${lines.join(',\n')}\n        ];`;
}

function generateIndex(source = fs.readFileSync(INDEX_FILE, 'utf8'), registry = loadRegistry()) {
  if (!TOOLS_BLOCK_RE.test(source)) {
    throw new Error('public/index.html is missing the canonical const tools = [...] block');
  }
  return source.replace(TOOLS_BLOCK_RE, renderToolsBlock(registry));
}

function updateIndex({ check = false } = {}) {
  const source = fs.readFileSync(INDEX_FILE, 'utf8');
  const generated = generateIndex(source);
  if (source === generated) return { changed: false, pages: enabledPages().length };
  if (check) throw new Error('public/index.html tool list is out of sync with config/public-page-registry.json');
  fs.writeFileSync(INDEX_FILE, generated, 'utf8');
  return { changed: true, pages: enabledPages().length };
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const result = updateIndex({ check });
  console.log(JSON.stringify({ mode: check ? 'check' : 'write', index: path.relative(ROOT, INDEX_FILE), registry: path.relative(ROOT, REGISTRY_FILE), ...result }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { ROOT, REGISTRY_FILE, INDEX_FILE, enabledPages, generateIndex, loadRegistry, renderToolsBlock, updateIndex };
