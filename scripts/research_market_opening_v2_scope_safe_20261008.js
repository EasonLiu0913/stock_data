'use strict';
// v2 research-only market context. Official MI_INDEX 股票 column is NOT an
// independently certified historical ordinary-share universe.
const assert=require('node:assert/strict');
function project(master){
 assert.equal(master.target_date,'20261008');
 assert.equal(master.market,'TWSE');
 assert.equal(master.breadth.scope,'TWSE_OFFICIAL_STOCK_COLUMN');
 assert.equal(master.breadth.verified_twse_common_stock_only,false);
 const b=master.breadth,t=master.market_trading,i=master.institutional;
 assert.equal(b.rising_count+b.falling_count+b.unchanged_count+b.no_trade_count+b.no_comparison_count,b.denominator);
 assert.ok(Number.isFinite(t.turnover_twd)&&t.turnover_twd>0);
 assert.ok(Number.isFinite(t.turnover_ma5_twd)&&t.turnover_ma5_twd>0);
 assert.equal(t.turnover_ma5_definition,'previous 5 TWSE trading days (excluding target)');
 for(const n of ['foreign','investment_trust','dealers']){
  assert.equal(i[n].buy_twd-i[n].sell_twd,i[n].net_twd);
 }
 assert.equal(i.foreign.net_twd+i.investment_trust.net_twd+i.dealers.net_twd,i.total.net_twd);
 const scope='證交所官方 MI_INDEX「股票」欄（非逐檔認證普通股母體）';
 const data={date:master.target_date,scope,rising_count:b.rising_count,falling_count:b.falling_count,unchanged_count:b.unchanged_count,limit_up_count:b.limit_up_count,denominator:b.denominator,turnover_twd:t.turnover_twd,turnover_ma5_twd:t.turnover_ma5_twd,turnover_ratio_ma5:t.turnover_twd/t.turnover_ma5_twd,foreign_net_twd:i.foreign.net_twd,trust_net_twd:i.investment_trust.net_twd,dealer_net_twd:i.dealers.net_twd,assessment:master.market_regime.assessment};
 const lines=['今日市場廣度採用'+scope+'：上漲'+b.rising_count+'家、下跌'+b.falling_count+'家、平盤'+b.unchanged_count+'家，其中漲停'+b.limit_up_count+'家。','當日市場成交金額'+t.turnover_twd+'元，前五個交易日平均'+t.turnover_ma5_twd+'元。','外資淨額'+i.foreign.net_twd+'元、投信'+i.investment_trust.net_twd+'元、自營商'+i.dealers.net_twd+'元。'];
 const result={status:'V2_RESEARCH_MARKET_CONTEXT',publication_authorized:false,tts_authorized:false,render_authorized:false,editorial_complete:false,market_context:data,narration_lines:lines,caption_lines:[...lines],card_snapshot:structuredClone(data),required_market_claims_verified:true,featured_stock_catalyst_claims_verified:false};
 assert.deepEqual(result.narration_lines,result.caption_lines);
 assert.deepEqual(result.market_context,result.card_snapshot);
 return result;
}
module.exports={project};
