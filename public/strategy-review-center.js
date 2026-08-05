(() => {
'use strict';
const PATHS = Object.freeze({
latestRegistry: '../config/strategy-tag-registry.json',
snapshotManifest: '../data_prediction_analysis/strategy-snapshots/manifest.json',
tagStrategyReplay: date => `../data_prediction_analysis/tag-strategy/${date}.json`,
formalStrategyReplay: date => `../data_prediction_analysis/formal-strategy/${date}.json`,
observationReplay: date => `../data_prediction_analysis/observation-tag/${date}.json`,
});
const RESULT_RANK = Object.freeze({ hit: 0, miss: 1, pending: 2 });
const OPERATOR_LABELS = Object.freeze({
eq: '等於', ne: '不等於', gt: '大於', gte: '大於等於', lt: '小於', lte: '小於等於',
in: '屬於', not_in: '不屬於', includes: '包含', exists: '存在', truthy: '為真', falsy: '為假',
});
function compactDate(value) {
const compact = String(value || '').replace(/[^0-9]/g, '');
return /^20\d{6}$/.test(compact) ? compact : '';
}
function inputDate(value) {
const compact = compactDate(value);
return compact ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : '';
}
function displayDate(value) {
const compact = compactDate(value);
return compact ? `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}` : 'N/A';
}
function finiteNumber(value) {
if (value === null || value === undefined || value === '') return null;
const number = Number(value);
return Number.isFinite(number) ? number : null;
}
function firstFinite(...values) {
for (const value of values.flat()) {
const number = finiteNumber(value);
if (number !== null) return number;
}
return null;
}
function array(value) {
return Array.isArray(value) ? value : [];
}
function unique(values) {
return [...new Set(array(values).filter(value => value !== null && value !== undefined && value !== '').map(String))];
}
function esc(value) {
return String(value ?? '').replace(/[&<>"']/g, character => ({
'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
}
function normalizeRegistry(source = {}) {
const registry = source.registry || source.tag_strategy_registry || source;
return {
registryId: registry.registry_id || source.registry_id || '',
fingerprint: registry.registry_fingerprint || source.registry_fingerprint || '',
tags: array(source.tag_registry).length ? source.tag_registry : array(registry.tags),
strategies: array(source.strategy_registry_v2).length
? source.strategy_registry_v2
: array(source.strategy_registry).length
? source.strategy_registry
: array(registry.strategies),
};
}
function normalizeSnapshot(source = {}) {
const registry = normalizeRegistry(source);
return {
...registry,
evaluationMode: source.evaluation_mode || source.strategy_snapshot_metadata?.evaluation_mode || '',
dataAsOf: source.data_as_of || source.strategy_snapshot_metadata?.data_as_of || '',
generatedAt: source.generated_at || source.strategy_snapshot_metadata?.generated_at || '',
tagClassifications: source.tag_classifications || {},
strategyClassifications: source.strategy_classifications_v2 || source.strategy_classifications || {},
stocks: array(source.stocks),
};
}
function definitionKey(definition) {
return `${definition.kind || 'strategy'}:${definition.id}`;
}
function normalizeDefinition(definition = {}, kind = 'strategy', origin = 'snapshot') {
const isObservation = kind === 'observation';
const id = isObservation ? definition.tag_id : definition.strategy_id;
const familyId = definition.family_id || definition.strategy_family_id || id || '';
return {
...definition,
id: String(id || ''),
kind,
origin,
familyId,
version: definition.version ?? definition.strategy_version ?? 1,
label: definition.label || id || '未命名策略',
enabled: definition.enabled !== false,
fixedDisplay: definition.fixed_display !== false,
description: definition.description || '',
evaluationTarget: definition.evaluation_target || '',
usageRole: definition.usage_role || (isObservation ? 'observation_only' : 'strategy'),
};
}
function observationTags(tags = []) {
return array(tags).filter(tag => tag?.usage_role === 'observation_only'
|| tag?.evaluation_target === 'market_relative_underperformance_5d');
}
function collectEvaluationDefinitions(replaySources = {}) {
const definitions = [];
const tagReplay = replaySources.tagStrategy || {};
const formalReplay = replaySources.formalStrategy || {};
const observationReplay = replaySources.observation || {};
for (const evaluation of Object.values(tagReplay.evaluations || {})) {
definitions.push(normalizeDefinition({
strategy_id: evaluation.strategy_id,
family_id: evaluation.strategy_family_id,
version: evaluation.strategy_version,
label: evaluation.label,
description: evaluation.description,
evaluation_target: evaluation.evaluation_target,
}, 'strategy', 'evaluation'));
}
for (const evaluation of Object.values(formalReplay.formal_strategy_evaluations || {})) {
definitions.push(normalizeDefinition({
strategy_id: evaluation.strategy_id,
family_id: evaluation.strategy_family_id,
version: evaluation.strategy_version,
label: evaluation.label,
evaluation_target: evaluation.evaluation_target,
}, 'strategy', 'evaluation'));
}
for (const evaluation of Object.values(observationReplay.evaluations || {})) {
definitions.push(normalizeDefinition({
tag_id: evaluation.tag_id,
family_id: evaluation.family_id,
version: evaluation.version,
label: evaluation.label,
description: evaluation.description,
evaluation_target: evaluation.evaluation_target,
usage_role: 'observation_only',
display_hint: evaluation.display_hint,
}, 'observation', 'evaluation'));
}
return definitions.filter(item => item.id);
}
function buildDefinitions(latestRegistry = {}, snapshot = {}, replaySources = {}) {
const normalizedLatest = normalizeRegistry(latestRegistry);
const normalizedSnapshot = normalizeSnapshot(snapshot);
const sources = [
...array(normalizedLatest.strategies).map(item => normalizeDefinition(item, 'strategy', 'latest_registry')),
...observationTags(normalizedLatest.tags).map(item => normalizeDefinition(item, 'observation', 'latest_registry')),
...array(normalizedSnapshot.strategies).map(item => normalizeDefinition(item, 'strategy', 'snapshot')),
...observationTags(normalizedSnapshot.tags).map(item => normalizeDefinition(item, 'observation', 'snapshot')),
...collectEvaluationDefinitions(replaySources),
];
const map = new Map();
for (const item of sources) {
if (!item.id) continue;
const key = definitionKey(item);
const previous = map.get(key);
map.set(key, previous ? { ...item, ...previous, origin: previous.origin } : item);
}
return [...map.values()]
.filter(item => item.enabled !== false)
.sort((left, right) => left.kind.localeCompare(right.kind)
|| left.label.localeCompare(right.label, 'zh-Hant')
|| Number(right.version || 0) - Number(left.version || 0));
}
function labelMap(...tagSources) {
const map = new Map();
for (const tags of tagSources) {
for (const tag of array(tags)) {
if (tag?.tag_id) map.set(tag.tag_id, tag.label || tag.tag_id);
}
}
return map;
}
function formatRuleValue(value) {
if (Array.isArray(value)) return value.join('、');
if (typeof value === 'boolean') return value ? '是' : '否';
if (value === null || value === undefined || value === '') return '—';
return String(value);
}
function ruleToText(rule = {}) {
const paths = unique(rule.paths || (rule.path ? [rule.path] : []));
if (!paths.length) return '未提供可讀取的欄位規則';
const operator = OPERATOR_LABELS[rule.operator] || rule.operator || '符合';
return `${paths.join('／')} ${operator} ${formatRuleValue(rule.value)}`;
}
function expressionGroups(definition = {}, labels = new Map()) {
const expression = definition.expression || {};
const convert = ids => unique(ids).map(id => ({ id, label: labels.get(id) || id }));
const groups = [];
const all = convert(expression.all);
const any = convert(expression.any);
const not = convert(expression.not);
if (all.length) groups.push({ key: 'all', label: '全部符合', items: all });
if (any.length) groups.push({ key: 'any', label: '至少一項', items: any });
if (not.length) groups.push({ key: 'not', label: '排除', items: not });
if (!groups.length && definition.legacy_selector) {
groups.push({ key: 'legacy', label: '既有資格', items: [{
id: definition.legacy_selector.strategy_id || definition.id,
label: definition.legacy_selector.label || '沿用既有策略名單',
}] });
}
if (!groups.length && definition.rule) {
groups.push({ key: 'rule', label: '單一規則', items: [{ id: 'rule', label: ruleToText(definition.rule) }] });
}
return groups;
}
function definitionSummary(definition = {}, labels = new Map()) {
const groups = expressionGroups(definition, labels);
if (!groups.length) return '此版本尚未提供結構化篩選規則。';
return groups.map(group => `${group.label}：${group.items.map(item => item.label).join(group.key === 'any' ? ' 或 ' : '、')}`).join('；');
}
function snapshotOptions(dateEntry = {}) {
const options = [];
for (const item of array(dateEntry.historical_recalculations)) {
options.push({
...item,
mode: 'historical_recalculation',
label: `最新規則回算｜${item.registry_id || 'registry'}｜${String(item.registry_fingerprint || '').slice(0, 8)}`,
});
}
options.sort((left, right) => String(right.generated_at || '').localeCompare(String(left.generated_at || '')));
if (dateEntry.live_snapshot) {
options.push({ ...dateEntry.live_snapshot, mode: 'live_snapshot', label: '當時實際版本（不可變）' });
}
for (const item of array(dateEntry.live_snapshot_history)) {
options.push({
...item,
mode: 'live_snapshot_history',
label: `舊版實際快照｜${String(item.registry_fingerprint || '').slice(0, 8)}`,
});
}
return options;
}
function evaluationCandidates(replaySources = {}, definition = {}) {
const id = definition.id;
const tagEvaluation = replaySources.tagStrategy?.evaluations?.[id] || null;
const formalEvaluation = replaySources.formalStrategy?.formal_strategy_evaluations?.[id]
|| (replaySources.formalStrategy?.formal_strategy_evaluation?.strategy_id === id
? replaySources.formalStrategy.formal_strategy_evaluation : null);
const observationEvaluation = replaySources.observation?.evaluations?.[id] || null;
return definition.kind === 'observation'
? [observationEvaluation, tagEvaluation, formalEvaluation].filter(Boolean)
: [tagEvaluation, formalEvaluation, observationEvaluation].filter(Boolean);
}
function classificationFor(snapshot = {}, definition = {}) {
const normalized = normalizeSnapshot(snapshot);
return definition.kind === 'observation'
? normalized.tagClassifications?.[definition.id] || null
: normalized.strategyClassifications?.[definition.id] || null;
}
function normalizeEvaluation(definition = {}, snapshot = {}, replaySources = {}) {
const evaluation = evaluationCandidates(replaySources, definition)[0] || {};
const classification = classificationFor(snapshot, definition) || {};
const members = unique(evaluation.members || classification.members);
const candidates = finiteNumber(evaluation.candidates ?? classification.count);
const verified = finiteNumber(evaluation.verified_candidates ?? evaluation.verified);
const hits = finiteNumber(evaluation.hits);
const misses = finiteNumber(evaluation.misses) ?? (verified !== null && hits !== null ? verified - hits : null);
const hitRate = firstFinite(evaluation.hit_rate, evaluation.precision,
verified && hits !== null ? (hits / verified) * 100 : null);
const calculationStatus = evaluation.calculation_status
|| classification.calculation_status
|| (members.length ? 'pending' : 'unavailable');
return {
raw: evaluation,
classification,
members,
candidates: candidates ?? members.length,
verified,
hits,
misses,
hitRate,
averageReturn: firstFinite(evaluation.average_return, evaluation.average_return_5d_pct),
medianReturn: firstFinite(evaluation.median_return, evaluation.median_return_5d_pct),
averageExcess: firstFinite(evaluation.average_market_excess_return, evaluation.average_excess_return_5d_pct),
calculationStatus,
stocks: array(evaluation.stocks),
benchmark: replaySources.observation?.benchmark || null,
};
}
function stockCode(stock = {}) {
return String(stock.stock_code || stock.code || stock.stock_id || '').trim();
}
function stockName(stock = {}) {
return stock.stock_name || stock.name || stock.prediction?.stock_name || '';
}
function stockTags(stock = {}) {
return unique(stock.atomic_tags || stock.prediction_tags || stock.tags
|| stock.strategy_tag_snapshot?.tag_ids || stock.tag_ids);
}
function stockStrategies(stock = {}) {
return unique(stock.registered_strategy_matches || stock.prediction_strategies
|| stock.strategy_ids || stock.strategy_tag_snapshot?.strategy_ids);
}
function candidateRows(definition = {}, snapshot = {}, normalizedEvaluation = {}) {
const normalizedSnapshot = normalizeSnapshot(snapshot);
const snapshotMap = new Map(normalizedSnapshot.stocks.map(stock => [stockCode(stock), stock]));
const evaluationMap = new Map(array(normalizedEvaluation.stocks).map(stock => [stockCode(stock), stock]));
const codes = unique([
...normalizedEvaluation.members,
...evaluationMap.keys(),
...normalizedSnapshot.stocks.filter(stock => definition.kind === 'observation'
? stockTags(stock).includes(definition.id)
: stockStrategies(stock).includes(definition.id)).map(stockCode),
]);
return codes.map(code => {
const snapshotStock = snapshotMap.get(code) || {};
const evaluationStock = evaluationMap.get(code) || {};
const merged = { ...snapshotStock, ...evaluationStock };
const verified = evaluationStock.verified === true;
const hit = verified ? evaluationStock.hit === true : null;
const result = hit === true ? 'hit' : hit === false ? 'miss' : 'pending';
const tags = stockTags(snapshotStock);
const risks = unique(merged.risk_warnings || merged.warnings || merged.risks);
const closeReturn = firstFinite(merged.close_return, merged.actual?.close_return,
merged.actual_return, merged.return_1d_pct);
const return5d = firstFinite(merged.return_5d_pct, merged.max_return_5d,
merged.actual?.return_5d_pct, merged.outcome?.return_5d_pct);
const excess = firstFinite(merged.market_excess_return_5d_pct,
merged.market_excess_return, merged.average_market_excess_return);
const score = firstFinite(merged.candidate_score, merged.integrated_score, merged.final_score,
merged.score, merged.prediction?.score);
return {
stock_code: code,
stock_name: stockName(merged),
industry: merged.industry || merged.prediction?.industry || '',
candidate_score: score,
direction: merged.direction || merged.prediction?.direction || merged.predicted_direction || '',
close_return: closeReturn,
return_5d_pct: return5d,
market_excess_return: excess,
verified,
hit,
result,
result_rank: RESULT_RANK[result],
result_label: definition.kind === 'observation'
? hit === true ? '風險印證' : hit === false ? '風險未印證' : '待驗證'
: hit === true ? '命中' : hit === false ? '未命中' : '待驗證',
tags,
tags_text: tags.join(' '),
risks,
risk_text: risks.join('、'),
outcome_status: merged.outcome_status || '',
raw: merged,
};
});
}
function compareValues(left, right) {
const leftNull = left === null || left === undefined || left === '' || Number.isNaN(left);
const rightNull = right === null || right === undefined || right === '' || Number.isNaN(right);
if (leftNull && rightNull) return 0;
if (leftNull) return 1;
if (rightNull) return -1;
if (typeof left === 'number' && typeof right === 'number') return left - right;
return String(left).localeCompare(String(right), 'zh-Hant', { numeric: true, sensitivity: 'base' });
}
function sortRows(rows = [], key = 'stock_code', direction = 'asc') {
const multiplier = direction === 'desc' ? -1 : 1;
return [...rows].sort((left, right) => {
const leftValue = left[key];
const rightValue = right[key];
const leftMissing = leftValue === null || leftValue === undefined || leftValue === '' || Number.isNaN(leftValue);
const rightMissing = rightValue === null || rightValue === undefined || rightValue === '' || Number.isNaN(rightValue);
if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
return compareValues(leftValue, rightValue) * multiplier
|| compareValues(left.stock_code, right.stock_code);
});
}
function percent(value) {
const number = finiteNumber(value);
return number === null ? 'N/A' : `${number.toFixed(2)}%`;
}
function numberText(value) {
const number = finiteNumber(value);
return number === null ? 'N/A' : number.toLocaleString('zh-TW');
}
function statusLabel(status) {
return ({
completed: '已完成', partial: '部分可計算', pending: '待驗證',
pending_five_trading_days: '待五日資料', unable_to_calculate: '無法計算', unavailable: '尚無資料',
})[status] || status || '尚無資料';
}
const API = {
PATHS,
compactDate,
inputDate,
displayDate,
finiteNumber,
normalizeRegistry,
normalizeSnapshot,
normalizeDefinition,
observationTags,
buildDefinitions,
ruleToText,
expressionGroups,
definitionSummary,
snapshotOptions,
normalizeEvaluation,
candidateRows,
compareValues,
sortRows,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window === 'undefined' || typeof document === 'undefined') return;
const state = {
manifest: null,
latestRegistry: null,
currentDate: '',
snapshotOptions: [],
snapshot: null,
replaySources: {},
definitions: [],
selectedKey: '',
rows: [],
sortKey: 'result_rank',
sortDirection: 'asc',
};
const elements = {};
function element(id) {
return document.getElementById(id);
}
async function fetchJson(path, optional = false) {
try {
const response = await fetch(path, { cache: 'no-store' });
if (!response.ok) {
if (optional && response.status === 404) return null;
throw new Error(`${path}：HTTP ${response.status}`);
}
return response.json();
} catch (error) {
if (optional) return null;
throw error;
}
}
function availableDates() {
return Object.keys(state.manifest?.dates || {}).filter(compactDate).sort();
}
function nearestDate(requested) {
const dates = availableDates();
if (!dates.length) return '';
if (dates.includes(requested)) return requested;
const earlier = dates.filter(date => date <= requested).at(-1);
return earlier || dates[0];
}
function queryDate() {
return compactDate(new URLSearchParams(location.search).get('date'));
}
function setQuery(date, snapshotFile = '') {
const params = new URLSearchParams(location.search);
params.set('date', date);
if (snapshotFile) params.set('snapshot', snapshotFile);
else params.delete('snapshot');
history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
}
function setLoading() {
elements.strategyList.innerHTML = '';
const template = element('loadingTemplate');
for (let index = 0; index < 6; index += 1) {
elements.strategyList.append(template.content.cloneNode(true));
}
elements.dataNote.className = 'data-note';
elements.dataNote.textContent = '正在載入策略 registry、快照與覆盤資料。';
}
function snapshotSelectionFromQuery(options) {
const requested = new URLSearchParams(location.search).get('snapshot') || '';
return options.find(item => item.file === requested)?.file || options[0]?.file || '';
}
async function loadDate(date) {
const resolvedDate = nearestDate(compactDate(date));
if (!resolvedDate) throw new Error('找不到可用的策略快照日期。');
state.currentDate = resolvedDate;
elements.reviewDate.value = inputDate(resolvedDate);
setLoading();
const entry = state.manifest.dates[resolvedDate] || {};
state.snapshotOptions = snapshotOptions(entry);
elements.snapshotSelect.innerHTML = state.snapshotOptions.length
? state.snapshotOptions.map(item => `<option value="${esc(item.file)}">${esc(item.label)}</option>`).join('')
: '<option value="">此日期沒有策略快照</option>';
const selectedFile = snapshotSelectionFromQuery(state.snapshotOptions);
elements.snapshotSelect.value = selectedFile;
const [snapshot, tagStrategy, formalStrategy, observation] = await Promise.all([
selectedFile ? fetchJson(`../${selectedFile}`) : Promise.resolve({}),
fetchJson(PATHS.tagStrategyReplay(resolvedDate), true),
fetchJson(PATHS.formalStrategyReplay(resolvedDate), true),
fetchJson(PATHS.observationReplay(resolvedDate), true),
]);
state.snapshot = snapshot || {};
state.replaySources = { tagStrategy, formalStrategy, observation };
state.definitions = buildDefinitions(state.latestRegistry, state.snapshot, state.replaySources);
const validSelected = state.definitions.some(item => definitionKey(item) === state.selectedKey);
if (!validSelected) state.selectedKey = state.definitions[0] ? definitionKey(state.definitions[0]) : '';
setQuery(resolvedDate, selectedFile);
renderAll();
}
async function switchSnapshot(file) {
if (!file) return;
state.snapshot = await fetchJson(`../${file}`);
state.definitions = buildDefinitions(state.latestRegistry, state.snapshot, state.replaySources);
setQuery(state.currentDate, file);
renderAll();
}
function filteredDefinitions() {
const query = elements.strategySearch.value.trim().toLowerCase();
const type = elements.strategyType.value;
const normalizedSnapshot = normalizeSnapshot(state.snapshot);
const labels = labelMap(normalizeRegistry(state.latestRegistry).tags, normalizedSnapshot.tags);
return state.definitions.filter(definition => {
if (type === 'strategy' && definition.kind !== 'strategy') return false;
if (type === 'observation' && definition.kind !== 'observation') return false;
if (!query) return true;
return [definition.label, definition.id, definition.familyId, definition.description,
definitionSummary(definition, labels)].join(' ').toLowerCase().includes(query);
});
}
function renderSummary() {
const definitions = state.definitions;
const evaluations = definitions.map(definition => normalizeEvaluation(definition, state.snapshot, state.replaySources));
const totalCandidates = evaluations.reduce((sum, item) => sum + (item.candidates || 0), 0);
const totalVerified = evaluations.reduce((sum, item) => sum + (item.verified || 0), 0);
const totalHits = evaluations.reduce((sum, item) => sum + (item.hits || 0), 0);
const overallRate = totalVerified ? totalHits / totalVerified * 100 : null;
const data = [
['策略與觀察標籤', definitions.length, '由最新 registry 與歷史版本聯集'],
['當日候選總數', totalCandidates, '各策略候選相加，股票可能重複'],
['已驗證樣本', totalVerified, '已有對應結果的候選'],
['命中／風險印證', totalHits, '依各策略自己的 evaluation target'],
['加權準確度', overallRate === null ? 'N/A' : `${overallRate.toFixed(2)}%`, '以已驗證樣本加權'],
];
elements.summaryGrid.innerHTML = data.map(([label, value, note]) => `
<article class="summary-card"><span>${esc(label)}</span><b>${esc(numberText(value) === 'N/A' ? value : numberText(value))}</b><small>${esc(note)}</small></article>
`).join('');
}
function renderStrategyList() {
const definitions = filteredDefinitions();
elements.strategyCountBadge.textContent = definitions.length;
elements.strategyList.innerHTML = definitions.length ? definitions.map(definition => {
const evaluation = normalizeEvaluation(definition, state.snapshot, state.replaySources);
const key = definitionKey(definition);
return `<button type="button" class="strategy-item${key === state.selectedKey ? ' active' : ''}" data-definition-key="${esc(key)}">
<div class="strategy-item-head">
<div><h3>${esc(definition.label)}</h3><span class="strategy-item-id">${esc(definition.id)} · v${esc(definition.version)}</span></div>
<span class="type-chip${definition.kind === 'observation' ? ' observation' : ''}">${definition.kind === 'observation' ? '觀察' : '策略'}</span>
</div>
<div class="strategy-item-kpis">
<div><span>候選</span><b>${esc(numberText(evaluation.candidates))}</b></div>
<div><span>已驗證</span><b>${esc(numberText(evaluation.verified))}</b></div>
<div><span>準確度</span><b>${esc(percent(evaluation.hitRate))}</b></div>
</div>
</button>`;
}).join('') : '<div class="empty-card"><p>沒有符合搜尋條件的策略。</p></div>';
elements.strategyList.querySelectorAll('[data-definition-key]').forEach(button => button.addEventListener('click', () => {
state.selectedKey = button.dataset.definitionKey;
state.sortKey = 'result_rank';
state.sortDirection = 'asc';
renderStrategyList();
renderDetail();
}));
}
function selectedDefinition() {
return state.definitions.find(item => definitionKey(item) === state.selectedKey) || null;
}
function detailStatus(evaluation) {
if (evaluation.calculationStatus === 'pending' || evaluation.calculationStatus === 'pending_five_trading_days') {
return { className: 'pending', text: '待驗證' };
}
if (evaluation.verified === null || evaluation.verified === 0) {
return { className: 'pending', text: statusLabel(evaluation.calculationStatus) };
}
if ((evaluation.hitRate || 0) >= 60) return { className: 'hit', text: `準確度 ${percent(evaluation.hitRate)}` };
return { className: 'miss', text: `準確度 ${percent(evaluation.hitRate)}` };
}
function renderRules(definition) {
const normalizedLatest = normalizeRegistry(state.latestRegistry);
const normalizedSnapshot = normalizeSnapshot(state.snapshot);
const labels = labelMap(normalizedLatest.tags, normalizedSnapshot.tags);
const groups = expressionGroups(definition, labels);
elements.selectedRuleSummary.textContent = definitionSummary(definition, labels);
elements.selectedRuleGroups.innerHTML = groups.map(group => `<div class="rule-group">
<b>${esc(group.label)}</b><div class="rule-chips">${group.items.map(item => `<span class="rule-chip${group.key === 'not' ? ' not' : ''}" title="${esc(item.id)}">${esc(item.label)}</span>`).join('')}</div>
</div>`).join('');
elements.selectedHint.textContent = definition.display_hint || (definition.kind === 'observation'
? '此項只提供觀察，不影響策略資格或預測分數。' : '候選資格以所選快照為準；結果資料不會回頭改寫當時名單。');
}
function renderMetrics(evaluation, definition) {
const metrics = [
['候選數', numberText(evaluation.candidates), '指定日期快照名單'],
['已驗證', numberText(evaluation.verified), '已有完整結果'],
[definition.kind === 'observation' ? '風險印證' : '命中', numberText(evaluation.hits), '依策略驗證目標'],
['準確度', percent(evaluation.hitRate), evaluation.verified ? '命中 ÷ 已驗證' : '尚無足夠結果'],
['平均報酬', percent(evaluation.averageReturn), '一般策略可能為當日；觀察標籤為五日'],
['平均市場超額', percent(evaluation.averageExcess), '個股報酬減市場基準'],
];
elements.metricGrid.innerHTML = metrics.map(([label, value, note]) => `<article class="metric-card"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></article>`).join('');
}
function visibleRows() {
const query = elements.stockSearch.value.trim().toLowerCase();
const result = elements.resultFilter.value;
const filtered = state.rows.filter(row => {
if (result !== 'all' && row.result !== result) return false;
if (!query) return true;
return [row.stock_code, row.stock_name, row.industry, row.direction, row.tags_text, row.risk_text]
.join(' ').toLowerCase().includes(query);
});
return sortRows(filtered, state.sortKey, state.sortDirection);
}
function cellPercent(value) {
const number = finiteNumber(value);
if (number === null) return '—';
const sign = number > 0 ? '+' : '';
return `${sign}${number.toFixed(2)}%`;
}
function renderRows() {
const rows = visibleRows();
elements.tableMeta.textContent = `顯示 ${rows.length.toLocaleString('zh-TW')}／${state.rows.length.toLocaleString('zh-TW')} 檔；目前依「${state.sortKey}」${state.sortDirection === 'asc' ? '升冪' : '降冪'}排序。點擊欄位標題可切換排序。`;
elements.stockRows.innerHTML = rows.length ? rows.map(row => `
<tr>
<td><span class="result-pill ${esc(row.result)}">${esc(row.result_label)}</span></td>
<td><a class="stock-link" href="prediction-version-dashboard.html?version=v1&date=${esc(state.currentDate)}&code=${esc(row.stock_code)}">${esc(row.stock_code)}</a></td>
<td>${esc(row.stock_name || '—')}</td>
<td>${esc(row.industry || '—')}</td>
<td class="numeric">${row.candidate_score === null ? '—' : esc(row.candidate_score.toFixed(2))}</td>
<td>${esc(row.direction || '—')}</td>
<td class="numeric">${esc(cellPercent(row.close_return))}</td>
<td class="numeric">${esc(cellPercent(row.return_5d_pct))}</td>
<td class="numeric">${esc(cellPercent(row.market_excess_return))}</td>
<td><div class="inline-tags">${row.tags.length ? row.tags.map(tag => `<span class="inline-tag">${esc(tag)}</span>`).join('') : '—'}</div></td>
<td class="risk-text">${esc(row.risk_text || '—')}</td>
</tr>`).join('') : '<tr><td colspan="11" class="empty-row">此策略在指定日期沒有符合目前篩選條件的股票。</td></tr>';
document.querySelectorAll('thead [data-sort]').forEach(button => {
button.classList.toggle('active', button.dataset.sort === state.sortKey);
const active = button.dataset.sort === state.sortKey;
button.setAttribute('aria-sort', active ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
});
}
function renderDetail() {
const definition = selectedDefinition();
elements.emptyDetail.hidden = Boolean(definition);
elements.strategyDetail.hidden = !definition;
if (!definition) return;
const evaluation = normalizeEvaluation(definition, state.snapshot, state.replaySources);
state.rows = candidateRows(definition, state.snapshot, evaluation);
const status = detailStatus(evaluation);
elements.selectedMeta.textContent = `${definition.kind === 'observation' ? '觀察型標籤' : '固定策略'} · ${definition.id} · v${definition.version} · ${definition.origin}`;
elements.selectedTitle.textContent = definition.label;
elements.selectedDescription.textContent = definition.description || `驗證目標：${definition.evaluationTarget || '尚未定義'}`;
elements.selectedStatus.className = `status-pill ${status.className}`;
elements.selectedStatus.textContent = status.text;
renderRules(definition);
renderMetrics(evaluation, definition);
renderRows();
}
function renderCatalog() {
const normalizedLatest = normalizeRegistry(state.latestRegistry);
const normalizedSnapshot = normalizeSnapshot(state.snapshot);
const tagMap = new Map();
for (const tag of [...normalizedLatest.tags, ...normalizedSnapshot.tags]) {
if (!tag?.tag_id) continue;
const previous = tagMap.get(tag.tag_id);
tagMap.set(tag.tag_id, previous ? { ...tag, ...previous } : tag);
}
const query = elements.tagSearch.value.trim().toLowerCase();
const tags = [...tagMap.values()].filter(tag => {
if (!query) return true;
return [tag.label, tag.tag_id, tag.category, ruleToText(tag.rule), definitionSummary(tag,
labelMap([...tagMap.values()]))].join(' ').toLowerCase().includes(query);
}).sort((left, right) => String(left.category || '').localeCompare(String(right.category || ''))
|| String(left.label || '').localeCompare(String(right.label || ''), 'zh-Hant'));
const labels = labelMap(tags);
elements.tagCatalog.innerHTML = tags.length ? tags.map(tag => `<article class="tag-card">
<div class="tag-card-head"><div><h3>${esc(tag.label || tag.tag_id)}</h3><code>${esc(tag.tag_id)}</code></div><span class="category-chip">${esc(tag.category || tag.usage_role || 'other')}</span></div>
<p>${esc(tag.expression ? definitionSummary(tag, labels) : ruleToText(tag.rule))}</p>
</article>`).join('') : '<div class="empty-card"><p>沒有符合搜尋條件的原子標籤。</p></div>';
}
function updateDateButtons() {
const dates = availableDates();
const index = dates.indexOf(state.currentDate);
elements.previousDate.disabled = index <= 0;
elements.nextDate.disabled = index < 0 || index >= dates.length - 1;
}
function renderAll() {
const normalizedSnapshot = normalizeSnapshot(state.snapshot);
const normalizedRegistry = normalizeRegistry(state.latestRegistry);
elements.registryBadge.textContent = `Registry ${normalizedRegistry.registryId || 'N/A'} · ${state.definitions.length} 項`;
elements.dataNote.className = 'data-note';
elements.dataNote.textContent = `${displayDate(state.currentDate)}｜${normalizedSnapshot.evaluationMode === 'live_snapshot' ? '當時實際版本' : '新版歷史重算'}｜資料截點 ${displayDate(normalizedSnapshot.dataAsOf)}｜策略指紋 ${normalizedSnapshot.fingerprint || 'N/A'}。一般策略、觀察型標籤與未回算的新策略會用不同狀態呈現。`;
renderSummary();
renderStrategyList();
renderDetail();
renderCatalog();
updateDateButtons();
}
function bindEvents() {
elements.reviewDate.addEventListener('change', () => loadDate(compactDate(elements.reviewDate.value)).catch(showError));
elements.snapshotSelect.addEventListener('change', () => switchSnapshot(elements.snapshotSelect.value).catch(showError));
elements.strategySearch.addEventListener('input', renderStrategyList);
elements.strategyType.addEventListener('change', renderStrategyList);
elements.stockSearch.addEventListener('input', renderRows);
elements.resultFilter.addEventListener('change', renderRows);
elements.tagSearch.addEventListener('input', renderCatalog);
elements.previousDate.addEventListener('click', () => {
const dates = availableDates();
const index = dates.indexOf(state.currentDate);
if (index > 0) loadDate(dates[index - 1]).catch(showError);
});
elements.nextDate.addEventListener('click', () => {
const dates = availableDates();
const index = dates.indexOf(state.currentDate);
if (index >= 0 && index < dates.length - 1) loadDate(dates[index + 1]).catch(showError);
});
document.querySelectorAll('thead [data-sort]').forEach(button => button.addEventListener('click', () => {
const key = button.dataset.sort;
if (state.sortKey === key) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
else {
state.sortKey = key;
state.sortDirection = ['candidate_score', 'close_return', 'return_5d_pct', 'market_excess_return'].includes(key) ? 'desc' : 'asc';
}
renderRows();
}));
}
function showError(error) {
console.error(error);
elements.dataNote.className = 'data-note error';
elements.dataNote.textContent = `資料載入失敗：${error?.message || error}`;
}
async function init() {
for (const id of ['registryBadge', 'reviewDate', 'snapshotSelect', 'strategySearch', 'strategyType',
'dataNote', 'summaryGrid', 'strategyCountBadge', 'strategyList', 'emptyDetail', 'strategyDetail',
'selectedMeta', 'selectedTitle', 'selectedDescription', 'selectedStatus', 'selectedRuleSummary',
'selectedRuleGroups', 'selectedHint', 'metricGrid', 'stockSearch', 'resultFilter', 'tableMeta',
'stockRows', 'tagSearch', 'tagCatalog', 'previousDate', 'nextDate']) elements[id] = element(id);
bindEvents();
setLoading();
try {
const [manifest, registry] = await Promise.all([
fetchJson(PATHS.snapshotManifest),
fetchJson(PATHS.latestRegistry),
]);
state.manifest = manifest;
state.latestRegistry = registry;
const dates = availableDates();
const requested = queryDate();
await loadDate(requested || dates.at(-1));
} catch (error) {
showError(error);
}
}
init();
})();
