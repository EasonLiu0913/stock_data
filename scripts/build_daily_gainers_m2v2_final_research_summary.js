'use strict';
const fs=require('node:fs'),path=require('node:path');
const {run}=require('./build_daily_gainers_m2v2_source_backed_core');
const BASE=path.resolve(__dirname,'..');
const reviewPath=path.join(BASE,'data_research/twse-market-opening/20261008-m2v2-final-materiality-finance-review.json');
function assemble(core,review){
 if(core.date!==review.date||core.contract!==review.contract)throw Error('CONTRACT_DATE_MISMATCH');
 const expected=review.top_five_codes;
 if(core.candidates.length!==expected.length||expected.some((c,i)=>core.candidates[i].code!==c))throw Error('SELECTED_CANDIDATES_MISMATCH');
 if(core.eligible_count!==review.source_backed_top_five_core_eligible||core.source_verified_quotes!==expected.length)throw Error('CORE_RESULT_MISMATCH');
 if(!review.raw_bytes_sha_match||!review.raw_manifest_dates_verified||review.observed_vs_mi_index_matched!==review.official_observed_movers)throw Error('SOURCE_REVIEW_INCOMPLETE');
 if(review.category_breakdown.Stock+review.category_breakdown.InnovationBoard+review.category_breakdown.TDR!==review.official_observed_movers)throw Error('CATEGORY_RECONCILIATION_FAILED');
 if(review.finance_source_scope_verified_for_publication!==false||core.publication_authorized!==false)throw Error('PUBLICATION_SCOPE_MISMATCH');
 const dispositions=Object.fromEntries(core.candidates.map(c=>[c.code,c.risk.disposition]));
 if(dispositions['6672']!=='KNOWN_ACTIVE'||expected.filter(c=>c!=='6672').some(c=>dispositions[c]!=='UNKNOWN'))throw Error('RISK_REVIEW_MISMATCH');
 return {date:core.date,contract:core.contract,source_run_id:review.source_run_id,source_artifact_id:review.source_artifact_id,
  source_head_sha:review.source_head_sha,finance_raw_sha256:review.finance_raw_sha256,
  finance_scope:'DATE_AND_BYTES_RECONCILED; PUBLICATION_SCOPE_NOT_CERTIFIED',
  observed_candidates:review.official_observed_movers,category_breakdown:review.category_breakdown,
  selected_basis:review.chosen_selection_basis,selected_core_eligible:core.eligible_count,
  selection:core.candidates.map(c=>({code:c.code,name:c.name,core_eligible:c.core_eligible,risk:c.risk,risk_disclosure_required:c.risk_disclosure_required})),
  materiality:{top_five_turnover_twd:review.top_five_turnover_twd,observed_stock_turnover_twd:review.all_observed_stock_turnover_twd,
   next_editorial_alternative:review.next_material_stock,external_recall_comparison:'NOT_AVAILABLE',full_universe_claim:false},
  superseded_legacy_facts:'Prior historic-master featured_certified_count=0 is retained separately and is NOT a current ES core verdict',
  research_status:'SOURCE_BACKED_PARTIAL_NONPUBLICATION',publication_authorized:false,
  prompt_a_complete:false,prompt_b_eligible:false};
}
if(require.main===module){const review=JSON.parse(fs.readFileSync(reviewPath));console.log(JSON.stringify(assemble(run(),review),null,2));}
module.exports={assemble};
