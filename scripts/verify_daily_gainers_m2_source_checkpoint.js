'use strict';
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED = ['foreign_excluding_foreign_dealers','investment_trust','dealer_proprietary','dealer_hedge'];
function assert(ok, message) { if (!ok) throw new Error(message); }
function verifyM2SourceCheckpoint(input, targetDate='20261008') {
  assert(/^\d{8}$/.test(targetDate),'invalid target date');
  assert(input && input.phase === 'M2' && input.goal_version === 'goal-v2','wrong phase or goal');
  assert(input.date === targetDate,'stale or wrong source date');
  const i=input.institutional;
  assert(i && i.units === 'TWD','institutional monetary amounts must be TWD, not shares');
  assert(i.reported_date === '115年10月08日' && targetDate==='20261008','unverified institutional source date');
  assert(i.source_url === 'https://www.twse.com.tw/fund/BFI82U?response=html&type=day','institutional source mismatch');
  assert(Array.isArray(i.rows) && i.rows.length===EXPECTED.length,'missing or duplicated institutional categories');
  assert(EXPECTED.every((name,index)=>i.rows[index].name===name),'wrong institutional group identity/order');
  let buy=0,sell=0,net=0;
  for (const row of i.rows) {
    for (const field of ['buy','sell','net']) assert(Number.isSafeInteger(row[field]),'non-integer institutional '+field);
    assert(row.buy>=0 && row.sell>=0 && row.net===row.buy-row.sell,'institutional row arithmetic mismatch: '+row.name);
    buy+=row.buy; sell+=row.sell; net+=row.net;
  }
  assert(Number.isSafeInteger(buy)&&Number.isSafeInteger(sell),'unsafe institutional sum');
  assert(i.reported_total && i.reported_total.buy===buy && i.reported_total.sell===sell && i.reported_total.net===net,'institutional total mismatch or dealer double count');
  assert(input.industry && input.industry.units==='TWD' && input.industry.reported_date==='115年10月08日','sector source date/unit mismatch');
  assert(input.industry.raw_archive_verified===false,'unsupported original industry raw archive verification claim');
  assert(Array.isArray(input.industry.example_rows) && input.industry.example_rows.every(x=>typeof x.index==='string'&&Number.isSafeInteger(x.turnover)&&x.turnover>=0),'bad industry turnover examples');
  assert(input.previous_five && Array.isArray(input.previous_five.dates) && input.previous_five.dates.length===5,'five trading days required');
  const dates=input.previous_five.dates;
  assert(dates.every(d=>/^\d{8}$/.test(d)&&d<targetDate) && dates.every((d,n)=>n===0||d>dates[n-1]),'trading-day order, uniqueness, or cutoff mismatch');
  assert(input.status==='partial' && input.prompt_a_complete===false && input.prompt_b_eligible===false,'research source checkpoint cannot authorize publication or B');
  assert(Array.isArray(input.missing)&&input.missing.length>0,'missing gates must be explicit');
  return {date:targetDate,status:'partial',verified_checks:['group_arithmetic','TWD_units','date_labels','distinct_five_days','industry_example_nonnegative','fail_closed'],total:{buy,sell,net},publication_authorized:false,primary_raw_archive_verified:false};
}
module.exports={verifyM2SourceCheckpoint};
if (require.main===module) {
 const file=process.argv[2]||path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-official-institution-industry-source-checkpoint.json');
 console.log(JSON.stringify(verifyM2SourceCheckpoint(JSON.parse(fs.readFileSync(file,'utf8')),process.argv[3]||'20261008'),null,2));
}
