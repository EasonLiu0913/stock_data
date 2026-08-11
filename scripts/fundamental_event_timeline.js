#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVENT_TYPES = Object.freeze({
  MONTHLY_REVENUE: 'monthly_revenue',
  PRELIMINARY_EARNINGS: 'preliminary_earnings',
  FORMAL_FINANCIAL_REPORT: 'formal_financial_report',
  INVESTOR_CONFERENCE: 'investor_conference',
  MATERIAL_INFORMATION: 'material_information',
});

const TIMESTAMP_PRECISIONS = new Set(['second', 'minute', 'date', 'inferred', 'fallback']);
const MARKET_OPEN_MINUTES = 9 * 60;

function normalizeStockId(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/\d{4,6}/);
  return match ? match[0] : null;
}

function pad2(value) { return String(value).padStart(2, '0'); }

function parseRocDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const western = text.match(/^(20\d{2})[-\/]?(\d{1,2})[-\/]?(\d{1,2})$/);
  if (western) return `${western[1]}-${pad2(western[2])}-${pad2(western[3])}`;
  const normalized = text.replace(/[^0-9]/g, '');
  if (normalized.length < 7) return null;
  const yearDigits = normalized.length === 7 ? 3 : normalized.length >= 8 ? normalized.length - 4 : 3;
  const rocYear = Number(normalized.slice(0, yearDigits));
  const month = Number(normalized.slice(yearDigits, yearDigits + 2));
  const day = Number(normalized.slice(yearDigits + 2, yearDigits + 4));
  if (!Number.isInteger(rocYear) || rocYear < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${rocYear + 1911}-${pad2(month)}-${pad2(day)}`;
}

function parseTime(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const digits = text.replace(/[^0-9]/g, '');
  if (digits.length < 3) return null;
  const hh = Number(digits.length <= 4 ? digits.slice(0, -2) : digits.slice(0, -4));
  const mm = Number(digits.length <= 4 ? digits.slice(-2) : digits.slice(-4, -2));
  const ss = digits.length > 4 ? Number(digits.slice(-2)) : 0;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function taipeiIso(date, time = '00:00:00') {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(String(time || ''))) return null;
  return `${date}T${time}+08:00`;
}

function dateFromIso(value) {
  const match = String(value || '').match(/^(20\d{2}-\d{2}-\d{2})T/);
  return match ? match[1] : null;
}

function minutesFromIso(value) {
  const match = String(value || '').match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function discoverTradingDates(root) {
  const dates = new Set();
  const dirs = ['data_twse_mi_index', 'data_history_sma'];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (stack.length < 5000) stack.push(full);
          const m = entry.name.match(/^(20\d{6})$/);
          if (m) dates.add(`${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`);
        } else {
          const matches = entry.name.match(/20\d{6}/g) || [];
          for (const raw of matches) dates.add(`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`);
        }
      }
    }
  }
  return [...dates].sort();
}

function nextTradingDate(date, tradingDates) {
  const sorted = Array.isArray(tradingDates) ? tradingDates : [];
  const exactOrNext = sorted.find(item => item >= date);
  if (exactOrNext) return exactOrNext;
  const cursor = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 10; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + (i === 0 ? 0 : 1));
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) return cursor.toISOString().slice(0, 10);
  }
  return date;
}

function strictlyNextTradingDate(date, tradingDates) {
  const sorted = Array.isArray(tradingDates) ? tradingDates : [];
  const next = sorted.find(item => item > date);
  if (next) return next;
  const cursor = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 10; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) return cursor.toISOString().slice(0, 10);
  }
  return date;
}

function resolveEffectiveTradingDate({ publishedAt = null, publishedDate = null, timestampPrecision = 'date', tradingDates = [] }) {
  if (!TIMESTAMP_PRECISIONS.has(timestampPrecision)) throw new Error(`Unsupported timestamp precision: ${timestampPrecision}`);
  const date = dateFromIso(publishedAt) || publishedDate;
  if (!date) return null;
  const isKnownTradingDate = tradingDates.includes(date);
  if (publishedAt && ['second', 'minute'].includes(timestampPrecision)) {
    const minutes = minutesFromIso(publishedAt);
    if (isKnownTradingDate && Number.isFinite(minutes) && minutes < MARKET_OPEN_MINUTES) return date;
    return strictlyNextTradingDate(date, tradingDates);
  }
  // Date-only/inferred/fallback availability is deliberately conservative for daily backtests.
  return strictlyNextTradingDate(date, tradingDates);
}

function pick(row, candidates) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] !== '' && row[key] != null) return row[key];
  }
  return null;
}

function classifyMaterialInformation(title, description = '') {
  const text = `${title || ''}\n${description || ''}`;
  if (/法人說明會|法說會|法說|investor\s*conference|earnings\s*conference/i.test(text)) return EVENT_TYPES.INVESTOR_CONFERENCE;
  if (/自結|自結損益|初步財務|初步損益|營運成果|earnings\s*release|每股盈餘|EPS/i.test(text)) return EVENT_TYPES.PRELIMINARY_EARNINGS;
  if (/財務報告|財務報表/.test(text) && /董事會|通過|申報|公告/.test(text)) return EVENT_TYPES.PRELIMINARY_EARNINGS;
  return EVENT_TYPES.MATERIAL_INFORMATION;
}

function eventId(event) {
  const base = [event.stock_id, event.event_type, event.period || event.fiscal_period || event.published_date || 'unknown'];
  if (event.source?.sequence) base.push(event.source.sequence);
  if (event.published_at) base.push(event.published_at.replace(/[^0-9]/g, '').slice(0, 14));
  return base.filter(Boolean).join('-').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function finalizeEvent(event, tradingDates) {
  const normalized = {
    schema_version: 1,
    event_id: event.event_id || null,
    stock_id: normalizeStockId(event.stock_id),
    stock_name: event.stock_name || null,
    market: event.market || null,
    event_type: event.event_type,
    period: event.period || null,
    fiscal_period: event.fiscal_period || null,
    published_at: event.published_at || null,
    published_date: event.published_date || dateFromIso(event.published_at) || null,
    timestamp_precision: event.timestamp_precision || (event.published_at ? 'second' : 'date'),
    effective_trading_date: event.effective_trading_date || null,
    fallback_known_date: event.fallback_known_date || null,
    availability_confidence: event.availability_confidence || 'official',
    title: event.title || null,
    description: event.description || null,
    metrics: event.metrics || null,
    source: event.source || null,
    raw: event.raw || null,
  };
  if (!normalized.stock_id) throw new Error(`Missing stock_id for ${JSON.stringify(event).slice(0, 300)}`);
  if (!Object.values(EVENT_TYPES).includes(normalized.event_type)) throw new Error(`Unsupported event_type: ${normalized.event_type}`);
  if (!TIMESTAMP_PRECISIONS.has(normalized.timestamp_precision)) throw new Error(`Unsupported timestamp_precision: ${normalized.timestamp_precision}`);
  normalized.effective_trading_date = normalized.effective_trading_date || resolveEffectiveTradingDate({
    publishedAt: normalized.published_at,
    publishedDate: normalized.published_date || normalized.fallback_known_date,
    timestampPrecision: normalized.timestamp_precision,
    tradingDates,
  });
  normalized.event_id = normalized.event_id || eventId(normalized);
  return normalized;
}

module.exports = {
  EVENT_TYPES,
  TIMESTAMP_PRECISIONS,
  normalizeStockId,
  parseRocDate,
  parseTime,
  taipeiIso,
  discoverTradingDates,
  resolveEffectiveTradingDate,
  pick,
  classifyMaterialInformation,
  finalizeEvent,
};
