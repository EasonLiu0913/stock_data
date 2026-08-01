'use strict';

const DEFAULT_THRESHOLDS = Object.freeze({
  return_3d_lte: -8,
  return_5d_lte: -10,
  return_10d_lte: -15,
  drawdown_20d_lte: -15,
  drawdown_60d_lte: -20,
  rsi14_lte: 25,
});

const OUTCOME_HORIZONS = Object.freeze([1, 3, 5, 10]);

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replaceAll(',', '').replace('%', '').trim();
  if (!normalized || normalized === '--' || normalized === '-') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function pctChange(current, previous) {
  const a = finiteNumber(current);
  const b = finiteNumber(previous);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return round((a / b - 1) * 100);
}

function average(values) {
  const numbers = values.map(finiteNumber).filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function median(values) {
  const numbers = values.map(finiteNumber).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

function standardDeviation(values) {
  const numbers = values.map(finiteNumber).filter(Number.isFinite);
  if (numbers.length < 2) return null;
  const mean = average(numbers);
  return Math.sqrt(numbers.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / numbers.length);
}

function rollingSlice(series, index, periods, includeCurrent = true) {
  const end = includeCurrent ? index + 1 : index;
  const start = Math.max(0, end - periods);
  return series.slice(start, end);
}

function returnAt(series, index, periods) {
  if (index - periods < 0) return null;
  return pctChange(series[index].close, series[index - periods].close);
}

function simpleMovingAverage(series, index, periods) {
  if (index - periods + 1 < 0) return null;
  return round(average(rollingSlice(series, index, periods).map(row => row.close)));
}

function computeRsi(series, index, periods = 14) {
  if (index - periods < 0) return null;
  let gains = 0;
  let losses = 0;
  for (let cursor = index - periods + 1; cursor <= index; cursor += 1) {
    const previous = series[cursor - 1]?.close;
    const current = series[cursor]?.close;
    if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
    const change = current - previous;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const relativeStrength = (gains / periods) / (losses / periods);
  return round(100 - (100 / (1 + relativeStrength)), 2);
}

function drawdownFromRollingHigh(series, index, periods) {
  const rows = rollingSlice(series, index, periods);
  if (!rows.length) return null;
  const rollingHigh = Math.max(...rows.map(row => finiteNumber(row.high) ?? finiteNumber(row.close)).filter(Number.isFinite));
  if (!Number.isFinite(rollingHigh) || rollingHigh === 0) return null;
  return round((series[index].close / rollingHigh - 1) * 100);
}

function consecutiveDownDays(series, index) {
  let count = 0;
  for (let cursor = index; cursor > 0; cursor -= 1) {
    if (!(series[cursor].close < series[cursor - 1].close)) break;
    count += 1;
  }
  return count;
}

function realizedVolatility(series, index, periods = 20) {
  const returns = [];
  const start = Math.max(1, index - periods + 1);
  for (let cursor = start; cursor <= index; cursor += 1) {
    const value = pctChange(series[cursor].close, series[cursor - 1].close);
    if (Number.isFinite(value)) returns.push(value);
  }
  return round(standardDeviation(returns), 4);
}

function buildOversoldObservation(series, index, thresholds = DEFAULT_THRESHOLDS) {
  const row = series[index];
  const return1d = returnAt(series, index, 1);
  const return3d = returnAt(series, index, 3);
  const return5d = returnAt(series, index, 5);
  const return10d = returnAt(series, index, 10);
  const return20d = returnAt(series, index, 20);
  const drawdown20d = drawdownFromRollingHigh(series, index, 20);
  const drawdown60d = drawdownFromRollingHigh(series, index, 60);
  const rsi14 = computeRsi(series, index, 14);
  const sma5 = finiteNumber(row.sma5) ?? simpleMovingAverage(series, index, 5);
  const sma20 = finiteNumber(row.sma20) ?? simpleMovingAverage(series, index, 20);
  const sma60 = finiteNumber(row.sma60) ?? simpleMovingAverage(series, index, 60);
  const averageVolume5 = average(rollingSlice(series, index, 5).map(item => item.volume));
  const averageVolume20 = average(rollingSlice(series, index, 20).map(item => item.volume));

  const triggerValues = {
    return_3d_lte: return3d,
    return_5d_lte: return5d,
    return_10d_lte: return10d,
    drawdown_20d_lte: drawdown20d,
    drawdown_60d_lte: drawdown60d,
    rsi14_lte: rsi14,
  };
  const triggers = Object.entries(triggerValues)
    .filter(([key, value]) => Number.isFinite(value) && value <= thresholds[key])
    .map(([id, value]) => ({ id, value: round(value), threshold: thresholds[id] }));

  return {
    series_index: index,
    date: row.date,
    close: row.close,
    triggers,
    is_oversold: triggers.length > 0,
    price_volume: {
      open: round(row.open),
      high: round(row.high),
      low: round(row.low),
      close: round(row.close),
      volume_lots: round(row.volume),
      return_1d: return1d,
      return_3d: return3d,
      return_5d: return5d,
      return_10d: return10d,
      return_20d: return20d,
      drawdown_20d: drawdown20d,
      drawdown_60d: drawdown60d,
      rsi14,
      sma5,
      sma20,
      sma60,
      gap_sma5: Number.isFinite(sma5) ? pctChange(row.close, sma5) : null,
      gap_sma20: Number.isFinite(sma20) ? pctChange(row.close, sma20) : null,
      gap_sma60: Number.isFinite(sma60) ? pctChange(row.close, sma60) : null,
      average_volume_5d_lots: round(averageVolume5),
      average_volume_20d_lots: round(averageVolume20),
      volume_ratio_5d: Number.isFinite(averageVolume5) && averageVolume5 !== 0 ? round(row.volume / averageVolume5) : null,
      volume_ratio_20d: Number.isFinite(averageVolume20) && averageVolume20 !== 0 ? round(row.volume / averageVolume20) : null,
      intraday_return: pctChange(row.close, row.open),
      intraday_range_pct: Number.isFinite(row.high) && Number.isFinite(row.low) && row.close !== 0
        ? round(((row.high - row.low) / row.close) * 100)
        : null,
      consecutive_down_days: consecutiveDownDays(series, index),
      volatility_20d: realizedVolatility(series, index, 20),
    },
  };
}

function buildOutcome(series, baseIndex) {
  const base = series[baseIndex];
  if (!base || !Number.isFinite(base.close)) return null;
  const result = {
    base_date: base.date,
    base_close: round(base.close),
  };

  for (const horizon of OUTCOME_HORIZONS) {
    const target = series[baseIndex + horizon];
    result[`future_return_${horizon}d`] = target ? pctChange(target.close, base.close) : null;
    const futureRows = series.slice(baseIndex + 1, Math.min(series.length, baseIndex + horizon + 1));
    const highs = futureRows.map(row => finiteNumber(row.high) ?? finiteNumber(row.close)).filter(Number.isFinite);
    const lows = futureRows.map(row => finiteNumber(row.low) ?? finiteNumber(row.close)).filter(Number.isFinite);
    result[`max_return_${horizon}d`] = highs.length ? pctChange(Math.max(...highs), base.close) : null;
    result[`max_adverse_${horizon}d`] = lows.length ? pctChange(Math.min(...lows), base.close) : null;
  }

  let firstClose5 = null;
  let firstIntraday5 = null;
  for (let offset = 1; offset <= 10 && baseIndex + offset < series.length; offset += 1) {
    const row = series[baseIndex + offset];
    if (firstClose5 === null && pctChange(row.close, base.close) >= 5) firstClose5 = offset;
    const high = finiteNumber(row.high) ?? finiteNumber(row.close);
    if (firstIntraday5 === null && pctChange(high, base.close) >= 5) firstIntraday5 = offset;
  }
  result.days_to_close_rebound_5pct = firstClose5;
  result.days_to_intraday_rebound_5pct = firstIntraday5;
  result.labels = {
    close_rebound_1d_5pct: Number(result.future_return_1d) >= 5,
    close_rebound_3d_5pct: Number(result.future_return_3d) >= 5,
    close_rebound_3d_10pct: Number(result.future_return_3d) >= 10,
    close_rebound_5d_8pct: Number(result.future_return_5d) >= 8,
    close_rebound_5d_10pct: Number(result.future_return_5d) >= 10,
    close_rebound_10d_15pct: Number(result.future_return_10d) >= 15,
    intraday_rebound_3d_5pct: Number(result.max_return_3d) >= 5,
    intraday_rebound_5d_10pct: Number(result.max_return_5d) >= 10,
  };
  return result;
}

function groupOversoldObservations(observations, options = {}) {
  const maxGap = Number.isInteger(options.maxGap) ? options.maxGap : 3;
  const maxEpisodeSpan = Number.isInteger(options.maxEpisodeSpan) ? options.maxEpisodeSpan : 20;
  const groups = [];
  let current = [];

  for (const observation of observations.filter(item => item.is_oversold)) {
    if (!current.length) {
      current = [observation];
      continue;
    }
    const previous = current[current.length - 1];
    const gap = observation.series_index - previous.series_index;
    const span = observation.series_index - current[0].series_index;
    if (gap <= maxGap && span <= maxEpisodeSpan) current.push(observation);
    else {
      groups.push(current);
      current = [observation];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function eventSeverity(observation) {
  const values = observation?.price_volume || {};
  const components = [
    Math.abs(Math.min(0, finiteNumber(values.return_3d) || 0)) / 8,
    Math.abs(Math.min(0, finiteNumber(values.return_5d) || 0)) / 10,
    Math.abs(Math.min(0, finiteNumber(values.return_10d) || 0)) / 15,
    Math.abs(Math.min(0, finiteNumber(values.drawdown_20d) || 0)) / 15,
    Math.abs(Math.min(0, finiteNumber(values.drawdown_60d) || 0)) / 20,
    Math.max(0, 25 - (finiteNumber(values.rsi14) ?? 25)) / 25,
  ];
  return round(components.reduce((sum, value) => sum + value, 0), 4);
}

function buildEventsForSeries(stockCode, stockName, series, thresholds = DEFAULT_THRESHOLDS, options = {}) {
  const observations = series.map((row, index) => buildOversoldObservation(series, index, thresholds));
  const groups = groupOversoldObservations(observations, options);

  return groups.map((group, eventIndex) => {
    const first = group[0];
    const deepest = [...group].sort((left, right) => {
      if (left.close !== right.close) return left.close - right.close;
      return eventSeverity(right) - eventSeverity(left);
    })[0];
    const triggerIds = [...new Set(group.flatMap(item => item.triggers.map(trigger => trigger.id)))];
    return {
      event_id: `${stockCode}-${first.date}-${String(eventIndex + 1).padStart(2, '0')}`,
      stock_code: stockCode,
      stock_name: stockName,
      signal_date: first.date,
      episode_end_date: group[group.length - 1].date,
      deepest_signal_date: deepest.date,
      observation_count: group.length,
      trigger_ids: triggerIds,
      signal: {
        ...first,
        severity: eventSeverity(first),
      },
      deepest_signal: {
        ...deepest,
        severity: eventSeverity(deepest),
      },
      outcome_from_signal: buildOutcome(series, first.series_index),
      outcome_from_deepest_signal: buildOutcome(series, deepest.series_index),
    };
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseMarginCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return new Map();
  const headers = rows[0].map(value => String(value).trim());
  const index = Object.fromEntries(headers.map((header, cursor) => [header, cursor]));
  const result = new Map();
  for (const row of rows.slice(1)) {
    const code = String(row[index['股票代號']] || '').trim().toUpperCase();
    if (!code) continue;
    const marginPrevious = finiteNumber(row[index['融資前日餘額']]);
    const marginCurrent = finiteNumber(row[index['融資今日餘額']]);
    const shortPrevious = finiteNumber(row[index['融券前日餘額']]);
    const shortCurrent = finiteNumber(row[index['融券今日餘額']]);
    result.set(code, {
      stock_name: String(row[index['股票名稱']] || '').trim(),
      margin_balance: marginCurrent,
      margin_change: Number.isFinite(marginCurrent) && Number.isFinite(marginPrevious) ? marginCurrent - marginPrevious : null,
      short_balance: shortCurrent,
      short_change: Number.isFinite(shortCurrent) && Number.isFinite(shortPrevious) ? shortCurrent - shortPrevious : null,
      margin_buy: finiteNumber(row[index['融資買進']]),
      margin_sell: finiteNumber(row[index['融資賣出']]),
      short_buy: finiteNumber(row[index['融券買進']]),
      short_sell: finiteNumber(row[index['融券賣出']]),
      offset: finiteNumber(row[index['資券互抵']]),
    });
  }
  return result;
}

function parseInstitutionalPayload(payload) {
  const result = new Map();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const code = String(row[1] || '').trim().toUpperCase();
    if (!code) continue;
    let net = null;
    for (let cursor = row.length - 1; cursor >= 3; cursor -= 1) {
      const value = finiteNumber(row[cursor]);
      if (Number.isFinite(value)) {
        net = value;
        break;
      }
    }
    result.set(code, {
      stock_name: String(row[2] || '').trim(),
      net_shares: net,
    });
  }
  return result;
}

function parseBrokerPayload(payload) {
  const result = new Map();
  const stocks = payload && typeof payload === 'object' && payload.stocks && typeof payload.stocks === 'object'
    ? payload.stocks
    : null;
  if (!stocks) return result;
  for (const [code, stock] of Object.entries(stocks)) {
    const buyBrokers = Array.isArray(stock?.buyBrokers) ? stock.buyBrokers : [];
    const sellBrokers = Array.isArray(stock?.sellBrokers) ? stock.sellBrokers : [];
    const top5BuyNet = buyBrokers.slice(0, 5).reduce((sum, item) => sum + (finiteNumber(item.netBuy) || 0), 0);
    const top5SellNet = sellBrokers.slice(0, 5).reduce((sum, item) => sum + Math.abs(finiteNumber(item.netSell) || 0), 0);
    result.set(code.toUpperCase(), {
      totals_net_lots: finiteNumber(stock?.totals?.net),
      total_net_buy_lots: finiteNumber(stock?.totals?.netBuy),
      total_net_sell_lots: finiteNumber(stock?.totals?.netSell),
      top5_buy_net_lots: round(top5BuyNet),
      top5_sell_net_lots: round(top5SellNet),
      top5_net_concentration_lots: round(top5BuyNet - top5SellNet),
      top_buyers: buyBrokers.slice(0, 5).map(item => ({
        broker_name: item.brokerName || null,
        broker_id: item.brokerId || null,
        branch_id: item.branchId || null,
        net_buy_lots: finiteNumber(item.netBuy),
        share_percent: finiteNumber(item.sharePercent),
      })),
      top_sellers: sellBrokers.slice(0, 5).map(item => ({
        broker_name: item.brokerName || null,
        broker_id: item.brokerId || null,
        branch_id: item.branchId || null,
        net_sell_lots: finiteNumber(item.netSell),
        share_percent: finiteNumber(item.sharePercent),
      })),
    });
  }
  return result;
}

function sumFeatureByDates(dailyMaps, dates, code, field) {
  const values = dates.map(date => dailyMaps.get(date)?.get(code)?.[field]).filter(Number.isFinite);
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0));
}

function latestFeatureByDate(dailyMaps, date, code) {
  return dailyMaps.get(date)?.get(code) || null;
}

function previousTradingDates(allDates, eventDate, count) {
  const index = allDates.indexOf(eventDate);
  if (index < 0) return [];
  return allDates.slice(Math.max(0, index - count + 1), index + 1);
}

function enrichEvent(event, context) {
  const { allDates, foreign, trust, dealers, margin, brokers } = context;
  const code = event.stock_code;
  const eventDate = event.signal_date;
  const volumeLots = finiteNumber(event.signal?.price_volume?.volume_lots);
  const volumeShares = Number.isFinite(volumeLots) ? volumeLots * 1000 : null;
  const windows = [1, 3, 5, 10];

  const institutional = {};
  for (const [label, source] of [['foreign', foreign], ['investment_trust', trust], ['dealer', dealers]]) {
    const current = latestFeatureByDate(source, eventDate, code)?.net_shares ?? null;
    const previousDateIndex = allDates.indexOf(eventDate) - 1;
    const previousDate = previousDateIndex >= 0 ? allDates[previousDateIndex] : null;
    const previous = previousDate ? latestFeatureByDate(source, previousDate, code)?.net_shares ?? null : null;
    institutional[label] = {
      current_net_shares: current,
      current_net_lots: Number.isFinite(current) ? round(current / 1000) : null,
      current_net_to_volume_pct: Number.isFinite(current) && Number.isFinite(volumeShares) && volumeShares !== 0
        ? round((current / volumeShares) * 100)
        : null,
      turned_to_buy: Number.isFinite(current) && Number.isFinite(previous) ? current > 0 && previous <= 0 : null,
    };
    for (const window of windows) {
      const dates = previousTradingDates(allDates, eventDate, window);
      institutional[label][`net_${window}d_shares`] = sumFeatureByDates(source, dates, code, 'net_shares');
    }
  }

  const marginCurrent = latestFeatureByDate(margin, eventDate, code);
  const marginFeature = marginCurrent ? { ...marginCurrent } : null;
  if (marginFeature) {
    for (const window of [3, 5, 10]) {
      const dates = previousTradingDates(allDates, eventDate, window);
      marginFeature[`margin_change_${window}d`] = sumFeatureByDates(margin, dates, code, 'margin_change');
      marginFeature[`short_change_${window}d`] = sumFeatureByDates(margin, dates, code, 'short_change');
    }
    marginFeature.source_unit_note = '保留來源原始單位；在確認與成交量單位一致前不計算占比。';
  }

  const brokerCurrent = latestFeatureByDate(brokers, eventDate, code);
  const dataAvailability = {
    price_volume: true,
    foreign: Boolean(latestFeatureByDate(foreign, eventDate, code)),
    investment_trust: Boolean(latestFeatureByDate(trust, eventDate, code)),
    dealer: Boolean(latestFeatureByDate(dealers, eventDate, code)),
    margin: Boolean(marginCurrent),
    broker: Boolean(brokerCurrent),
  };
  dataAvailability.available_feature_groups = Object.values(dataAvailability).filter(Boolean).length;
  dataAvailability.total_feature_groups = 6;
  dataAvailability.completeness_pct = round((dataAvailability.available_feature_groups / dataAvailability.total_feature_groups) * 100, 2);

  return {
    ...event,
    features: {
      price_volume: event.signal.price_volume,
      institutional,
      margin: marginFeature,
      broker: brokerCurrent,
      market_optional: null,
    },
    data_availability: dataAvailability,
  };
}

function buildStockProfile(stockCode, stockName, events) {
  const outcome = key => events.map(event => finiteNumber(event.outcome_from_signal?.[key])).filter(Number.isFinite);
  const labels = key => events.filter(event => event.outcome_from_signal?.labels?.[key] === true).length;
  const successful = labels('intraday_rebound_5d_10pct');
  const failure = events.length - successful;
  const featureCoverage = {
    foreign: events.filter(event => event.data_availability?.foreign).length,
    investment_trust: events.filter(event => event.data_availability?.investment_trust).length,
    dealer: events.filter(event => event.data_availability?.dealer).length,
    margin: events.filter(event => event.data_availability?.margin).length,
    broker: events.filter(event => event.data_availability?.broker).length,
  };

  return {
    schema_version: 1,
    stock_code: stockCode,
    stock_name: stockName,
    event_count: events.length,
    successful_rebound_count: successful,
    non_success_count: failure,
    rebound_rate_5d_intraday_10pct: events.length ? round((successful / events.length) * 100, 2) : null,
    close_rebound_rate_3d_5pct: events.length ? round((labels('close_rebound_3d_5pct') / events.length) * 100, 2) : null,
    close_rebound_rate_5d_10pct: events.length ? round((labels('close_rebound_5d_10pct') / events.length) * 100, 2) : null,
    average_future_return_1d: round(average(outcome('future_return_1d'))),
    average_future_return_3d: round(average(outcome('future_return_3d'))),
    average_future_return_5d: round(average(outcome('future_return_5d'))),
    average_future_return_10d: round(average(outcome('future_return_10d'))),
    median_future_return_5d: round(median(outcome('future_return_5d'))),
    median_max_return_5d: round(median(outcome('max_return_5d'))),
    median_max_adverse_5d: round(median(outcome('max_adverse_5d'))),
    typical_signal_return_5d: round(median(events.map(event => event.signal?.price_volume?.return_5d))),
    typical_signal_drawdown_20d: round(median(events.map(event => event.signal?.price_volume?.drawdown_20d))),
    typical_signal_rsi14: round(median(events.map(event => event.signal?.price_volume?.rsi14))),
    evidence_level: events.length >= 10 ? 'stock_specific' : events.length >= 6 ? 'weak_stock_pattern' : events.length >= 3 ? 'early_observation' : 'insufficient',
    feature_coverage: Object.fromEntries(Object.entries(featureCoverage).map(([key, count]) => [key, {
      event_count: count,
      coverage_pct: events.length ? round((count / events.length) * 100, 2) : 0,
    }])),
  };
}

function summarizeResearch(stockResults, dataQuality, thresholds) {
  const allEvents = stockResults.flatMap(result => result.events);
  const labelCount = label => allEvents.filter(event => event.outcome_from_signal?.labels?.[label]).length;
  const byEvidence = {};
  for (const result of stockResults) byEvidence[result.profile.evidence_level] = (byEvidence[result.profile.evidence_level] || 0) + 1;
  const featureCoverage = {};
  for (const key of ['foreign', 'investment_trust', 'dealer', 'margin', 'broker']) {
    const count = allEvents.filter(event => event.data_availability?.[key]).length;
    featureCoverage[key] = {
      event_count: count,
      coverage_pct: allEvents.length ? round((count / allEvents.length) * 100, 2) : 0,
    };
  }

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    research_id: 'historical_oversold_rebound_research_v1',
    label: '個股跌深反彈歷史事件研究',
    purpose: '先從真實個股價量找出跌深事件，再比較反彈與未反彈樣本的歷史特徵；不依賴外部市場預測資料。',
    thresholds,
    stock_count: stockResults.length,
    event_count: allEvents.length,
    outcome_counts: {
      close_rebound_3d_5pct: labelCount('close_rebound_3d_5pct'),
      close_rebound_5d_10pct: labelCount('close_rebound_5d_10pct'),
      intraday_rebound_5d_10pct: labelCount('intraday_rebound_5d_10pct'),
      close_rebound_10d_15pct: labelCount('close_rebound_10d_15pct'),
    },
    evidence_levels: byEvidence,
    feature_coverage: featureCoverage,
    data_quality: dataQuality,
    notes: [
      '事件成立只使用個股當時與過去的價量資料；未來行情只用於結果標籤。',
      '外部市場、SOX、ADR、油價與台指夜盤不是事件成立條件。',
      '法人與融資資料缺少時保留 null；不會當成 0。',
      '券商分點只在來源 JSON 可解析且包含 stocks 時才計入。',
      '第一版是事件資料庫與探索基礎，不是正式選股分數。',
    ],
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  OUTCOME_HORIZONS,
  finiteNumber,
  round,
  pctChange,
  average,
  median,
  parseCsv,
  parseMarginCsv,
  parseInstitutionalPayload,
  parseBrokerPayload,
  computeRsi,
  drawdownFromRollingHigh,
  buildOversoldObservation,
  buildOutcome,
  groupOversoldObservations,
  buildEventsForSeries,
  enrichEvent,
  buildStockProfile,
  summarizeResearch,
};
