'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CRAWLER_PATH = path.join(__dirname, 'crawl_external_market_indicators.js');

function normalizeAnchor(now = new Date()) {
  const anchor = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(anchor.getTime())) throw new Error(`Invalid external-market anchor time: ${now}`);
  return anchor;
}

function resolveExternalMarketSessionDate(now = new Date()) {
  const anchor = normalizeAnchor(now);
  const anchorIso = anchor.toISOString();
  const bootstrap = `
const anchorIso = ${JSON.stringify(anchorIso)};
const RealDate = Date;
global.Date = class AnchoredDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [anchorIso])); }
  static now() { return new RealDate(anchorIso).getTime(); }
};
process.argv = [process.execPath, ${JSON.stringify(CRAWLER_PATH)}, '--resolve-date'];
require(${JSON.stringify(CRAWLER_PATH)});
`;
  const targetDate = execFileSync(process.execPath, ['-e', bootstrap], { encoding: 'utf8' }).trim();
  if (!/^20\d{6}$/.test(targetDate)) {
    throw new Error(`Existing external-market resolver returned an invalid date: ${targetDate}`);
  }
  return { targetDate, anchorIso };
}

function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--now');
  const raw = index >= 0 ? args[index + 1] : null;
  const result = resolveExternalMarketSessionDate(raw || new Date());
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`${result.targetDate}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { resolveExternalMarketSessionDate };
