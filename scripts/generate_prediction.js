#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { generateForecastFile } = require('../src/forecast/generator');

function parseArgs(argv) {
  const args = [...argv];
  const input = args.shift();
  let output;
  let template;

  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === '--output') output = value;
    else if (flag === '--template') template = value;
    else throw new Error(`Unknown option: ${flag}`);
  }

  if (!input) {
    throw new Error('Usage: node scripts/generate_prediction.js <forecast.json> [--output file] [--template file]');
  }

  return {
    inputPath: path.resolve(input),
    outputPath: output ? path.resolve(output) : undefined,
    templatePath: template ? path.resolve(template) : undefined,
  };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = generateForecastFile(options);
    console.log(result.outputPath);
  } catch (error) {
    console.error(`[forecast] ${error.message}`);
    process.exitCode = 1;
  }
}

main();
