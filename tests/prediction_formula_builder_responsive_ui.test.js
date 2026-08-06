'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'prediction-formula-builder.js'),
  'utf8',
);

test('drop zones keep a fixed size instead of expanding on hover', () => {
  assert.match(source, /\.pf-slot\{[^}]*height:38px;min-height:38px/);
  assert.doesNotMatch(source, /\.pf-slot:hover,\.pf-slot\.over\{height:/);
  assert.match(source, /\.pf-slot span\{[^}]*opacity:0;visibility:hidden/);
});

test('desktop drag state uses handles and nested enter leave accounting', () => {
  assert.match(source, /data-drag-handle/);
  assert.match(source, /const dragDepth=new WeakMap\(\)/);
  assert.match(source, /addEventListener\('dragenter'/);
  assert.match(source, /addEventListener\('dragleave'/);
  assert.match(source, /panel\.classList\.add\('is-dragging'\)/);
});

test('mobile UI provides add, reorder, move and bottom sheet controls', () => {
  assert.match(source, /id="pfMobileSheet"/);
  assert.match(source, /data-a="pick"/);
  assert.match(source, /data-a="up"/);
  assert.match(source, /data-a="down"/);
  assert.match(source, /data-a="move"/);
  assert.match(source, /data-a="sheet-tag"/);
  assert.match(source, /data-a="sheet-group"/);
  assert.match(source, /@media\(max-width:720px\),\(pointer:coarse\)/);
});

test('mobile changes expose an undo toast', () => {
  assert.match(source, /id="pfToast"/);
  assert.match(source, /data-a="toast-undo"/);
  assert.match(source, /showToast\(/);
});
