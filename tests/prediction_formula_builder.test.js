'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const builder = require('../public/prediction-formula-builder');

const stocks = [
  { stock_code: 'A', atomic_tags: ['A'] },
  { stock_code: 'B', atomic_tags: ['B'] },
  { stock_code: 'AB', atomic_tags: ['A', 'B'] },
  { stock_code: 'C', atomic_tags: ['C'] },
  { stock_code: 'DE', atomic_tags: ['D', 'E'] },
  { stock_code: 'ADE', atomic_tags: ['A', 'D', 'E'] },
];

function codes(root) {
  return stocks.filter(stock => builder.evaluateNode(root, stock)).map(stock => stock.stock_code);
}

test('evaluates explicit nested groups with standard AND precedence', () => {
  const root = builder.createGroup({ id: 'root', children: [
    builder.createGroup({ id: 'g1', children: [
      builder.createTagNode('A'),
      builder.createTagNode('B', { join: 'AND' }),
    ] }),
    builder.createGroup({ id: 'g2', join: 'OR', children: [
      builder.createTagNode('A'),
      builder.createGroup({ id: 'g3', join: 'OR', children: [
        builder.createTagNode('D'),
        builder.createTagNode('E', { join: 'AND' }),
      ] }),
    ] }),
  ] });
  assert.deepEqual(codes(root), ['A', 'AB', 'DE', 'ADE']);
});

test('mixed connectors in one group evaluate AND before OR', () => {
  const root = builder.createGroup({ id: 'root', children: [
    builder.createTagNode('A'),
    builder.createTagNode('B', { join: 'AND' }),
    builder.createTagNode('C', { join: 'OR' }),
  ] });
  assert.deepEqual(codes(root), ['AB', 'C']);
});

test('node NOT applies to tags and groups', () => {
  const root = builder.createGroup({ id: 'root', children: [
    builder.createTagNode('A'),
    builder.createTagNode('B', { join: 'AND', negated: true }),
  ] });
  assert.deepEqual(codes(root), ['A', 'ADE']);

  const negated = builder.createGroup({ id: 'root', children: [
    builder.createGroup({ id: 'g1', negated: true, children: [builder.createTagNode('A')] }),
  ] });
  assert.deepEqual(codes(negated), ['B', 'C', 'DE']);
});

test('wraps contiguous siblings into a nested group and preserves outer connector', () => {
  const root = builder.createGroup({ id: 'root', children: [
    builder.createTagNode('A', { id: 'a' }),
    builder.createTagNode('B', { id: 'b', join: 'OR' }),
    builder.createTagNode('C', { id: 'c', join: 'AND' }),
  ] });
  const group = builder.wrapNodes(root, new Set(['b', 'c']));
  assert.ok(group);
  assert.equal(root.children.length, 2);
  assert.equal(group.join, 'OR');
  assert.equal(group.children[0].join, 'AND');
  assert.equal(builder.formulaText(root, new Map([['A', 'A'], ['B', 'B'], ['C', 'C']])), 'A OR (B AND C)');
});

test('rejects wrapping non-contiguous or cross-parent selections', () => {
  const nested = builder.createGroup({ id: 'g', children: [builder.createTagNode('C', { id: 'c' })] });
  const root = builder.createGroup({ id: 'root', children: [
    builder.createTagNode('A', { id: 'a' }),
    builder.createTagNode('B', { id: 'b' }),
    nested,
  ] });
  assert.equal(builder.wrapNodes(root, new Set(['a', 'g'])), null);
  assert.equal(builder.wrapNodes(root, new Set(['a', 'c'])), null);
});

test('moves nodes between groups with default AND and prevents recursive moves', () => {
  const child = builder.createGroup({ id: 'child', children: [builder.createTagNode('B', { id: 'b' })] });
  const parent = builder.createGroup({ id: 'parent', children: [builder.createTagNode('A', { id: 'a' }), child] });
  const root = builder.createGroup({ id: 'root', children: [parent, builder.createTagNode('C', { id: 'c', join: 'OR' })] });
  assert.equal(builder.moveNode(root, 'c', 'child', 1), true);
  assert.equal(builder.findNode(root, 'c').parent.id, 'child');
  assert.equal(builder.findNode(root, 'c').node.join, 'AND');
  assert.equal(builder.moveNode(root, 'parent', 'child', 0), false);
});

test('ungroups non-negated groups and blocks negated groups', () => {
  const group = builder.createGroup({ id: 'g', join: 'OR', children: [
    builder.createTagNode('B'),
    builder.createTagNode('C', { join: 'AND' }),
  ] });
  const root = builder.createGroup({ id: 'root', children: [builder.createTagNode('A'), group] });
  assert.equal(builder.ungroupNode(root, 'g'), true);
  assert.equal(builder.formulaText(root, new Map([['A', 'A'], ['B', 'B'], ['C', 'C']])), 'A OR B AND C');
  const negated = builder.createGroup({ id: 'n', negated: true, children: [builder.createTagNode('A')] });
  root.children.push(negated);
  assert.equal(builder.ungroupNode(root, 'n'), false);
});

test('connector cycle exposes AND, OR, AND NOT and OR NOT states', () => {
  const node = builder.createTagNode('A');
  assert.equal(builder.connectorLabel(node), 'AND');
  builder.cycleConnector(node);
  assert.equal(builder.connectorLabel(node), 'OR');
  builder.cycleConnector(node);
  assert.equal(builder.connectorLabel(node), 'AND NOT');
  builder.cycleConnector(node);
  assert.equal(builder.connectorLabel(node), 'OR NOT');
  builder.cycleConnector(node);
  assert.equal(builder.connectorLabel(node), 'AND');
});

test('normalization keeps root stable and fixes first child connector', () => {
  const normalized = builder.normalizeNode({ type: 'group', id: 'wrong', children: [
    { type: 'tag', id: 'x', tagId: 'A', join: 'OR' },
  ] }, true);
  assert.equal(normalized.id, 'root');
  assert.equal(normalized.children[0].join, 'AND');
});