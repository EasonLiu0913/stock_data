'use strict';
// Research-only pure decision contract. No filesystem, dispatch, render or upload side effects.
const DATE=/^20\d{6}$/;
function decide(x){
 const {inputDate='',expectedDate,scriptDates=[],sourceReady=false,scriptValid=false,previewAuthorized=false,uploadAuthorized=false,artifactComplete=false,artifactDate=null,receiptExists=false,historicalAuthorized=false}=x;
 if(!DATE.test(expectedDate||''))return {state:'BLOCK',reason:'EXPECTED_DATE_UNPROVEN'};
 if(inputDate && !DATE.test(inputDate))return {state:'BLOCK',reason:'INVALID_INPUT_DATE'};
 if(inputDate && inputDate!==expectedDate && !historicalAuthorized)return {state:'BLOCK',reason:'HISTORICAL_DATE_NOT_AUTHORIZED'};
 const date=inputDate||expectedDate;
 if(!scriptDates.includes(date))return {state:'BLOCK',reason:'TARGET_DATE_SCRIPT_MISSING',date};
 if(!sourceReady)return {state:'BLOCK',reason:'TARGET_DATE_SOURCES_INCOMPLETE',date};
 if(!scriptValid)return {state:'BLOCK',reason:'TARGET_DATE_SCRIPT_INVALID',date};
 if(receiptExists)return {state:'NOOP',reason:'ALREADY_UPLOADED',date};
 if(artifactComplete && artifactDate!==date)return {state:'BLOCK',reason:'ARTIFACT_DATE_MISMATCH',date};
 if(artifactComplete)return uploadAuthorized?{state:'RETRY_UPLOAD',date}:{state:'HOLD_ARTIFACT',reason:'UPLOAD_NOT_AUTHORIZED',date};
 if(previewAuthorized)return {state:'RENDER_PREVIEW_ONLY',date};
 return {state:'BLOCK',reason:'PREVIEW_NOT_AUTHORIZED',date};
}
module.exports={decide};
