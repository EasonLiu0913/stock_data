#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {createClient}=require('@libsql/client');
const LEDGER_TABLE='turso_live_shadow_evidence_v1';
const EVENT_TABLE='turso_live_shadow_events_v1';
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
async function main(){
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN) throw Error('MISSING_TURSO_SECRETS');
 const [ledger,events]=await Promise.all([
  db.execute('SELECT trade_date,source_sha256,row_count,contract_hash,instrument_summary_json,accepted_at FROM '+LEDGER_TABLE+' ORDER BY trade_date'),
  db.execute('SELECT trade_date,classification,detail,recorded_at FROM '+EVENT_TABLE+' ORDER BY recorded_at')
 ]);
 const accepted=ledger.rows.map(r=>({trade_date:String(r.trade_date),source_sha256:String(r.source_sha256),row_count:Number(r.row_count),contract_hash:String(r.contract_hash),instrument_type_coverage:JSON.parse(String(r.instrument_summary_json)),accepted_at:String(r.accepted_at)}));
 const report={schema:'turso_phase11_live_shadow_status_v1',accepted_count:accepted.length,remaining_to_20:Math.max(0,20-accepted.length),complete:accepted.length>=20,state:accepted.length>=20?'COMPLETE':'WAITING_ACTIVE_EVIDENCE',accepted_dates:accepted.map(x=>x.trade_date),accepted,evidence_events:events.rows.map(r=>({trade_date:String(r.trade_date),classification:String(r.classification),detail:String(r.detail),recorded_at:String(r.recorded_at)})),rules:{authorization_date:'20261006',preauthorization_dates_count:false,duplicate_dates_count_once:true,missing_canonical_counts:false,non_trading_day_counts:false,parity_failure_counts:false,database_unavailable_counts:false,canonical_source_of_truth:true}};
 fs.writeFileSync('/tmp/turso-phase11-live-shadow-status.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE11] LIVE_STATUS '+JSON.stringify({accepted:report.accepted_count,remaining:report.remaining_to_20,state:report.state,dates:report.accepted_dates}));
}
main().catch(e=>{console.error('[TURSO-PHASE11] LIVE_STATUS_FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
