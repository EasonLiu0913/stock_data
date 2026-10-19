'use strict';
// Research-only dated MI_INDEX repository-payload provenance; not an original HTTP archive certificate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parse}=require('./parse_twse_official_stock_aggregate');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspect(root,date){
 if(!/^20\d{6}$/.test(date||'')||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 const rel='data_twse_mi_index/'+date+'_twse_mi_index.json',file=path.join(root,rel);
 const result={contract:'MI_INDEX_DATED_REPOSITORY_PROVENANCE_V1',target_date:date,source_path:rel,status:'WAITING_SOURCE',raw_http_provenance_certified:false,ordinary_share_identity_certified:false,master_authorized:false,publication_authorized:false};
 if(!fs.existsSync(file))return result;
 try{
  const bytes=fs.readFileSync(file),parsed=parse(JSON.parse(bytes),date);
  return {...result,status:'DATED_REPOSITORY_PAYLOAD_SCHEMA_VERIFIED_RAW_HTTP_PROVENANCE_PENDING',repository_payload_sha256:sha(bytes),repository_payload_bytes:bytes.length,observations:parsed};
 }catch(e){return {...result,status:'REJECTED',reason:e.message};}
}
if(require.main===module){try{console.log(JSON.stringify(inspect(process.argv[3]||'.',process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={inspect};
