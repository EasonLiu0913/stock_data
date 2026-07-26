#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, '概念股清單.html');
const OUTPUT_DIR = path.join(ROOT, 'data_concept_stocks');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'concept-stock-lists.json');

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function parseConceptLists(html) {
  const headings = [...html.matchAll(/<span class="concept_sub" id="([^"]+)">([\s\S]*?)<\/span>/g)]
    .map((match) => ({
      source_id: match[1],
      name: stripTags(match[2]).replace(/概念股$/, '').trim(),
      index: match.index,
    }));

  return headings.map((heading, index) => {
    const block = html.slice(heading.index, headings[index + 1]?.index ?? html.length);
    const stocks = [];
    const seen = new Set();

    for (const row of block.matchAll(/<tr class="[^"]*">([\s\S]*?)<\/tr>/g)) {
      const firstCell = (row[1].match(/<td[\s\S]*?<\/td>/) || [])[0] || '';
      const stockMatch = firstCell.match(/<a href="\/stock\/(\d{4,6})"[^>]*>([\s\S]*?)<\/a>/);
      if (!stockMatch) continue;

      const code = stockMatch[1];
      if (seen.has(code)) continue;
      seen.add(code);
      stocks.push({ code, name: stripTags(stockMatch[2]) });
    }

    return {
      id: heading.source_id,
      name: heading.name,
      count: stocks.length,
      stocks,
    };
  }).filter((concept) => concept.count > 0);
}

function main() {
  const html = fs.readFileSync(SOURCE_FILE, 'utf8');
  const concepts = parseConceptLists(html);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    source_file: path.relative(ROOT, SOURCE_FILE),
    lists: concepts,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT_FILE),
    concepts: concepts.length,
    memberships: concepts.reduce((total, concept) => total + concept.count, 0),
  }));
}

main();
