'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CALENDAR = path.resolve(__dirname, '../../config/twse_non_trading_days.json');

function parseDate(dateStr) {
  const value = String(dateStr || '').trim();
  if (!/^20\d{6}$/.test(value)) throw new Error(`日期格式錯誤: ${value}`);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) throw new Error(`無效日期: ${value}`);
  return { value, year, date };
}

function readCalendar(calendarPath = DEFAULT_CALENDAR) {
  if (!fs.existsSync(calendarPath)) {
    return { years: {}, warning: `找不到 TWSE 休市日設定: ${calendarPath}` };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
    return { years: parsed?.years || {}, metadata: parsed };
  } catch (error) {
    return { years: {}, warning: `無法解析 TWSE 休市日設定: ${error.message}` };
  }
}

function getTradingDayStatus(dateStr, options = {}) {
  const { value, year, date } = parseDate(dateStr);
  const dayOfWeek = date.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      date: value,
      isTradingDay: false,
      reason: 'WEEKEND',
      calendarCovered: true,
    };
  }

  const calendar = readCalendar(options.calendarPath);
  const yearKey = String(year);
  const yearClosures = Array.isArray(calendar.years?.[yearKey]) ? calendar.years[yearKey] : null;

  if (yearClosures && yearClosures.includes(value)) {
    return {
      date: value,
      isTradingDay: false,
      reason: 'MARKET_HOLIDAY',
      calendarCovered: true,
    };
  }

  if (!yearClosures) {
    return {
      date: value,
      isTradingDay: true,
      reason: 'CALENDAR_YEAR_UNCOVERED',
      calendarCovered: false,
      warning: calendar.warning || `TWSE 休市日設定尚未覆蓋 ${year} 年；平日採 fail-open。`,
    };
  }

  return {
    date: value,
    isTradingDay: true,
    reason: 'TRADING_DAY',
    calendarCovered: true,
  };
}

module.exports = {
  DEFAULT_CALENDAR,
  getTradingDayStatus,
  parseDate,
  readCalendar,
};
