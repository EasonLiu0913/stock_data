'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildProspectiveSnapshot, snapshotRelativePath } = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');
const { buildFourthWindowLongitudinalAudit } = require('../scripts/audit_institutional_accumulation_catalyst_prospective_fourth_window_longitudinal');

const ROOT = 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit';
const STOCKS = ['1102', '1104', '1216'];
const INTERFACES = ['prospective_material_information_detail', 'prospective_material_information_listing'];
const METHODOLOGY = 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1';
const PARSER = 'institutional-accumulation-catalyst-prospective-canary-parser-v1';

function repo() { return fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-fourth-window-')); }
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

test('accepts exactly four complete windows with fourth-window cross-day spacing', () => {
  const root = repo();
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, 11, 14, 'w3');
  addWindow(root, 22, 14, 'w4');
  const audit = buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT });
  assert.equal(audit.observation_count, 24);
  assert.equal(audit.chain_count, 6);
  assert.equal(audit.fourth_window_gate.later_asia_taipei_date, true);
  assert.equal(audit.fourth_window_gate.minimum_elapsed_satisfied, true);
  assert.equal(audit.fourth_window_gate.latest_third_asia_taipei_date, '2026-09-11');
  assert.equal(audit.fourth_window_gate.earliest_fourth_asia_taipei_date, '2026-09-22');
});

test('fifth window preserves frozen fourth-window evidence', () => {
  const root = repo();
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, 11, 14, 'w3');
  addWindow(root, 22, 14, 'w4');
  const before = buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT });
  addWindow(root, 23, 14, 'w5');
  const after = buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT });
  assert.deepEqual(after, before);
});

test('three windows are not enough for fourth-window evidence', () => {
  const root = repo();
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, 11, 14, 'w3');
  assert.throws(() => buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT }), /unexpected_observation_shape/);
});

test('fourth window on same Asia-Taipei date fails closed', () => {
  const root = repo();
  addWindow(root, 10, 1, 'w1');
  addWindow(root, 10, 2, 'w2');
  addWindow(root, 11, 1, 'w3');
  addWindow(root, 11, 2, 'w4');
  assert.throws(() => buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT }), /cross_day_requirement_failed/);
});

test('later local date but less than 12 elapsed hours fails closed', () => {
  const root = repo();
  addWindow(root, 10, 13, 'w1');
  addWindow(root, 10, 14, 'w2');
  addWindow(root, 11, 14, 'w3');
  addWindow(root, 11, 17, 'w4');
  assert.throws(() => buildFourthWindowLongitudinalAudit(root, { rootRelative: ROOT }), /minimum_elapsed_requirement_failed/);
});
