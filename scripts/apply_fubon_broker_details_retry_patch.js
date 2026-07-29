#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'scripts', 'crawl_fubon_broker_details.js');
const testPath = path.join(root, 'tests', 'crawl_fubon_broker_details_retry.test.js');

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

let content = fs.readFileSync(scriptPath, 'utf8');

content = replaceOnce(content,
`async function crawlWithRetry(page, stock, isoDate, options) {
    let lastError;
    for (let attempt = 1; attempt <= options.retries; attempt += 1) {
        try {
            return await extractBrokerDetails(page, stock, isoDate);
        } catch (error) {
            lastError = error;
            if (attempt < options.retries) {
                const base = Math.min(options.backoffBaseMs * (3 ** (attempt - 1)), 300000);
                const delay = randomInteger(
                    Math.floor(base * 0.8),
                    Math.ceil(base * 1.2)
                );
                console.warn(
                    \`[\${isoDate}] \${stock.code} 第 \${attempt}/\${options.retries} 次失敗（\${error.message}），退避 \${formatDelay(delay)}\`
                );
                await wait(delay);
            }
        } finally {
            await wait(randomInteger(options.minDelayMs, options.maxDelayMs));
        }
    }
    throw lastError;
}`,
`async function crawlWithRetry(page, stock, isoDate, options) {
    let lastError;
    let lastPendingResult = null;
    for (let attempt = 1; attempt <= options.retries; attempt += 1) {
        try {
            const result = await extractBrokerDetails(page, stock, isoDate);
            if (result.status === 'unavailable') {
                lastPendingResult = result;
                const error = new Error(result.reason || '該日期分點資料尚未可用');
                error.code = 'PENDING_UNAVAILABLE';
                throw error;
            }
            return result;
        } catch (error) {
            lastError = error;
            if (attempt < options.retries) {
                const base = Math.min(options.backoffBaseMs * (3 ** (attempt - 1)), 300000);
                const delay = randomInteger(
                    Math.floor(base * 0.8),
                    Math.ceil(base * 1.2)
                );
                console.warn(
                    \`[\${isoDate}] \${stock.code} 第 \${attempt}/\${options.retries} 次未完成（\${error.message}），退避 \${formatDelay(delay)}\`
                );
                await wait(delay);
            }
        } finally {
            await wait(randomInteger(options.minDelayMs, options.maxDelayMs));
        }
    }
    if (lastPendingResult) {
        return {
            ...lastPendingResult,
            status: 'pending',
            attemptsThisRun: options.retries
        };
    }
    throw lastError;
}`,
'crawlWithRetry');

content = replaceOnce(content,
`                    results[index] = {
                        status: 'failed',
                        code: stock.code,
                        name: stock.name,
                        category: stock.category,
                        error: error.message
                    };`,
`                    results[index] = {
                        status: 'failed',
                        code: stock.code,
                        name: stock.name,
                        category: stock.category,
                        error: error.message,
                        attemptsThisRun: options.retries
                    };`,
'failed result attempts');

content = replaceOnce(content,
`        unavailableStockCount: 0,
        failedStockCount: 0,
        stocks: {},
        unavailableStocks: [],
        failedStocks: []`,
`        unavailableStockCount: 0,
        failedStockCount: 0,
        pendingStockCount: 0,
        stocks: {},
        unavailableStocks: [],
        failedStocks: [],
        pendingStocks: []`,
'empty payload pending fields');

