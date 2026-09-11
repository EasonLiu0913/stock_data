'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildProspectiveSnapshot, snapshotRelativePath } = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');
const { buildCrossDayAudit } = require('../scripts/audit_institutional_accumulation_catalyst_prospective_cross_day_window');

const ROOT = 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit';
const STOCKS = ['1102', '1104', '1216'];
const INTERFACES = ['prospective_material_information_detail', 'prospective_material_information_listing'];
const METHODOLOGY = 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1';
const PARSER = 'institutional-accumulation-catalyst-prospective-canary-parser-v1';

function repo() { return fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-cross-day-')); }
function key(stock, iface) { return iface.endsWith('_listing') ? `${stock}|115|all` : `${stock}|1150101|1|sii`; }
function snap(stock, iface, at, raw) {
  return buildProspectiveSnapshot({ source_provider: 'MOPS', source_interface: iface, source_request_key: key(stock, iface), collected_at: at, source_reported_at: null, source_timestamp_precision: 'collection_timestamp_only', parser_version: PARSER, methodology_identity: METHODOLOGY, raw_response: Buffer.from(raw) });
}
function write(root, snapshot) {
  const relative = snapshotRelativePath(snapshot);
  const absolute = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(snapshot, null, 2)}\n`);
}
function addWindow(root, day, hour, suffix) {
  let minute = 0;
  for (const stock of STOCKS) for (const iface of INTERFACES) {
    write(root, snap(stock, iface, `2026-09-${day}T${String(hour).padStart(2, '0')}:${String(minute++).padStart(2, '0')}:00.000Z`, `${stock}|${iface}|${suffix}`));
  }
}
function buildThree(root, thirdDay = 11, thirdHour = 14) {
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, thirdDay, thirdHour, 'w3');
}

test('accepts exactly three complete windows with cross-day spacing', () => {
  const root = repo();
  buildThree(root);
  const audit = buildCrossDayAudit(root, { rootRelative: ROOT });
  assert.equal(audit.observation_count, 18);
  assert.equal(audit.chain_count, 6);
  assert.equal(audit.cross_day_gate.later_asia_taipei_date, true);
  assert.equal(audit.cross_day_gate.minimum_elapsed_satisfied, true);
  assert.equal(audit.cross_day_gate.earliest_third_asia_taipei_date, '2026-09-11');
});

test('same Asia/Taipei date fails closed', () => {
  const root = repo();
  addWindow(root, 10, 1, 'w1');
  addWindow(root, 10, 2, 'w2');
  addWindow(root, 10, 3, 'w3');
  assert.throws(() => buildCrossDayAudit(root, { rootRelative: ROOT }), /cross_day_requirement_failed/);
});

test('later local date but less than 12 elapsed hours fails closed', () => {
  const root = repo();
  addWindow(root, 10, 14, 'w1');
  addWindow(root, 10, 15, 'w2');
  addWindow(root, 10, 17, 'w3');
  assert.throws(() => buildCrossDayAudit(root, { rootRelative: ROOT }), /minimum_elapsed_requirement_failed/);
});

test('partial third window fails closed through canonical observation audit', () => {
  const root = repo();
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, 11, 14, 'w3');
  const all = [];
  function walk(p) { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const a = path.join(p, e.name); if (e.isDirectory()) walk(a); else all.push(a); } }
  walk(path.join(root, ...ROOT.split('/')));
  fs.unlinkSync(all.sort().at(-1));
  assert.throws(() => buildCrossDayAudit(root, { rootRelative: ROOT }), /incomplete_observation_window/);
});

test('fourth window fails closed through bounded observation window policy', () => {
  const root = repo();
  buildThree(root);
  addWindow(root, 12, 14, 'w4');
  assert.throws(() => buildCrossDayAudit(root, { rootRelative: ROOT }), /unexpected_observation_window_count/);
});
