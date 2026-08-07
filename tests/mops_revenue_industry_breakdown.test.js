'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {consecutive,revenueHigh3}=require('../scripts/summarize_mops_revenue_industry_breakdown');
const m=new Map([
 ['202604',{yoy_pct:25,monthly_revenue_thousand_twd:100}],
 ['202605',{yoy_pct:30,monthly_revenue_thousand_twd:120}],
 ['202606',{yoy_pct:35,monthly_revenue_thousand_twd:150}],
]);
test('consecutive YoY threshold requires complete lookback',()=>{assert.equal(consecutive(m,'202606',2),true);assert.equal(consecutive(m,'202606',3),true);assert.equal(consecutive(m,'202604',2),false);});
test('3-month revenue high requires complete three months',()=>{assert.equal(revenueHigh3(m,'202606'),true);assert.equal(revenueHigh3(m,'202605'),false);});
