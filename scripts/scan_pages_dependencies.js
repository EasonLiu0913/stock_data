'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ASSET_PATTERN = /\.(?:html|js|mjs|css)$/i;

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (ASSET_PATTERN.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function gitObjectType(rootDir, candidate) {
  try {
    return execFileSync(
      'git',
      ['-C', rootDir, 'cat-file', '-t', `HEAD:${candidate}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch (_error) {
    return '';
  }
}

function repositoryObjectType(rootDir, candidate) {
  const candidatePath = path.join(rootDir, candidate);
  if (fs.existsSync(candidatePath)) {
    const stats = fs.statSync(candidatePath);
    if (stats.isDirectory()) return 'tree';
    if (stats.isFile()) return 'blob';
  }
  return gitObjectType(rootDir, candidate);
}

function extractCandidates(text) {
  const directories = new Set();
  const files = new Set();

  const directoryPatterns = [
    /(?:\.\.\/)+([A-Za-z0-9_.-]+)\//g,
    /\/stock_data\/([A-Za-z0-9_.-]+)\//g,
    /\$\{[^}]+\}\/((?:data|normalized|config)[A-Za-z0-9_.-]*)\//g,
    /(?:^|[^A-Za-z0-9_.-])((?:data|normalized|config)[A-Za-z0-9_.-]*)\//gm,
  ];
  const filePatterns = [
    /(?:\.\.\/)+([A-Za-z0-9_.-]+\.(?:json|csv|txt|xml|html|js|mjs|css))/g,
    /\/stock_data\/([A-Za-z0-9_.-]+\.(?:json|csv|txt|xml|html|js|mjs|css))/g,
  ];
  const assignedDirectoryPattern =
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:dir|root|path|base|folder)\s*=\s*['"`](?:(?:\.\.\/)+|\.\/)?([A-Za-z0-9_.-]+)['"`]/gi;
  const quotedDataRootPattern =
    /['"`](?:(?:\.\.\/)+|\.\/)?((?:data|normalized|config)[A-Za-z0-9_.-]*)['"`]/g;

  for (const pattern of directoryPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) directories.add(match[1]);
  }
  for (const pattern of filePatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) files.add(match[1]);
  }
  assignedDirectoryPattern.lastIndex = 0;
  for (const match of text.matchAll(assignedDirectoryPattern)) directories.add(match[1]);
  quotedDataRootPattern.lastIndex = 0;
  for (const match of text.matchAll(quotedDataRootPattern)) directories.add(match[1]);

  return { directories, files };
}

function scanDependencies(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const publicRoot = path.join(resolvedRoot, 'public');
  if (!fs.existsSync(publicRoot)) {
    throw new Error(`Missing public directory: ${publicRoot}`);
  }

  const dependencies = new Set(['data_predictions']);
  const references = new Map();

  function record(candidate, sourceFile) {
    if (!references.has(candidate)) references.set(candidate, new Set());
    references.get(candidate).add(path.relative(resolvedRoot, sourceFile));
  }

  for (const filePath of walk(publicRoot)) {
    const text = fs.readFileSync(filePath, 'utf8');
    const candidates = extractCandidates(text);

    for (const candidate of candidates.directories) {
      if (!candidate || candidate === 'public' || candidate === 'stock_data') continue;
      if (repositoryObjectType(resolvedRoot, candidate) === 'tree') {
        dependencies.add(candidate);
        record(candidate, filePath);
      }
    }
    for (const candidate of candidates.files) {
      if (repositoryObjectType(resolvedRoot, candidate) === 'blob') {
        dependencies.add(candidate);
        record(candidate, filePath);
      }
    }
  }

  return {
    dependencies: [...dependencies].sort(),
    references: Object.fromEntries(
      [...references.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([dependency, sourceFiles]) => [dependency, [...sourceFiles].sort()])
    ),
  };
}

function runSelfTest() {
  const source = `
    const DATA_DIR = 'data_twse_margin_balance';
    const sourceRoot = 'data_twse_mi_index';
    const reportFolder = 'custom_report_root';
    const RELATIVE_DATA_ROOT = '../data_daily_gain_over_5';
    fetch(\`${'${getBasePath()}'}\/${'${DATA_DIR}'}/files.json\`);
    fetch(\`${'${basePath}'}/data_fubon/files.json\`);
    fetch(\`${'${basePath}'}/${'${reportFolder}'}/manifest.json\`);
    fetch(\`${'${RELATIVE_DATA_ROOT}'}/files.json\`);
    fetch('../config/strategy-tag-registry.json');
    fetch('/stock_data/data_prediction_analysis/strategy-snapshots/manifest.json');
  `;
  const { directories } = extractCandidates(source);
  for (const expected of [
    'data_twse_margin_balance',
    'data_twse_mi_index',
    'data_fubon',
    'custom_report_root',
    'data_daily_gain_over_5',
    'config',
    'data_prediction_analysis',
  ]) {
    if (!directories.has(expected)) {
      throw new Error(`Dependency scanner self-test missed ${expected}`);
    }
  }
  console.log('scan_pages_dependencies self-test passed');
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--self-test') {
    runSelfTest();
    return;
  }

  const jsonMode = args[0] === '--json';
  const rootDir = jsonMode ? (args[1] || '.') : (args[0] || '.');
  const result = scanDependencies(rootDir);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  for (const dependency of result.dependencies) {
    process.stdout.write(`${dependency}\n`);
  }
}

if (require.main === module) main();

module.exports = {
  extractCandidates,
  scanDependencies,
};
