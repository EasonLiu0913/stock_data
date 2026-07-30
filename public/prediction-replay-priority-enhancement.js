(() => {
  if (window.__replayPriorityEnhancementInstalled) return;
  window.__replayPriorityEnhancementInstalled = true;

  const formatPct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : 'NA';
  const formatSignedPct = value => Number.isFinite(Number(value))
    ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`
    : 'NA';
  const isAccurate = row => String(row?.prediction_match_label || '').includes('準確');
  const isObviousMiss = row => row?.prediction_match_label === '明顯不準';
  const predictionLabel = row => String(row?.prediction?.final_direction_label || '');
  const hasStrategy = (row, tag) => (row?.prediction?.strategy_tags || []).includes(tag);

  function summarize(rows) {
    const count = rows.length;
    const hitCount = rows.filter(isAccurate).length;
    const obviousMissCount = rows.filter(isObviousMiss).length;
    return {
      count,
      hitCount,
      obviousMissCount,
      hitRate: count ? hitCount / count * 100 : null,
      obviousMissRate: count ? obviousMissCount / count * 100 : null,
    };
  }

  function quadrantText(label, summary) {
    const sampleNote = summary.count < 30 ? '，小樣本' : '';
    return `${label} ${summary.count} 筆（命中 ${formatPct(summary.hitRate)}，明顯錯誤 ${formatPct(summary.obviousMissRate)}${sampleNote}）`;
  }

  function excludedReasonText(summary) {
    const labels = {
      zero_or_missing_volume: '成交量為零或缺漏',
      missing_base_close: '缺基準收盤',
      missing_actual_ohlc: '缺實際 OHLC',
      low_liquidity: '低流動性',
    };
    return (summary?.outcome_eligibility?.excluded_by_reason || [])
      .map(item => `${labels[item.name] || item.name} ${item.count}`)
      .join('、');
  }

  function priorityRank(level) {
    return level === 'P0' ? 0 : level === 'P1' ? 1 : 2;
  }

  function install() {
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    const priorityList = document.getElementById('priorityList');
    const guardrails = document.getElementById('guardrails');
    if (!priorityList || !guardrails) return false;

    const originalRenderPriorities = typeof renderPriorities === 'function' ? renderPriorities : null;
    if (originalRenderPriorities?.__dynamicPriorityVersion === '3') return true;

    function enhancedRenderPriorities() {
      const s = state.summary;
      const verified = state.rows.filter(row => row.verified);
      const bullishRows = verified.filter(row => predictionLabel(row).includes('多'));
      const bearishRows = verified.filter(row => predictionLabel(row).includes('空'));
      const bullish = summarize(bullishRows);
      const bearish = summarize(bearishRows);
      const bullishGap = Number(s.bearish_hit_rate) - Number(s.bullish_hit_rate);
      const market = s.market_breadth || {};
      const oneSidedMarket = Number(market.down_ratio) >= 70 || Number(market.up_ratio) >= 70;
      const marketDirection = Number(market.down_ratio) >= 70
        ? `下跌占 ${formatPct(market.down_ratio)}`
        : Number(market.up_ratio) >= 70
          ? `上漲占 ${formatPct(market.up_ratio)}`
          : null;

      const relativeFactor = (s.prediction_time_factor_associations || [])
        .find(item => item.factor === 'relative_strength_strong');

      const chipOnly = summarize(bullishRows.filter(row => hasStrategy(row, '籌碼同步偏多') && !hasStrategy(row, '技術強勢')));
      const technicalOnly = summarize(bullishRows.filter(row => !hasStrategy(row, '籌碼同步偏多') && hasStrategy(row, '技術強勢')));
      const both = summarize(bullishRows.filter(row => hasStrategy(row, '籌碼同步偏多') && hasStrategy(row, '技術強勢')));
      const neither = summarize(bullishRows.filter(row => !hasStrategy(row, '籌碼同步偏多') && !hasStrategy(row, '技術強勢')));
      const technicalTotal = technicalOnly.count + both.count;

      const priorities = [];

      if (bullish.count >= 30 && Number.isFinite(bullishGap) && bullishGap >= 10) {
        priorities.push({
          level: bullishGap >= 20 && bullish.obviousMissCount >= 20 ? 'P0' : 'P1',
          severity: bullishGap,
          title: oneSidedMarket ? '先分離市場單邊走勢，再校準偏多門檻' : '重新校準偏多方向的進場門檻',
          evidence: `偏多 ${bullish.count} 筆，命中 ${formatPct(s.bullish_hit_rate)}、明顯錯誤 ${bullish.obviousMissCount} 筆（${formatPct(bullish.obviousMissRate)}）；偏空 ${bearish.count} 筆，命中 ${formatPct(s.bearish_hit_rate)}，命中差 ${formatPct(bullishGap)}${marketDirection ? `；本日市場${marketDirection}` : ''}。`,
          next: oneSidedMarket
            ? '下一步：先依市場廣度分成單邊下跌／單邊上漲／一般交易日，再於各分層做偏多門檻提高與降級的離線重算；不直接用單日結果覆寫正式規則。'
            : '下一步：將偏多樣本依籌碼、相對強勢與技術強勢拆層，做門檻提高／降級的離線重算，不直接覆寫正式規則。',
          impact: `${bullish.obviousMissCount} / ${bullish.count}`,
          impactLabel: '偏多明顯錯誤',
        });
      }

      if (relativeFactor && relativeFactor.exposed_count > 0 && relativeFactor.unexposed_count > 0) {
        const sufficient = relativeFactor.exposed_count >= 30 && relativeFactor.unexposed_count >= 30;
        const difference = Number(relativeFactor.hit_rate_difference);
        priorities.push({
          level: sufficient && Math.abs(difference) >= 10 ? 'P1' : 'P2',
          severity: Math.abs(difference || 0),
          title: '檢驗「七日相對強勢」是否被當成過度延續訊號',
          evidence: `有七日強勢因子 ${relativeFactor.exposed_count} 筆，命中 ${formatPct(relativeFactor.exposed_hit_rate)}；無因子對照 ${relativeFactor.unexposed_count} 筆，命中 ${formatPct(relativeFactor.unexposed_hit_rate)}；關聯差 ${formatSignedPct(relativeFactor.hit_rate_difference)}。`,
          next: sufficient
            ? '下一步：在相同預測方向、方向分數區間、產業與市場環境內做配對；再測試改為確認條件或降低權重。'
            : '下一步：目前對照樣本不足，先累積更多覆盤日，不調整正式權重。',
          impact: `${relativeFactor.exposed_count} / ${relativeFactor.unexposed_count}`,
          impactLabel: '有因子／對照',
        });
      }

      if (technicalTotal > 0 || chipOnly.count > 0 || both.count > 0) {
        const techSummary = summarize(bullishRows.filter(row => hasStrategy(row, '技術強勢')));
        const bullishMissRate = bullish.obviousMissRate;
        const techExcess = Number.isFinite(techSummary.obviousMissRate) && Number.isFinite(bullishMissRate)
          ? techSummary.obviousMissRate - bullishMissRate
          : 0;
        priorities.push({
          level: technicalTotal >= 30 && techExcess >= 10 ? 'P1' : 'P2',
          severity: Math.max(techExcess, both.count),
          title: '拆開偏多樣本中「籌碼同步偏多」與「技術強勢」的四象限效果',
          evidence: [
            quadrantText('只籌碼', chipOnly),
            quadrantText('只技術', technicalOnly),
            quadrantText('兩者同時', both),
            quadrantText('兩者皆無', neither),
          ].join('；') + '。',
          next: '下一步：在偏多樣本內，再控制方向分數、產業與市場環境比較四象限；只有「兩者同時」相對只籌碼或皆無穩定改善時，才保留疊加升級。',
          impact: `${both.count} 同時`,
          impactLabel: '偏多真正交集',
        });
      }

      if (s.missing_count > 0) {
        const reasons = excludedReasonText(s);
        priorities.push({
          level: 'P2',
          severity: s.missing_count,
          title: '補齊被排除股票，再評估模型',
          evidence: `${s.missing_count} 檔被排除${reasons ? `：${reasons}` : ''}；這些是資料資格問題，不計入模型命中或錯誤。`,
          next: '下一步：依排除原因回補相鄰交易日價格與成交量；低流動性維持獨立敏感度分析，不與一般樣本混算。',
          impact: `${s.missing_count} 排除`,
          impactLabel: '資料缺口',
        });
      }

      priorities.sort((left, right) => priorityRank(left.level) - priorityRank(right.level) || right.severity - left.severity);

      const queueHeading = [...document.querySelectorAll('.section-head h2')]
        .find(element => element.textContent.trim() === '下一步修正佇列');
      const queueDescription = queueHeading?.parentElement?.querySelector('p');
      if (queueDescription) {
        queueDescription.textContent = '依當日樣本數、命中差與明顯錯誤率動態排序；屬探索性診斷，尚未代表跨日結論。';
      }

      priorityList.innerHTML = priorities.map(item => `
        <div class="priority-item">
          <div class="rank ${item.level === 'P1' ? 'p1' : item.level === 'P2' ? 'p2' : ''}">${item.level}</div>
          <div class="priority-copy"><h3>${item.title}</h3><p>${item.evidence}</p><p class="next">${item.next}</p></div>
          <div class="impact"><b>${item.impact}</b>${item.impactLabel}</div>
        </div>
      `).join('') || '<div class="case-summary">本日沒有達到樣本與差異門檻的高優先修正項目。</div>';

      const highRisk = (s.prediction_time_factor_associations || [])
        .find(item => item.factor === 'high_risk_context');
      const guardrailItems = [];
      if (highRisk) {
        if (highRisk.unexposed_count === 0) {
          guardrailItems.push(`高風險市場環境涵蓋全部 ${highRisk.exposed_count.toLocaleString()} 筆有效樣本，沒有低風險對照組；不能據此調高或調低市場風險權重。`);
        } else {
          guardrailItems.push(`高風險市場環境 ${highRisk.exposed_count.toLocaleString()} 筆／非高風險 ${highRisk.unexposed_count.toLocaleString()} 筆；仍須跨日配對後才能調整市場風險權重。`);
        }
      }
      if (oneSidedMarket) {
        guardrailItems.push(`本日市場${marketDirection}，偏多與偏空命中率會受到結果日市場方向影響；不可把單日方向差直接視為模型永久偏誤。`);
      }
      guardrailItems.push('單一交易日只能提出關聯線索；至少累積多個覆盤日並控制市場、產業與方向分數後，再做參數調整。');
      guardrailItems.push('開高走低、開低走高是結果日機制，不可直接放回事前特徵，避免資料洩漏。');
      guardrails.innerHTML = guardrailItems.map(item => `<li>${item}</li>`).join('');
    }

    enhancedRenderPriorities.__dynamicPriorityVersion = '3';
    renderPriorities = enhancedRenderPriorities;
    enhancedRenderPriorities();
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 200) clearInterval(timer);
    } catch (error) {
      clearInterval(timer);
      console.error('Unable to install replay priority enhancement:', error);
    }
  }, 50);
})();
