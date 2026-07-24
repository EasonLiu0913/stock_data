'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateForecastPayload } = require('./schema');
const { renderForecastHtml } = require('./renderer');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_TEMPLATE = path.join(ROOT, 'templates', 'prediction_template.html');

function getDefaultOutputPath(data) {
  const compactDate = String(data.forecast_date).replaceAll('-', '');
  return path.join(ROOT, 'public', 'predictions', `${compactDate}-${data.stock_code}.html`);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function generateForecastFile({ inputPath, templatePath = DEFAULT_TEMPLATE, outputPath }) {
  const data = validateForecastPayload(loadJson(inputPath));
  const template = fs.readFileSync(templatePath, 'utf8');
  const resolvedOutput = outputPath || getDefaultOutputPath(data);
  const html = renderForecastHtml(data, template);

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, html, 'utf8');

  return {
    data,
    html,
    outputPath: resolvedOutput,
  };
}

module.exports = {
  DEFAULT_TEMPLATE,
  generateForecastFile,
  getDefaultOutputPath,
  loadJson,
};
