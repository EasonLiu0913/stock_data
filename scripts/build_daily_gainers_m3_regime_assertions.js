'use strict';
const opening=require('../data_daily_gain_over_5/market-opening/20261008.json');
const review=require('../data_research/twse-market-opening/20261008-m2v2-final-materiality-finance-review.json');
const {verifyArchive}=require('./verify_daily_gainers_m2_primary_archive');
function build(o=opening,r=review,v=verifyArchive()){
 if(o.target_date!==r.date||r.date!==v.date)throw Error('STALE_OR_MISMATCHED_DATE');
 if(!v.raw_bytes_verified||!r.raw_bytes_sha_match||!r.raw_manifest_dates_verified)throw Error('SOURCE_INTEGRITY_UNVERIFIED');
 for(const k of ['bfi82u','fmtqik','bfiamu'])if(v.original_http_sha256[k]!==r.finance_raw_sha256[k])throw Error('SOURCE_SHA_MISMATCH:'+k);
 const b={advance:425,decline:540,unchanged:109,no_trade:3,no_comparison:5};
 const t=o.taiex,trade=o.market_trading;
 if(!Number.isFinite(t.change_points)||!Number.isFinite(t.change_pct)||!Number.isFinite(trade.turnover_twd)||!Number.isFinite(trade.turnover_ma5_twd)||trade.turnover_ma5_twd<=0||trade.turnover_twd!==924509097873||trade.turnover_ma5_twd!==v.prior_five_average_twd)throw Error('INVALID_INDEX_TURNOVER');
 if(Object.values(b).reduce((a,x)=>a+x,0)!==1082)throw Error('BREADTH_RECONCILIATION_FAILED');
 const assertions=[
 {id:'index',value:t.change_points,unit:'index_points',date:r.date,source:'market-opening/20261008.json:taiex',scope:'TAIEX_INDEX',quality:'DATE_PINNED_RESEARCH',text:t.change_points<0?'加權指數收低':t.change_points>0?'加權指數收高':'加權指數持平'},
 {id:'breadth',value:b,unit:'securities_count',date:r.date,source:'M1-v2 official MI_INDEX stock-column breadth',scope:'TWSE_OFFICIAL_AGGREGATE',quality:'ACCEPTED_M1_V2',text:'上漲425、下跌540、平盤109，另有未成交3、無比較5；不等同個股5%完整名單'},
 {id:'turnover',value:trade.turnover_twd,unit:'TWD',date:r.date,source:'FMTQIK:'+v.original_http_sha256.fmtqik,scope:v.market_scope,quality:'RAW_SHA_AND_DATE_RECONCILED_PUBLICATION_SCOPE_UNVERIFIED',text:'TWSE官方市場成交金額低於前五個交易日平均，不能解讀為普通股單獨成交額'},
 {id:'institutional',value:null,unit:'TWD',date:r.date,source:'BFI82U:'+v.original_http_sha256.bfi82u,scope:v.institutional_scope,quality:'PUBLICATION_SCOPE_UNVERIFIED',text:'三大法人金額僅限研究核對，不推論對手方或個股流向'},
 {id:'sector',value:null,unit:'TWD',date:r.date,source:'BFIAMU:'+v.original_http_sha256.bfiamu,scope:v.industry_scope,quality:'PUBLICATION_SCOPE_UNVERIFIED',text:'產業成交金額不是法人淨流入，分類有父子重疊，不加總'},
 {id:'gainers',value:r.official_observed_movers,unit:'observed_securities',date:r.date,source:'M2-v2 source-backed archive '+r.source_head_sha,scope:'OBSERVED_NONCOMPLETE',quality:'BOUNDED',text:'觀察到35檔達5%標的，不能宣稱為全部上市普通股'}
 ];
 const directional=t.change_points<0&&b.decline>b.advance?'INDEX_DOWN_AND_BREADTH_WEAKER':t.change_points>0&&b.advance>b.decline?'INDEX_UP_AND_BREADTH_STRONGER':'INDEX_BREADTH_DIVERGENCE_OR_MIXED';
 return {date:r.date,contract:'M3-MARKET-REGIME-PHRASING-v1',phase:'M3',status:'partial',regime:directional,
 evidence:assertions,allowed_interpretation:directional==='INDEX_DOWN_AND_BREADTH_WEAKER'?'指數收低，官方廣度下跌家數多於上漲家數；僅描述當日現象，不宣稱趨勢反轉或資金出逃':'指數與廣度可能不同向，僅描述各自事實，勿以單一指標宣稱全面多空',
 forbidden_claims:['產業成交金額代表法人買超','外資賣給散戶','當日下跌證明趨勢反轉','35檔等於全部普通股漲幅5%股票','財經來源已取得正式發布授權'],
 limitations:['財經來源scopeVerified=false：原始資料日期與SHA核對不等於發布口徑認證','6672已知處置；另四檔處置未知，暫停交易狀態未知','M1市場廣度與M2觀察標的口徑不得混用'],publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false};
}
if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={build};
