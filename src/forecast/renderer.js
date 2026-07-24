'use strict';

const METADATA_FIELDS = [
  'methodology_version',
  'generated_at',
  'prediction_mode',
  'stock_code',
  'stock_name',
  'forecast_date',
  'base_trade_date',
  'information_cutoff',
  'market',
  'direction_score',
  'raw_direction_label',
  'risk_score',
  'final_direction_label',
  'data_completeness',
  'missing_data',
  'backtest_rule_id',
  'backtest_status',
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPills(items = []) {
  return items.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join('');
}

function renderCards(items = [], className = 'card') {
  return items.map((item) => [
    `<article class="${escapeHtml(className)}">`,
    `<span class="label">${escapeHtml(item.label)}</span>`,
    `<strong>${escapeHtml(item.value)}</strong>`,
    `<p>${escapeHtml(item.description)}</p>`,
    '</article>',
  ].join('')).join('');
}

function renderScores(items = []) {
  return items.map((item) => {
    const score = Number(item.score ?? 0);
    const cssClass = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    return [
      '<tr>',
      `<td>${escapeHtml(item.item)}</td>`,
      `<td>${escapeHtml(item.value)}</td>`,
      `<td>${escapeHtml(item.rule)}</td>`,
      `<td class="${cssClass}">${escapeHtml(score)}</td>`,
      '</tr>',
    ].join('');
  }).join('');
}

function renderScenarios(items = []) {
  return items.map((item) => [
    '<article class="scenario">',
    `<span class="label">${escapeHtml(item.label)}</span>`,
    `<h3>${escapeHtml(item.title)}</h3>`,
    `<p>${escapeHtml(item.description)}</p>`,
    `<strong>${escapeHtml(item.target)}</strong>`,
    '</article>',
  ].join('')).join('');
}

function renderLevels(items = []) {
  return items.map((item) => [
    '<div class="level">',
    `<span>${escapeHtml(item.type)}</span>`,
    `<strong>${escapeHtml(item.price)}</strong>`,
    `<p>${escapeHtml(item.description)}</p>`,
    '</div>',
  ].join('')).join('');
}

function renderMetadata(data) {
  return METADATA_FIELDS.map((key) => {
    let value = data[key];
    if (Array.isArray(value)) value = value.join(', ') || 'none';
    if (value === null || value === undefined) value = 'null';
    return `<dt>${escapeHtml(key)}</dt><dd><code>${escapeHtml(value)}</code></dd>`;
  }).join('');
}

function applyTemplate(template, variables) {
  return template.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
    if (!(key in variables)) throw new Error(`Template variable not provided: ${key}`);
    return variables[key];
  });
}

function renderForecastHtml(data, template) {
  const view = {
    meta_description: `${data.stock_name}（${data.stock_code}）${data.forecast_date} 下一交易日股價風險與情境預測`,
    page_title: `${data.forecast_date} ${data.stock_name}（${data.stock_code}）下一交易日預測報告`,
    lead: '依固定方法規格，以資訊截止時間前可取得的結構化資料評估下一交易日走勢。',
    hero_pills: [
      `預測日：${data.forecast_date}`,
      `基準交易日：${data.base_trade_date}`,
      `資訊截止：${data.information_cutoff}`,
      `市場：${data.market}`,
    ],
    verdict_title: data.final_direction_label,
    verdict_summary: '方向標籤由固定分數及風險降級規則產生。',
    risk_label: data.risk_label ?? '風險未標示',
    forecast_cards: [],
    facts: [],
    scores: [],
    scenarios: [],
    levels: [],
    data_note: '請檢查 missing_data 與 data_completeness 後再解讀結果。',
    footer: '本頁為規則化市場情境分析，不構成買賣建議。',
    ...(data.view ?? {}),
  };

  return applyTemplate(template, {
    meta_description: escapeHtml(view.meta_description),
    page_title: escapeHtml(view.page_title),
    forecast_date: escapeHtml(data.forecast_date),
    stock_name: escapeHtml(data.stock_name),
    stock_code: escapeHtml(data.stock_code),
    lead: escapeHtml(view.lead),
    hero_pills: renderPills(view.hero_pills),
    verdict_title: escapeHtml(view.verdict_title),
    verdict_summary: escapeHtml(view.verdict_summary),
    final_direction_label: escapeHtml(data.final_direction_label),
    risk_label: escapeHtml(view.risk_label),
    forecast_cards: renderCards(view.forecast_cards),
    fact_cards: renderCards(view.facts),
    score_rows: renderScores(view.scores),
    scenario_cards: renderScenarios(view.scenarios),
    level_rows: renderLevels(view.levels),
    data_note: escapeHtml(view.data_note),
    metadata_rows: renderMetadata(data),
    footer: escapeHtml(view.footer),
  });
}

module.exports = {
  escapeHtml,
  renderForecastHtml,
};
