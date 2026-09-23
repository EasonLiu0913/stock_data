'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ARTIFACT_ID = 'institutional-accumulation-catalyst-five-window-event-intelligence-v1';
const METHODOLOGY_ID = 'institutional-accumulation-catalyst-five-window-event-intelligence-methodology-v1';
const OBSERVATION_PATH = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const OUTPUT_PATH = 'data_research/institutional-flow/institutional-accumulation-catalyst-five-window-event-intelligence-v1.json';
const EXPECTED_OBSERVATION_BLOB = 'e713de686951dbb7eba1bb9cd4e8a96ba62cfe68';
const EXPECTED_STOCKS = ['1102', '1104', '1216'];
const SNAPSHOT_ROOT = 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/';

const FROZEN_BLOBS = {
  'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json': 'cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00',
  'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-cross-day-audit-v1.json': '9dbee14b300980fb46ea7251b5707429071a80bf',
  'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-fourth-window-longitudinal-audit-v1.json': '31c13856af41fee4f277103807b081873dd780e1',
  'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-fifth-window-longitudinal-audit-v1.json': 'd3ae72fea05ace0815b9c7d22931a19a7fb32fdd',
  'data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json': '7ccafbe36206770d93f454feefdca81a082d4cd0',
};

const FEATURE_KEYS = [
  'has_numeric_content','has_percentage','has_currency','has_yoy_or_qoq_language',
  'mentions_revenue','mentions_profit_or_eps','mentions_capacity_or_production',
  'mentions_order_or_customer','mentions_price_or_asp','mentions_guidance_or_outlook',
  'mentions_suspension_or_shutdown','mentions_acquisition_or_disposal','text_length',
];

const TAXONOMY_RULES = [
  ['investor_conference', /法人說明會|法說|投資人說明會/iu],
  ['financial_report', /財務報告|財報/iu],
  ['dividend_distribution', /盈餘分派|股利|除息|配息/iu],
  ['capital_financing', /公司債|增資|減資|發行新股|私募/iu],
  ['asset_transaction', /(取得|處分|購置|出售).*(不動產|土地|建築物|資產|有價證券|理財產品)/iu],
  ['management_governance', /董事|總經理|董事長|委員會|股東會|公司治理/iu],
  ['operations_safety', /停工|停產|復工|職業災害|工安|生產調度/iu],
  ['legal_regulatory', /裁罰|訴訟|違反|主管機關|行政處分/iu],
  ['investment_mna', /併購|收購|股份交換|投資事業|組織架構調整/iu],
  ['revenue_business_outlook', /營收|收入|展望|訂單|客戶|產能|稼動率|量產|ASP|售價|財測/iu],
];

