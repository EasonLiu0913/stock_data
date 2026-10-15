#!/usr/bin/env node
'use strict';
// Research-only parser. Official MI_INDEX "股票" is not independently verified
// as the as-of TWSE ordinary-stock universe. Never silently promote it.
const fs = require('node:fs');
function parse(raw, targetDate) {
  if (!raw || raw.stat !== 'OK' || raw.date !== targetDate || raw.type !== 'ALL' || !Array.isArray(raw.tables)) throw Error('SOURCE_DATE_STATUS_SCOPE_INVALID');
  const matches = raw.tables.filter(t => t.title === '漲跌證券數合計');
  if (matches.length !== 1) throw Error('BREADTH_TABLE_MISSING_OR_DUPLICATE');
  const t = matches[0];
  if (JSON.stringify(t.fields) !== JSON.stringify(['類型','整體市場','股票']) || !Array.isArray(t.data) || t.data.length !== 5) throw Error('BREADTH_SCHEMA_INVALID');
  const names = ['上漲(漲停)','下跌(跌停)','持平','未成交','無比價'];
  const n = x => { if (typeof x !== 'string' || !/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(x)) throw Error('BREADTH_NUMBER_INVALID'); return Number(x.replace(/,/g,'')); };
  const rows = t.data.map((row,i) => {
    if (!Array.isArray(row) || row.length !== 3 || row[0] !== names[i]) throw Error('BREADTH_ROW_INVALID');
    if (i < 2) { const m = /^([\d,]+)\(([\d,]+)\)$/.exec(row[2]); if (!m) throw Error('BREADTH_LIMIT_FORMAT_INVALID'); const count=n(m[1]), limit=n(m[2]); if (limit>count) throw Error('BREADTH_LIMIT_EXCEEDS_COUNT'); return {count,limit}; }
    return {count:n(row[2])};
  });
  const [up,down,flat,untraded,noComparison]=rows;
  const total=rows.reduce((sum,r)=>sum+r.count,0);
  if (!total) throw Error('BREADTH_EMPTY');
  return {source:'TWSE MI_INDEX',source_date:targetDate,source_table:t.title,source_column:'股票',scope:'TWSE_OFFICIAL_STOCK_COLUMN_NOT_YET_ORDINARY_STOCK_VERIFIED',up:up.count,limit_up:up.limit,down:down.count,limit_down:down.limit,flat:flat.count,untraded:untraded.count,no_comparison:noComparison.count,denominator_including_untraded_and_no_comparison:total,ordinary_stock_identity_verified:false,editorial_complete:false};
}
if (require.main === module) { try {const out=parse(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),process.argv[3]); process.stdout.write(JSON.stringify(out,null,2)+'\n');} catch(e) {console.error(e.message);process.exitCode=1;} }
module.exports={parse};
