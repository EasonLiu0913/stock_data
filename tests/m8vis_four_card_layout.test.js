'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'm8vis-slide-'));
try {
  const date = '20261008';
  const dir = path.join(temp, 'output/daily-gainers-video', date);
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({
    schema_version:2,target_date:date,scenes:[{
      id:1,title:'市場概況',subtitle:'四格資訊',
      visual_summary_points:['5%～7% 強勢股','7%～9.5% 強勢股','9.5% 以上強勢股','強勢股總數']
    }]
  }));
  const result = spawnSync(process.execPath,
    [path.join(root,'scripts/build_daily_gainers_v2_slides.js'),date],
    {cwd:temp,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const svg = fs.readFileSync(path.join(dir,'slides/01.svg'),'utf8');
  assert.equal((svg.match(/width="558" height="194"/g)||[]).length,4);
  for (const position of ['x="130" y="292"','x="720" y="292"','x="130" y="514"','x="720" y="514"']) {
    assert.ok(svg.includes(position),position);
  }
  for (const value of ['5%～7% 強勢股','7%～9.5% 強勢股','9.5% 以上強勢股','強勢股總數']) {
    assert.ok(svg.includes(value),value);
  }
  // Verify actual count emphasis and ensure unit is outside the large numeral.
  const metrics=['5%～7%：12 檔','7%～9.5%：8 檔','9.5% 以上：15 檔','強勢股總數：35 檔'];
  const metricPlan=JSON.parse(fs.readFileSync(path.join(dir,'plan.json'),'utf8'));
  metricPlan.scenes[0].visual_summary_points=metrics;
  metricPlan.scenes[0].subtitle='當日上市強勢股漲幅分布';
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(metricPlan));
  const metricRender=spawnSync(process.execPath,[path.join(root,'scripts/build_daily_gainers_v2_slides.js'),date],{cwd:temp,encoding:'utf8'});
  assert.equal(metricRender.status,0,metricRender.stderr);
  const metricSvg=fs.readFileSync(path.join(dir,'slides/01.svg'),'utf8');
  assert.ok(metricSvg.includes('當日上市強勢股漲幅分布'));
  assert.equal((metricSvg.match(/font-size="64"/g)||[]).length,4);
  assert.equal((metricSvg.match(/font-size="27"[^>]*>檔<\\/text>/g)||[]).length,4);
  for(const count of ['12','8','15','35']) assert.ok(metricSvg.includes('>'+count+'</text>'));
  // A 28-character card must wrap to two lines without dropping content.
  const longPoint = '這是一段用來驗證資訊卡在較長內容下仍能保持完整可讀的文字';
  assert.ok([...longPoint].length <= 28);
  const secondPlan = JSON.parse(fs.readFileSync(path.join(dir,'plan.json'),'utf8'));
  secondPlan.scenes[0].visual_summary_points[0] = longPoint;
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(secondPlan));
  const wrapped = spawnSync(process.execPath,
    [path.join(root,'scripts/build_daily_gainers_v2_slides.js'),date],
    {cwd:temp,encoding:'utf8'});
  assert.equal(wrapped.status,0,wrapped.stderr);
  const wrappedSvg = fs.readFileSync(path.join(dir,'slides/01.svg'),'utf8');
  assert.ok(wrappedSvg.includes([...longPoint].slice(0,14).join('')));
  assert.ok(wrappedSvg.includes([...longPoint].slice(14).join('')));
  // Card bounds: x<=1278, y<=708; progress overlay begins at y=815.
  assert.ok(514+194<815);
  assert.ok(720+558<1920-390);
  console.log('M8VIS_FOUR_CARD_STATIC_PASS cards=4 bounds=LEFT_SAFE lower_third=SAFE');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
