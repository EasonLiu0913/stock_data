'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parseArgs(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result.set(key, true);
    else { result.set(key, next); i += 1; }
  }
  return result;
}

function readFileList(root) {
  const file = path.join(root, 'data_fubon', 'files.json');
  if (!fs.existsSync(file)) throw new Error(`Missing data_fubon/files.json under ${root}`);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(payload)) throw new Error(`data_fubon/files.json under ${root} must be an array`);
  return payload.map(String);
}

function latestInstitutionalDate(files) {
  return files
    .map((file) => String(file).match(/^fubon_(20\d{6})_institutional\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function validateFreshness(sourceRoot, siteRoot) {
  const sourceFiles = readFileList(sourceRoot);
  const siteFiles = readFileList(siteRoot);
  const sourceLatest = latestInstitutionalDate(sourceFiles);
  const siteLatest = latestInstitutionalDate(siteFiles);

  if (!sourceLatest) throw new Error('Source data_fubon/files.json has no institutional snapshots');
  if (!siteLatest) throw new Error('Pages data_fubon/files.json has no institutional snapshots');
  if (siteLatest !== sourceLatest) {
    throw new Error(`Pages Fubon institutional data is stale: source latest=${sourceLatest}, site latest=${siteLatest}`);
  }

  const expectedFile = `fubon_${sourceLatest}_institutional.json`;
  const publishedFile = path.join(siteRoot, 'data_fubon', expectedFile);
  if (!fs.existsSync(publishedFile)) {
    throw new Error(`Pages artifact is missing latest institutional file: data_fubon/${expectedFile}`);
  }

  return {
    source_latest_institutional_date: sourceLatest,
    site_latest_institutional_date: siteLatest,
    published_file: `data_fubon/${expectedFile}`,
    status: 'fresh',
  };
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-fubon-freshness-'));
  const source = path.join(root, 'source');
  const site = path.join(root, 'site');
  fs.mkdirSync(path.join(source, 'data_fubon'), { recursive: true });
  fs.mkdirSync(path.join(site, 'data_fubon'), { recursive: true });

  const sourceFiles = [
    'files.json',
    'fubon_20260924_institutional.json',
    'fubon_20261002_institutional.json',
  ];
  const siteFiles = [
    'files.json',
    'fubon_20260924_institutional.json',
    'fubon_20261002_institutional.json',
  ];
  fs.writeFileSync(path.join(source, 'data_fubon', 'files.json'), JSON.stringify(sourceFiles));
  fs.writeFileSync(path.join(site, 'data_fubon', 'files.json'), JSON.stringify(siteFiles));
  fs.writeFileSync(path.join(site, 'data_fubon', 'fubon_20261002_institutional.json'), '{}');

  const ok = validateFreshness(source, site);
  if (ok.site_latest_institutional_date !== '20261002') throw new Error('self-test expected latest 20261002');

  fs.writeFileSync(
    path.join(site, 'data_fubon', 'files.json'),
    JSON.stringify(['files.json', 'fubon_20260924_institutional.json'])
  );
  let failed = false;
  try {
    validateFreshness(source, site);
  } catch (error) {
    failed = String(error.message).includes('stale');
  }
  if (!failed) throw new Error('self-test expected stale Pages manifest to fail');

  console.log('validate_pages_fubon_freshness self-test passed');
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--self-test') {
    runSelfTest();
    return;
  }
  const args = parseArgs(argv);
  const sourceRoot = path.resolve(String(args.get('source') || '.'));
  const siteRoot = path.resolve(String(args.get('site') || '_site'));
  console.log(JSON.stringify(validateFreshness(sourceRoot, siteRoot), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Failed Pages Fubon freshness validation: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { latestInstitutionalDate, validateFreshness };
