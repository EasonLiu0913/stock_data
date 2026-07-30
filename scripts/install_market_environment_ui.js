#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'public', 'prediction-dashboard.html');

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Unable to install market environment UI: missing ${label}`);
  return text.replace(search, replacement);
}

function main() {
  let html = fs.readFileSync(FILE, 'utf8');
  const original = html;
  const alreadyInstalled = html.includes('id="marketEnvironmentBanner"');

  if (!alreadyInstalled) {
    html = replaceOnce(
      html,
      '</style>',
      '.environment-banner{margin-bottom:14px;border:1px solid #cbd5e1;border-left:6px solid #64748b;background:#fff;border-radius:8px;padding:14px 16px}.environment-banner.normal{border-left-color:#17804b}.environment-banner.risk_warning{border-left-color:#d58b00;background:#fffaf0}.environment-banner.shock_first_day_warning{border-left-color:#c43d3d;background:#fff5f5}.environment-banner.post_shock_day_1,.environment-banner.post_shock_day_2{border-left-color:#7c3aed;background:#faf7ff}.environment-banner.data_invalid{border-left-color:#991b1b;background:#fef2f2}.environment-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.environment-title{font-size:18px;font-weight:900}.environment-score{font-weight:900}.environment-details{display:flex;gap:8px 16px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#526173}.environment-policy{margin-top:8px;font-size:13px;font-weight:800}.environment-trigger{display:inline-flex;margin:6px 6px 0 0;padding:3px 8px;border-radius:999px;background:#eef2f7;font-size:12px;font-weight:800}</style>',
      'style close',
    );
    html = replaceOnce(
      html,
      '<section class="grid kpis" id="kpis"></section>',
      '<section class="environment-banner" id="marketEnvironmentBanner"><div class="environment-title">市場環境載入中…</div></section><section class="grid kpis" id="kpis"></section>',
      'KPI section',
    );
    html = replaceOnce(
      html,
      "let dashboard, basePriceData=null, marketNews=null, marketRisk=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[], cnnFearGreed=null;",
      "let dashboard, basePriceData=null, marketNews=null, marketRisk=null, marketEnvironment=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[], cnnFearGreed=null;",
      'dashboard globals',
    );
    html = replaceOnce(
      html,
      'await Promise.all([loadBasePrices(),loadMarketNews(),loadClassLists(),loadOilPrices(),loadFuturesOpenInterest(),loadCnnFearGreed()]);init(m);',
      'await Promise.all([loadBasePrices(),loadMarketNews(),loadMarketEnvironment(),loadClassLists(),loadOilPrices(),loadFuturesOpenInterest(),loadCnnFearGreed()]);init(m);',
      'dashboard loaders',
    );
    html = replaceOnce(
      html,
      'async function loadBasePrices(){',
      `async function loadMarketEnvironment(){const forecast=compact(dashboard.forecast_date);marketEnvironment=await fetchJsonOrNull(\`data_market_environment/\${forecast}/market_environment.json\`);}
    function renderMarketEnvironment(){const el=document.getElementById('marketEnvironmentBanner');if(!el)return;if(!marketEnvironment){el.className='environment-banner data_invalid';el.innerHTML='<div class="environment-title">市場環境快照尚未產生</div><div class="environment-policy">請先執行 Prepare Market Environment；目前不套用任何環境政策。</div>';return;}const env=marketEnvironment.environment||{};const freshness=marketEnvironment.data_freshness||{};const policy=marketEnvironment.strategy_policy||{};const metrics=marketEnvironment.metrics||{};const triggers=(env.triggers||[]).map(item=>\`<span class="environment-trigger">\${esc(item.label)}（+\${item.points}）</span>\`).join('');const policyText=policy.relative_leadership_momentum==='disabled_shadow'?'相對領漲量價策略：Shadow 停用':policy.relative_leadership_momentum==='restricted_shadow'?'相對領漲量價策略：Shadow 限制':policy.relative_leadership_momentum==='reduced_shadow'?'相對領漲量價策略：Shadow 縮小清單':'相對領漲量價策略：正常';el.className=\`environment-banner \${env.code||'data_invalid'}\`;el.innerHTML=\`<div class="environment-head"><div><div class="environment-title">\${esc(env.label||env.code||'未知環境')}｜Shadow mode</div><div class="environment-details"><span>分數 \${Number.isFinite(Number(env.score))?env.score:'NA'}</span><span>外部資料 \${esc(freshness.status||'NA')}</span><span>美股市場日 \${esc(freshness.actual_us_market_date||'NA')}</span><span>費半 1 日 \${signedPct(Number(metrics.sox_change_1d_pct))}</span><span>費半 3 日 \${signedPct(Number(metrics.sox_return_3d_pct))}</span><span>外資期貨淨口 \${Number.isFinite(Number(metrics.foreign_futures_net_contracts))?Number(metrics.foreign_futures_net_contracts).toLocaleString('zh-TW'):'NA'}</span></div></div><div class="environment-score">snapshot \${esc(String(marketEnvironment.snapshot_hash||'').slice(0,12))}</div></div><div class="environment-policy">\${policyText}；正式方向分數調整 \${policy.formal_direction_score_adjustment??0}。</div><div>\${triggers||'<span class="environment-trigger">未觸發首日衝擊條件</span>'}</div>\`; }
    async function loadBasePrices(){`,
      'base price loader',
    );
    html = replaceOnce(
      html,
      'function init(manifest){document.querySelector',
      'function init(manifest){renderMarketEnvironment();document.querySelector',
      'init function',
    );
  }

  html = html
    .replace("fetch('../data_predictions/manifest.json')", "fetch('../data_predictions/manifest.json',{cache:'no-store'})")
    .replace('fetch(`../${summaryPath}`)', "fetch(`../${summaryPath}`,{cache:'no-store'})")
    .replace('fetch(`../${file}`)', "fetch(`../${file}`,{cache:'no-store'})");

  if (html === original) {
    console.log('Market environment UI and no-store fetches already installed');
    return;
  }
  fs.writeFileSync(FILE, html, 'utf8');
  console.log(`Installed market environment UI in ${path.relative(ROOT, FILE)}`);
}

main();
