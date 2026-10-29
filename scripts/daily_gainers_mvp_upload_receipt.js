'use strict';
// Prepare a durable, immutable upload checkpoint for GitHub Contents.
// This script performs NO network operations. The caller must commit the output
// into an approved durable branch before doing captions; it must not overwrite
// or silently reinterpret another video's receipt.
const fs=require('node:fs'),path=require('node:path');
function build({date,videoId,sourceRun,privacy}){
  if(!/^20\d{6}$/.test(date||'')) throw Error('invalid date');
  if(!/^[A-Za-z0-9_-]{8,}$/.test(videoId||'')) throw Error('invalid video ID');
  if(privacy!=='private') throw Error('unverified private status');
  if(!/^\d+$/.test(String(sourceRun||''))) throw Error('invalid source run');
  return {target_date:date,youtube_video_id:videoId,source_run_id:String(sourceRun),privacy:'private',upload_status:'video_created'};
}
if(require.main===module){
  const [date,videoId,sourceRun,privacy,destination]=process.argv.slice(2);
  const checkpoint=build({date,videoId,sourceRun,privacy});
  if(!destination) throw Error('destination required');
  const file=path.resolve(destination);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
  console.log('checkpoint prepared (not uploaded): '+file);
}
module.exports={build};
