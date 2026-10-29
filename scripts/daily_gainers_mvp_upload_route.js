'use strict';
const fs = require('node:fs');
const {decide} = require('./daily_gainers_mvp_upload_decision');

// Read-only route resolver: printing a decision never dispatches an upload.
// A receipt must be supplied from trusted durable state by the caller.
// Absence is *not* verified by a missing file.
function resolveRoute({receiptPath, expectedDate, authorized = false, verifiedAbsence = false}) {
  let receipt = null;
  if (receiptPath) {
    if (!fs.existsSync(receiptPath)) return {action:'blocked',reason:'receipt_unavailable_or_unverified'};
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    } catch {
      return {action:'blocked',reason:'receipt_parse_failed'};
    }
  }
  if (receipt && expectedDate && receipt.target_date !== expectedDate) return {action:'blocked',reason:'receipt_date_mismatch'};
  return decide({receipt,authorized,verifiedAbsence});
}
if(require.main === module){
  const receiptPath=process.env.MVP_UPLOAD_RECEIPT_FILE || '';
  const authorized=process.env.YOUTUBE_UPLOAD_AUTHORIZED === 'private-pilot';
  // Explicitly omit verifiedAbsence from CLI to prevent unsafe first-upload dispatch.
  const result=resolveRoute({receiptPath,expectedDate:process.env.MVP_TARGET_DATE || undefined,authorized,verifiedAbsence:false});
  console.log(JSON.stringify(result));
  if(result.action==='blocked') process.exitCode=2;
}
module.exports={resolveRoute};
