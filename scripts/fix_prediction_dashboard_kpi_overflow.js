const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../public/prediction-dashboard.html');
let html = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    before: '.kpi-card{appearance:none;text-align:left;cursor:pointer;width:100%;font:inherit;color:inherit}.kpi-card:hover',
    after: '.kpi-card{appearance:none;text-align:left;cursor:pointer;width:100%;font:inherit;color:inherit;overflow:hidden}.kpi-card>*{min-width:0;max-width:100%}.kpi-card:hover'
  },
  {
    before: '.label{font-size:12px;color:#697789;font-weight:800}.value{font-size:clamp(22px,4.8vw,28px);font-weight:900;margin-top:5px;line-height:1.1}.sub{font-size:13px;color:#697789;margin-top:4px;line-height:1.35}',
    after: '.label{font-size:12px;color:#697789;font-weight:800;overflow-wrap:anywhere;word-break:break-word}.value{font-size:clamp(18px,2vw,28px);font-weight:900;margin-top:5px;line-height:1.1;overflow-wrap:anywhere;word-break:break-word;font-variant-numeric:tabular-nums}.sub{font-size:13px;color:#697789;margin-top:4px;line-height:1.35;overflow-wrap:anywhere;word-break:break-word}'
  },
  {
    before: '@media(max-width:640px){.shell{padding:14px}.title{font-size:24px}.kpis{grid-template-columns:1fr 1fr;gap:10px}.card{padding:12px}.controls',
    after: '@media(max-width:640px){.shell{padding:14px}.title{font-size:24px}.kpis{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.card{padding:12px}.kpi-card .value{font-size:clamp(17px,5vw,21px)}.kpi-card .label{line-height:1.3}.kpi-card .sub{font-size:12px}.controls'
  }
];

let changed = false;
for (const { before, after } of replacements) {
  if (html.includes(after)) continue;
  if (!html.includes(before)) {
    throw new Error(`Expected CSS pattern not found: ${before.slice(0, 90)}...`);
  }
  html = html.replace(before, after);
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, html, 'utf8');
  console.log('Updated KPI card overflow styles.');
} else {
  console.log('KPI card overflow styles are already up to date.');
}