content = replaceOnce(content,
`function completedCodes(payload) {
    return new Set([
        ...Object.keys(payload.stocks || {}),
        ...(payload.unavailableStocks || []).map(stock => stock.code)
    ]);
}

function mergeResults(payload, results, universe) {
    const unavailableByCode = new Map(
        (payload.unavailableStocks || []).map(stock => [stock.code, stock])
    );
    const failedByCode = new Map(
        (payload.failedStocks || []).map(stock => [stock.code, stock])
    );

    for (const result of results) {
        failedByCode.delete(result.code);
        if (result.status === 'success') {
            payload.stocks[result.code] = result.data;
            unavailableByCode.delete(result.code);
        } else if (result.status === 'unavailable') {
            unavailableByCode.set(result.code, result);
            delete payload.stocks[result.code];
        } else {
            failedByCode.set(result.code, {
                code: result.code,
                name: result.name,
                category: result.category,
                error: result.error
            });
        }
    }

    payload.unavailableStocks = [...unavailableByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.failedStocks = [...failedByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.successfulStockCount = Object.keys(payload.stocks).length;
    payload.unavailableStockCount = payload.unavailableStocks.length;
    payload.failedStockCount = payload.failedStocks.length;
    const accountedFor =
        payload.successfulStockCount +
        payload.unavailableStockCount;
    payload.complete =
        accountedFor === universe.stocks.length &&
        payload.failedStockCount === 0;
    payload.generatedAt = new Date().toISOString();
    return payload;
}`,
`function normalizePayloadRetryState(payload) {
    if (!payload) return payload;
    const pendingByCode = new Map();
    const add = (stock, kind) => {
        if (!stock?.code) return;
        const previous = pendingByCode.get(stock.code) || {};
        pendingByCode.set(stock.code, {
            ...previous,
            ...stock,
            status: 'pending',
            kind: stock.kind || kind,
            attempts: Number(stock.attempts || previous.attempts || 0),
            firstSeenAt: stock.firstSeenAt || previous.firstSeenAt || payload.generatedAt || null,
            lastAttemptAt: stock.lastAttemptAt || previous.lastAttemptAt || payload.generatedAt || null
        });
    };
    (payload.pendingStocks || []).forEach(stock => add(stock, stock.kind || 'unknown'));
    (payload.unavailableStocks || []).forEach(stock => add(stock, 'unavailable'));
    (payload.failedStocks || []).forEach(stock => add(stock, 'failed'));
    payload.pendingStocks = [...pendingByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.unavailableStocks = payload.pendingStocks.filter(stock => stock.kind === 'unavailable');
    payload.failedStocks = payload.pendingStocks.filter(stock => stock.kind === 'failed');
    payload.pendingStockCount = payload.pendingStocks.length;
    payload.unavailableStockCount = payload.unavailableStocks.length;
    payload.failedStockCount = payload.failedStocks.length;
    return payload;
}

function completedCodes(payload) {
    normalizePayloadRetryState(payload);
    return new Set(Object.keys(payload.stocks || {}));
}

function mergeResults(payload, results, universe) {
    normalizePayloadRetryState(payload);
    const pendingByCode = new Map(
        (payload.pendingStocks || []).map(stock => [stock.code, stock])
    );

    for (const result of results) {
        const previous = pendingByCode.get(result.code);
        if (result.status === 'success') {
            payload.stocks[result.code] = result.data;
            pendingByCode.delete(result.code);
            continue;
        }

        delete payload.stocks[result.code];
        const now = new Date().toISOString();
        const unavailable = result.status === 'pending' || result.status === 'unavailable';
        pendingByCode.set(result.code, {
            ...previous,
            ...result,
            status: 'pending',
            kind: unavailable ? 'unavailable' : 'failed',
            attempts: Number(previous?.attempts || 0) + Number(result.attemptsThisRun || 1),
            firstSeenAt: previous?.firstSeenAt || now,
            lastAttemptAt: now
        });
    }

    payload.pendingStocks = [...pendingByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.unavailableStocks = payload.pendingStocks.filter(stock => stock.kind === 'unavailable');
    payload.failedStocks = payload.pendingStocks.filter(stock => stock.kind === 'failed');
    payload.successfulStockCount = Object.keys(payload.stocks).length;
    payload.pendingStockCount = payload.pendingStocks.length;
    payload.unavailableStockCount = payload.unavailableStocks.length;
    payload.failedStockCount = payload.failedStocks.length;
    payload.complete =
        payload.successfulStockCount === universe.stocks.length &&
        payload.pendingStockCount === 0;
    payload.generatedAt = new Date().toISOString();
    return payload;
}`,
'retry state and merge');

content = replaceOnce(content,
`function validatePayload(payload, isoDate, universe) {
    const errors = [];
    if (!payload) return ['JSON 不存在或無法解析'];`,
`function validatePayload(payload, isoDate, universe) {
    const errors = [];
    if (!payload) return ['JSON 不存在或無法解析'];
    normalizePayloadRetryState(payload);`,
'validate normalization');

content = replaceOnce(content,
`    if (payload.failedStockCount !== 0 || payload.failedStocks?.length !== 0) {
        errors.push(\`仍有 \${payload.failedStockCount ?? payload.failedStocks?.length} 檔失敗\`);
    }`,
`    if (payload.pendingStockCount !== 0 || payload.pendingStocks?.length !== 0) {
        errors.push(\`仍有 \${payload.pendingStockCount ?? payload.pendingStocks?.length} 檔待重試\`);
    }`,
'validate pending count');

content = replaceOnce(content,
`    for (const stock of payload.unavailableStocks || []) {
        if (!expectedCodes.has(stock.code)) errors.push(\`無資料清單含未知代碼：\${stock.code}\`);
        if (accountedCodes.has(stock.code)) errors.push(\`重複代碼：\${stock.code}\`);
        accountedCodes.add(stock.code);
    }
    if (accountedCodes.size !== universe.stocks.length) {
        errors.push(\`已交代股票數錯誤：\${accountedCodes.size}/\${universe.stocks.length}\`);
    }`,
`    for (const stock of payload.pendingStocks || []) {
        if (!expectedCodes.has(stock.code)) errors.push(\`待重試清單含未知代碼：\${stock.code}\`);
        if (accountedCodes.has(stock.code)) errors.push(\`重複代碼：\${stock.code}\`);
        accountedCodes.add(stock.code);
    }
    if (accountedCodes.size !== universe.stocks.length) {
        errors.push(\`已交代股票數錯誤：\${accountedCodes.size}/\${universe.stocks.length}\`);
    }`,
'validate pending codes');