const METHODOLOGY_SPEC = {
  input_scope: 'first_five_canonical_prospective_pit_windows_only',
  canonical_event_identity: 'companyId|marketKind|enterDate|serialNumber',
  first_seen_semantics: 'first_checked_in_collection_timestamp_observing_identity',
  last_seen_semantics: 'last_checked_in_collection_timestamp_observing_identity',
  source_reported_time_never_backdates_pit: true,
  title_revision_semantics: 'normalized_listing_title_version_change_only',
  detail_revision_semantics: 'normalized_detail_semantic_content_change_only',
  feature_timing: {
    first_listing_features: 'title_at_first_listing_observation',
    first_detail_features: 'earliest_captured_detail_version_at_its_own_collection_time',
  },
  taxonomy_order: TAXONOMY_RULES.map(([name]) => name),
  feature_keys: FEATURE_KEYS,
  outcomes_authorized: false,
  network_authorized: false,
};

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function gitBlobSha(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function parseRocDateTime(dateValue, timeValue) {
  const date = normalizeText(dateValue), time = normalizeText(timeValue);
  const m = date.match(/^(\d{3})\/(\d{2})\/(\d{2})$/), t = time.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m || !t) throw new Error(`invalid_roc_datetime:${date}:${time}`);
  const year=Number(m[1])+1911, month=Number(m[2]), day=Number(m[3]), hour=Number(t[1]), minute=Number(t[2]), second=Number(t[3]);
  const d=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day||d.getUTCHours()!==hour||d.getUTCMinutes()!==minute||d.getUTCSeconds()!==second) throw new Error(`invalid_roc_datetime_value:${date}:${time}`);
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}+08:00`;
}
function canonicalEventIdentity(companyId, marketKind, enterDate, serialNumber) {
  const parts=[companyId,marketKind,enterDate,serialNumber].map(v=>normalizeText(v));
  if(!/^\d{4}$/.test(parts[0])||!/^[a-z]+$/i.test(parts[1])||!/^\d{7}$/.test(parts[2])||!/^\d+$/.test(parts[3])) throw new Error(`invalid_event_identity:${parts.join('|')}`);
  return parts.join('|');
}
function eventIdentityFromListingRow(row, expectedStock) {
  if(!Array.isArray(row)||row.length<6) throw new Error('invalid_listing_row');
  const action=row[5];
  if(!action||action.apiName!=='t05st01_detail'||!action.parameters) throw new Error('listing_detail_parameters_missing');
  const p=action.parameters;
  if(String(row[0])!==String(expectedStock)||String(p.companyId)!==String(expectedStock)) throw new Error('listing_stock_mismatch');
  return canonicalEventIdentity(p.companyId,p.marketKind,p.enterDate,p.serialNumber);
}
function detailIdentityFromRequestKey(key) {
  const parts=String(key||'').split('|');
  if(parts.length!==4) throw new Error(`invalid_detail_request_key:${key}`);
  return canonicalEventIdentity(parts[0],parts[3],parts[1],parts[2]);
}
function textFeatures(text) {
  const value=normalizeText(text);
  return {
    has_numeric_content:/\d/u.test(value),
    has_percentage:/[%％]/u.test(value),
    has_currency:/新台幣|美元|人民幣|港幣|日圓|元|千元|百萬元|億元/iu.test(value),
    has_yoy_or_qoq_language:/年增|月增|季增|年減|月減|季減|YoY|QoQ|同比|環比/iu.test(value),
    mentions_revenue:/營收|收入/iu.test(value),
    mentions_profit_or_eps:/獲利|淨利|盈餘|EPS|每股盈餘/iu.test(value),
    mentions_capacity_or_production:/產能|產量|生產|稼動率|量產/iu.test(value),
    mentions_order_or_customer:/訂單|客戶|接單/iu.test(value),
    mentions_price_or_asp:/售價|價格|ASP/iu.test(value),
    mentions_guidance_or_outlook:/展望|預估|預期|財測|guidance/iu.test(value),
    mentions_suspension_or_shutdown:/停工|停產|復工/iu.test(value),
    mentions_acquisition_or_disposal:/(取得|處分|購置|出售|收購|併購).*(不動產|土地|建築物|資產|有價證券|理財產品)/iu.test(value),
    text_length:[...value].length,
  };
}
function classifyTaxonomy(text) {
  const value=normalizeText(text);
  const labels=TAXONOMY_RULES.filter(([,re])=>re.test(value)).map(([name])=>name);
  return labels.length?labels:['other'];
}
function decodeSnapshot(snapshot, sourcePath) {
  if(snapshot.pit_known_at!==snapshot.collected_at) throw new Error(`snapshot_pit_mismatch:${sourcePath}`);
  if(snapshot.historical_back_imputation_allowed!==false) throw new Error(`snapshot_back_imputation_unsafe:${sourcePath}`);
  const encoded=snapshot.raw_response_base64;
  if(typeof encoded!=='string'||!encoded.length) throw new Error(`snapshot_raw_missing:${sourcePath}`);
  const raw=Buffer.from(encoded,'base64');
  if(raw.toString('base64')!==encoded) throw new Error(`snapshot_base64_noncanonical:${sourcePath}`);
  if(raw.length!==snapshot.response_bytes) throw new Error(`snapshot_response_bytes_mismatch:${sourcePath}`);
  if(sha256(raw)!==snapshot.response_sha256) throw new Error(`snapshot_response_hash_mismatch:${sourcePath}`);
  let payload; try{payload=JSON.parse(raw.toString('utf8'));}catch(error){throw new Error(`snapshot_raw_json_invalid:${sourcePath}:${error.message}`);}
  if(payload.code!==200||payload.message!=='查詢成功'||!payload.result) throw new Error(`source_response_not_success:${sourcePath}`);
  return payload;
}
function parseListingPayload(payload,snapshot,stock,windowIndex) {
  if(!Array.isArray(payload.result.data)) throw new Error(`listing_data_invalid:${stock}`);
  const companyAbbreviation=normalizeText(payload.result.companyAbbreviation||'');
  return payload.result.data.map(row=>{
    const identity=eventIdentityFromListingRow(row,stock), p=row[5].parameters, title=normalizeText(row[4]);
    if(!title) throw new Error(`listing_title_empty:${identity}`);
    return {event_identity:identity,stock:String(stock),company_abbreviation:companyAbbreviation||normalizeText(row[1]),market_kind:normalizeText(p.marketKind),enter_date_roc:normalizeText(p.enterDate),serial_number:normalizeText(p.serialNumber),source_reported_at:parseRocDateTime(row[2],row[3]),title,collected_at:snapshot.collected_at,window:windowIndex,snapshot_id:snapshot.immutable_snapshot_id};
  });
}
function parseDetailPayload(payload,snapshot) {
  const identity=detailIdentityFromRequestKey(snapshot.source_request_key), rows=payload.result.data;
  if(!Array.isArray(rows)||rows.length!==1||!Array.isArray(rows[0])||rows[0].length<10) throw new Error(`detail_data_invalid:${identity}`);
  const row=rows[0], subject=normalizeText(row[6]), clause=normalizeText(row[7]), factDateRoc=normalizeText(row[8]), explanation=normalizeText(row[9]);
  if(!subject||!clause||!factDateRoc||!explanation) throw new Error(`detail_required_field_missing:${identity}`);
  const semantic={subject,clause,fact_date_roc:factDateRoc,explanation};
  return {event_identity:identity,stock:String(snapshot.source_request_key).split('|')[0],collected_at:snapshot.collected_at,snapshot_id:snapshot.immutable_snapshot_id,raw_response_sha256:snapshot.response_sha256,source_reported_at:parseRocDateTime(row[1],row[2]),semantic,semantic_sha256:sha256(JSON.stringify(semantic))};
}
function summarizeVersions(items,valueKey) {
  const map=new Map();
  for(const item of [...items].sort((a,b)=>a.collected_at.localeCompare(b.collected_at)||(a.window||0)-(b.window||0))){
    const value=item[valueKey], key=typeof value==='string'?value:JSON.stringify(value);
    if(!map.has(key)) map.set(key,{value,first_seen_at:item.collected_at,last_seen_at:item.collected_at,windows:[]});
    const v=map.get(key); v.last_seen_at=item.collected_at;
    if(Number.isInteger(item.window)&&!v.windows.includes(item.window)) v.windows.push(item.window);
  }
  return [...map.values()].map(v=>({...v,windows:v.windows.sort((a,b)=>a-b)}));
}
function buildArtifact(repoRoot) {
  const observationBytes=fs.readFileSync(path.join(repoRoot,...OBSERVATION_PATH.split('/')));
  const observationBlob=gitBlobSha(observationBytes);
  if(observationBlob!==EXPECTED_OBSERVATION_BLOB) throw new Error(`observation_blob_mismatch:${observationBlob}`);
  const audit=JSON.parse(observationBytes.toString('utf8'));
  if(audit.valid_observation_count!==30||audit.invalid_observation_count!==0||audit.conflict_count!==0||audit.stock_count!==3||audit.unique_immutable_snapshot_count!==30) throw new Error('canonical_observation_shape_mismatch');
  for(const stock of EXPECTED_STOCKS){const s=audit.stocks[stock];if(!s||s.total!==10||s.listing!==5||s.detail!==5) throw new Error(`canonical_stock_shape_mismatch:${stock}`);}
  for(const [rel,expected] of Object.entries(FROZEN_BLOBS)){const actual=gitBlobSha(fs.readFileSync(path.join(repoRoot,...rel.split('/'))));if(actual!==expected) throw new Error(`frozen_blob_mismatch:${rel}:${actual}`);}

  const snapshots=audit.source_paths.map(sourcePath=>{
    if(!sourcePath.startsWith(SNAPSHOT_ROOT)) throw new Error(`unexpected_snapshot_path:${sourcePath}`);
    const snapshot=JSON.parse(fs.readFileSync(path.join(repoRoot,...sourcePath.split('/')),'utf8'));
    return {snapshot,payload:decodeSnapshot(snapshot,sourcePath)};
  });
  const listingByStock=new Map(EXPECTED_STOCKS.map(s=>[s,[]])), detailRecords=[];
  for(const item of snapshots){const stock=String(item.snapshot.source_request_key||'').split('|')[0];if(!EXPECTED_STOCKS.includes(stock)) throw new Error(`unexpected_stock:${stock}`);if(item.snapshot.source_interface==='prospective_material_information_listing') listingByStock.get(stock).push(item);else if(item.snapshot.source_interface==='prospective_material_information_detail') detailRecords.push(item);else throw new Error(`unexpected_source_interface:${item.snapshot.source_interface}`);}
  const listingOccurrences=[];
  for(const stock of EXPECTED_STOCKS){const windows=listingByStock.get(stock).sort((a,b)=>a.snapshot.collected_at.localeCompare(b.snapshot.collected_at));if(windows.length!==5) throw new Error(`listing_window_count_mismatch:${stock}`);windows.forEach((item,idx)=>listingOccurrences.push(...parseListingPayload(item.payload,item.snapshot,stock,idx+1)));}
  const eventsMap=new Map();
  for(const o of listingOccurrences){if(!eventsMap.has(o.event_identity)) eventsMap.set(o.event_identity,[]);eventsMap.get(o.event_identity).push(o);}
  const detailsMap=new Map();
  for(const item of detailRecords){const d=parseDetailPayload(item.payload,item.snapshot);if(!eventsMap.has(d.event_identity)) throw new Error(`detail_without_listing_identity:${d.event_identity}`);if(!detailsMap.has(d.event_identity)) detailsMap.set(d.event_identity,[]);detailsMap.get(d.event_identity).push(d);}
  const events=[];
  for(const [identity,rawOccurrences] of eventsMap){
    const occ=rawOccurrences.sort((a,b)=>a.collected_at.localeCompare(b.collected_at)||a.window-b.window), first=occ[0], last=occ.at(-1), windows=[...new Set(occ.map(x=>x.window))].sort((a,b)=>a-b);
    const titleVersions=summarizeVersions(occ,'title').map(v=>({title:v.value,first_seen_at:v.first_seen_at,last_seen_at:v.last_seen_at,windows:v.windows}));
    const details=(detailsMap.get(identity)||[]).sort((a,b)=>a.collected_at.localeCompare(b.collected_at));
    const semanticVersions=summarizeVersions(details.map(d=>({...d,window:null})),'semantic_sha256').map(v=>{const matches=details.filter(d=>d.semantic_sha256===v.value),fd=matches[0];return {semantic_sha256:v.value,first_seen_at:v.first_seen_at,last_seen_at:v.last_seen_at,subject:fd.semantic.subject,clause:fd.semantic.clause,fact_date_roc:fd.semantic.fact_date_roc,explanation:fd.semantic.explanation,source_reported_at:fd.source_reported_at,snapshot_ids:matches.map(d=>d.snapshot_id).sort(),raw_response_sha256s:[...new Set(matches.map(d=>d.raw_response_sha256))].sort()};});
    const fd=details[0]||null, fdText=fd?`${fd.semantic.subject} ${fd.semantic.explanation}`:'';
    events.push({event_identity:identity,stock:first.stock,company_abbreviation:first.company_abbreviation,market_kind:first.market_kind,enter_date_roc:first.enter_date_roc,serial_number:first.serial_number,first_seen_at:first.collected_at,last_seen_at:last.collected_at,first_seen_window:first.window,last_seen_window:last.window,first_seen_is_left_censored:first.window===1,source_reported_at_first_observed:first.source_reported_at,listing_presence_windows:windows,listing_window_count:windows.length,listing_snapshot_ids:[...new Set(occ.map(x=>x.snapshot_id))].sort(),listing_title_version_count:titleVersions.length,listing_title_revision_detected:titleVersions.length>1,listing_title_versions:titleVersions,first_listing_taxonomy:classifyTaxonomy(first.title),first_listing_features:textFeatures(first.title),detail:fd?{captured:true,first_seen_at:fd.collected_at,last_seen_at:details.at(-1).collected_at,version_count:semanticVersions.length,revision_detected:semanticVersions.length>1,first_version_semantic_sha256:fd.semantic_sha256,first_version_taxonomy:classifyTaxonomy(fdText),first_version_features:textFeatures(fdText),versions:semanticVersions}:{captured:false,first_seen_at:null,last_seen_at:null,version_count:0,revision_detected:false,first_version_semantic_sha256:null,first_version_taxonomy:[],first_version_features:null,versions:[]}});
  }
  events.sort((a,b)=>a.event_identity.localeCompare(b.event_identity));
  const perStock={};
  for(const stock of EXPECTED_STOCKS){const es=events.filter(e=>e.stock===stock);perStock[stock]={event_count:es.length,prospectively_first_seen_count:es.filter(e=>!e.first_seen_is_left_censored).length,left_censored_count:es.filter(e=>e.first_seen_is_left_censored).length,listing_title_revision_count:es.filter(e=>e.listing_title_revision_detected).length,detail_captured_event_count:es.filter(e=>e.detail.captured).length,detail_revision_count:es.filter(e=>e.detail.revision_detected).length};}
  return {schema_version:1,artifact_id:ARTIFACT_ID,methodology_identity:METHODOLOGY_ID,methodology_sha256:sha256(JSON.stringify(METHODOLOGY_SPEC)),methodology:METHODOLOGY_SPEC,source_observation_audit:{path:OBSERVATION_PATH,git_blob_sha:observationBlob,valid_observation_count:audit.valid_observation_count,invalid_observation_count:audit.invalid_observation_count,conflict_count:audit.conflict_count,unique_immutable_snapshot_count:audit.unique_immutable_snapshot_count,collection_time_range:audit.collection_time_range},network_collection_used:false,outcomes_read:false,input_window_count:5,stock_count:3,event_count:events.length,per_stock:perStock,feature_schema:{keys:FEATURE_KEYS,listing_semantics:'first listing title only at first_seen_at',detail_semantics:'earliest captured detail semantic version only at detail.first_seen_at'},events,protected_state:{historical_identity_upgrade_performed:false,protected_2454_outcomes_read:false,development_outcomes_read:false,holdout_outcomes_read:false,catalyst_outcome_association_opened:false,withdrawal_used_as_input:false,price_or_return_data_read:false,broker_margin_or_post_event_institutional_labels_read:false,model_score_rank_strategy_production_opened:false},frozen_blob_assertions:FROZEN_BLOBS};
}
function serializeArtifact(a){return `${JSON.stringify(a,null,2)}\n`;}
function main(){const a=buildArtifact(process.cwd()),s=serializeArtifact(a);if(process.argv.includes('--write')){fs.writeFileSync(path.join(process.cwd(),...OUTPUT_PATH.split('/')),s);process.stdout.write(`${OUTPUT_PATH}\n`);}else process.stdout.write(s);}
if(require.main===module){try{main();}catch(error){console.error(error.stack||error.message);process.exitCode=1;}}
module.exports={ARTIFACT_ID,METHODOLOGY_ID,METHODOLOGY_SPEC,FEATURE_KEYS,TAXONOMY_RULES,normalizeText,sha256,gitBlobSha,parseRocDateTime,canonicalEventIdentity,eventIdentityFromListingRow,detailIdentityFromRequestKey,textFeatures,classifyTaxonomy,decodeSnapshot,parseListingPayload,parseDetailPayload,summarizeVersions,buildArtifact,serializeArtifact};
