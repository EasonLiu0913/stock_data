'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    getTaipeiClockParts,
    getTwseMiIndexMaintenanceWaitMs,
    isTwseMiIndexMaintenanceMessage
} = require('../scripts/twse_mi_index_maintenance');

function taipeiTime(isoUtc) {
    return new Date(isoUtc);
}

test('recognizes the TWSE MI_INDEX ALL-query maintenance message', () => {
    assert.equal(
        isTwseMiIndexMaintenanceMessage(
            '每日1:30PM到1:45PM為網站尖峰時間，查詢全部資料功能暫停使用!'
        ),
        true
    );
    assert.equal(isTwseMiIndexMaintenanceMessage('很抱歉，沒有符合條件的資料!'), false);
});

test('Taipei clock conversion is independent of runner timezone', () => {
    assert.deepEqual(
        getTaipeiClockParts(taipeiTime('2026-08-04T05:41:20.000Z')),
        { hour: 13, minute: 41, second: 20 }
    );
});

test('waits from 13:30 through 13:45 and resumes after 13:46 with buffer', () => {
    assert.equal(
        getTwseMiIndexMaintenanceWaitMs(taipeiTime('2026-08-04T05:29:59.000Z')),
        0
    );
    assert.equal(
        getTwseMiIndexMaintenanceWaitMs(taipeiTime('2026-08-04T05:30:00.000Z')),
        965000
    );
    assert.equal(
        getTwseMiIndexMaintenanceWaitMs(taipeiTime('2026-08-04T05:45:59.000Z')),
        6000
    );
    assert.equal(
        getTwseMiIndexMaintenanceWaitMs(taipeiTime('2026-08-04T05:46:00.000Z')),
        0
    );
});
