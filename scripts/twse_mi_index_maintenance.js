'use strict';

const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const MAINTENANCE_START_SECONDS = (13 * 60 + 30) * 60;
// TWSE says the ALL-data query is paused from 13:30 through 13:45.
// Resume at 13:46 and keep a small buffer so a request is not sent on the boundary.
const MAINTENANCE_RESUME_SECONDS = (13 * 60 + 46) * 60;
const DEFAULT_SAFETY_BUFFER_MS = 5000;

function getTaipeiClockParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TAIPEI_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(date).map(part => [part.type, part.value])
    );
    return {
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second)
    };
}

function getTwseMiIndexMaintenanceWaitMs(date = new Date(), safetyBufferMs = DEFAULT_SAFETY_BUFFER_MS) {
    const { hour, minute, second } = getTaipeiClockParts(date);
    const secondsSinceMidnight = hour * 3600 + minute * 60 + second;

    if (
        secondsSinceMidnight < MAINTENANCE_START_SECONDS
        || secondsSinceMidnight >= MAINTENANCE_RESUME_SECONDS
    ) {
        return 0;
    }

    return (MAINTENANCE_RESUME_SECONDS - secondsSinceMidnight) * 1000 + safetyBufferMs;
}

function isTwseMiIndexMaintenanceMessage(message) {
    const normalized = String(message || '').replace(/\s+/g, '');
    if (!normalized.includes('查詢全部資料功能暫停使用')) return false;

    return normalized.includes('1:30PM到1:45PM')
        || normalized.includes('13:30到13:45')
        || normalized.includes('13:30至13:45');
}

module.exports = {
    DEFAULT_SAFETY_BUFFER_MS,
    MAINTENANCE_RESUME_SECONDS,
    MAINTENANCE_START_SECONDS,
    getTaipeiClockParts,
    getTwseMiIndexMaintenanceWaitMs,
    isTwseMiIndexMaintenanceMessage
};
