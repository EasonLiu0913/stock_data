(async () => {
  const numberValue = (value) => {
    const cleaned = String(value ?? "")
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();

    if (!cleaned || cleaned === "--") return null;

    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  };

  const formatDate = (timestamp) => {
    if (!Number.isFinite(Number(timestamp))) return null;

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(Number(timestamp)));
  };

  const compactDate = (date) => date?.replaceAll("-", "") ?? null;

  const fullTradeDate = document
    .querySelector("#tradeDate")
    ?.textContent
    ?.trim()
    ?.replaceAll("/", "-");

  if (!fullTradeDate) {
    throw new Error("找不到 #tradeDate，請確認表格已經載入。");
  }

  const latestDate = new Date(`${fullTradeDate}T00:00:00+08:00`);
  const latestYear = latestDate.getFullYear();
  const latestMonth = latestDate.getMonth() + 1;

  const resolveTableDate = (monthDay) => {
    const match = String(monthDay).match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;

    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = month > latestMonth ? latestYear - 1 : latestYear;

    return [
      year,
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  };

  // 擷取底下「扣除 ETF 資券進出行情」表格
  const table = [...document.querySelectorAll(
    "#transactionTable tbody tr"
  )].map((row) => {
    const cells = [...row.querySelectorAll("td")]
      .map((cell) => cell.textContent.trim());

    if (cells.length < 10) return null;

    const shortBalanceLots = numberValue(cells[4]);
    const shortFinancingRatioPercent = numberValue(cells[6]);

    // 券資比只有顯示至小數點後兩位，因此只能反推近似融資張數。
    const financingBalanceLotsEstimated =
      shortBalanceLots !== null &&
      shortFinancingRatioPercent !== null &&
      shortFinancingRatioPercent !== 0
        ? Math.round(
            shortBalanceLots /
            (shortFinancingRatioPercent / 100)
          )
        : null;

    return {
      date: resolveTableDate(cells[0]),
      financingBalance100M: numberValue(cells[1]),
      financingChange100M: numberValue(cells[2]),
      marginMaintenanceRatePercent: numberValue(cells[3]),
      shortBalanceLots,
      shortChangeLots: numberValue(cells[5]),
      shortFinancingRatioPercent,
      financingBalanceLotsEstimated,
      close: numberValue(cells[7]),
      changePercent: numberValue(cells[8]),
      volume: numberValue(cells[9])
    };
  }).filter(Boolean);

  if (table.length === 0) {
    throw new Error("表格沒有可擷取的資料。");
  }

  // 擷取 Highcharts 完整歷史資料
  const chart = window.chart;

  const findSeries = (name) =>
    chart?.series?.find((series) =>
      String(series.name).includes(name)
    );

  const candlestickSeries = findSeries("加權指數");
  const maintenanceSeries = findSeries("大盤融資維持率");
  const financingSeries = findSeries("融資餘額");
  const shortSeries = findSeries("融券餘額");

  const seriesMap = (series, transform = (value) => value) => {
    const result = new Map();

    if (!series) return result;

    const xData = series.xData ?? [];
    const yData = series.yData ?? [];

    xData.forEach((timestamp, index) => {
      result.set(
        Number(timestamp),
        transform(yData[index], index, series)
      );
    });

    return result;
  };

  const candlestickMap = seriesMap(
    candlestickSeries,
    (value) => {
      if (!Array.isArray(value)) return null;

      return {
        open: numberValue(value[0]),
        high: numberValue(value[1]),
        low: numberValue(value[2]),
        close: numberValue(value[3])
      };
    }
  );

  const maintenanceMap = seriesMap(
    maintenanceSeries,
    (value) => {
      const number = numberValue(value);
      return number === null ? null : number * 100;
    }
  );

  const financingMap = seriesMap(
    financingSeries,
    numberValue
  );

  const shortMap = seriesMap(
    shortSeries,
    numberValue
  );

  const timestamps = [
    ...new Set([
      ...candlestickMap.keys(),
      ...maintenanceMap.keys(),
      ...financingMap.keys(),
      ...shortMap.keys()
    ])
  ].sort((a, b) => a - b);

  const chartHistory = timestamps.map((timestamp) => ({
    date: formatDate(timestamp),
    timestamp,
    taiex: candlestickMap.get(timestamp) ?? null,
    marginMaintenanceRatePercent:
      maintenanceMap.get(timestamp) ?? null,
    financingBalance100M:
      financingMap.get(timestamp) ?? null,
    shortBalanceLots:
      shortMap.get(timestamp) ?? null
  }));

  const latest = table[0];

  const result = {
    source: {
      name: "Wantgoo",
      page: location.origin + location.pathname,
      title: document.title
    },
    scrapedAt: new Date().toISOString(),
    tradeDate: latest.date,
    tradeDateCompact: compactDate(latest.date),

    latest: {
      financingBalance100M:
        latest.financingBalance100M,
      financingChange100M:
        latest.financingChange100M,
      marginMaintenanceRatePercent:
        latest.marginMaintenanceRatePercent,
      shortBalanceLots:
        latest.shortBalanceLots,
      shortChangeLots:
        latest.shortChangeLots,
      shortFinancingRatioPercent:
        latest.shortFinancingRatioPercent,
      financingBalanceLotsEstimated:
        latest.financingBalanceLotsEstimated,
      close: latest.close,
      changePercent: latest.changePercent,
      volume: latest.volume
    },

    chartHistory,
    table,

    metadata: {
      tableRowCount: table.length,
      chartRowCount: chartHistory.length,
      financingBalanceUnit: "億元",
      shortBalanceUnit: "張",
      volumeUnit: "網頁顯示單位",
      financingBalanceLotsEstimated:
        "由融券餘額 ÷ 券資比反推。因券資比只顯示小數點後兩位，此欄為近似值，不可視為官方精確融資張數。"
    }
  };

  const json = JSON.stringify(result, null, 2);

  // 優先使用 Chrome DevTools 內建 copy()
  if (typeof copy === "function") {
    copy(json);
    console.log("✅ JSON 已使用 DevTools copy() 複製到剪貼簿。");
  } else {
    try {
      await navigator.clipboard.writeText(json);
      console.log("✅ JSON 已複製到剪貼簿。");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = json;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      console.log("✅ JSON 已使用備援方式複製到剪貼簿。");
    }
  }

  console.log("📅 資料日期：", result.tradeDate);
  console.log("📊 表格筆數：", result.table.length);
  console.log("📈 圖表筆數：", result.chartHistory.length);
  console.log("📋 JSON：", result);

  return result;
})();