content = replaceOnce(content,
`    let payload = existingPayloadCanResume(existing, isoDate, universe)
        ? existing
        : createEmptyPayload(isoDate, universe);`,
`    let payload = existingPayloadCanResume(existing, isoDate, universe)
        ? existing
        : createEmptyPayload(isoDate, universe);
    normalizePayloadRetryState(payload);`,
'crawlDate migration');

content = replaceOnce(content,
`            \`💾 進度：成功 \${payload.successfulStockCount}、該日無資料 \${payload.unavailableStockCount}、失敗 \${payload.failedStockCount}\`
`,
`            \`💾 進度：成功 \${payload.successfulStockCount}、待重試 \${payload.pendingStockCount}（無資料 \${payload.unavailableStockCount}、失敗 \${payload.failedStockCount}）\`
`,
'progress log');

content = replaceOnce(content,
`    console.log(
        \`✅ \${isoDate} 完成：\${payload.successfulStockCount} 檔有資料、\${payload.unavailableStockCount} 檔該日無資料\`
    );`,
`    console.log(
        \`✅ \${isoDate} 完成：\${payload.successfulStockCount} 檔皆取得有效分點資料\`
    );`,
'complete log');

content = replaceOnce(content,
`main().catch(error => {
    console.error(\`❌ \${error.stack || error.message}\`);
    process.exitCode = 1;
});`,
`if (require.main === module) {
    main().catch(error => {
        console.error(\`❌ \${error.stack || error.message}\`);
        process.exitCode = 1;
    });
}

module.exports = {
    completedCodes,
    createEmptyPayload,
    mergeResults,
    normalizePayloadRetryState,
    validatePayload
};`,
'module exports');

fs.writeFileSync(scriptPath, content, 'utf8');

const test = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  completedCodes,
  createEmptyPayload,
  mergeResults,
  normalizePayloadRetryState,
  validatePayload
} = require('../scripts/crawl_fubon_broker_details');

const universe = {
  sourceFiles: [],
  universeHash: 'test-hash',
  stocks: [
    { code: '2330', name: '台積電', category: 'Stock' },
    { code: '2317', name: '鴻海', category: 'Stock' }
  ]
};

test('legacy unavailable and failed stocks migrate into pending queue', () => {
  const payload = createEmptyPayload('2026-07-29', universe);
  payload.unavailableStocks = [{ code: '2330', reason: '該日期無分點資料' }];
  payload.failedStocks = [{ code: '2317', error: 'timeout' }];
  normalizePayloadRetryState(payload);
  assert.equal(payload.pendingStockCount, 2);
  assert.deepEqual(completedCodes(payload), new Set());
  assert.equal(payload.complete, false);
});

test('pending stock remains incomplete and accumulates attempts', () => {
  const payload = createEmptyPayload('2026-07-29', universe);
  mergeResults(payload, [{
    status: 'pending',
    code: '2330',
    name: '台積電',
    category: 'Stock',
    reason: '該日期無分點資料',
    attemptsThisRun: 3
  }], universe);
  assert.equal(payload.pendingStockCount, 1);
  assert.equal(payload.pendingStocks[0].attempts, 3);
  assert.equal(payload.complete, false);
  assert.match(validatePayload(payload, '2026-07-29', universe).join('\n'), /待重試/);
});

test('success removes stock from pending queue and only all-success is complete', () => {
  const payload = createEmptyPayload('2026-07-29', universe);
  payload.pendingStocks = [{ code: '2330', kind: 'unavailable', attempts: 3 }];
  mergeResults(payload, [{
    status: 'success',
    code: '2330',
    data: { stockCode: '2330', date: '2026-07-29', buyBrokers: [{}], sellBrokers: [{}], totals: { netBuy: 1, netSell: 1, net: 0 } }
  }], universe);
  assert.equal(payload.pendingStockCount, 0);
  assert.equal(payload.complete, false);

  mergeResults(payload, [{
    status: 'success',
    code: '2317',
    data: { stockCode: '2317', date: '2026-07-29', buyBrokers: [{}], sellBrokers: [{}], totals: { netBuy: 1, netSell: 1, net: 0 } }
  }], universe);
  assert.equal(payload.pendingStockCount, 0);
  assert.equal(payload.complete, true);
});
`;
fs.writeFileSync(testPath, test, 'utf8');
