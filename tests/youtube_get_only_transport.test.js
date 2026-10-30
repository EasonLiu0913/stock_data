'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {makeRequest,inspectWithMockTransport}=require('../scripts/youtube_get_only_transport');
test('only exact GET endpoint shapes allowed',()=>{
 assert.equal(makeRequest('channels',{mine:true,part:'id,snippet,contentDetails'}).method,'GET');
 for(const [r,p] of [['captions',{part:'snippet'}],['channels',{mine:true,part:'status'}],['videos',{part:'id,snippet,status',id:'a',access_token:'x'}],['playlistItems',{part:'snippet,contentDetails',playlistId:'x',maxResults:51}]]) assert.throws(()=>makeRequest(r,p));
});
test('all mock requests are GET and paginated to end',async()=>{
 const requests=[];
 const adapter=async spec=>{
  requests.push(spec);
  if(spec.resource==='channels')return {status:200,body:{items:[{id:'channel',contentDetails:{relatedPlaylists:{uploads:'uploads'}}}]}};
  if(spec.resource==='playlistItems')return {status:200,body:spec.params.pageToken?{items:[{contentDetails:{videoId:'v2'}}]}:{items:[{contentDetails:{videoId:'v1'}}],nextPageToken:'next'}};
  return {status:200,body:{items:spec.params.id.split(',').map(id=>({id,snippet:{channelId:'channel'},status:{privacyStatus:'private'}}))}};
 };
 const out=await inspectWithMockTransport(adapter);
 assert.equal(out.pages.length,2);assert.equal(out.videoPages.length,1);
 assert.ok(requests.every(x=>x.method==='GET'));
 assert.equal(Object.hasOwn(out,'upload_authorized'),false);
});
test('HTTP 403, 429, 500 fail closed',async()=>{
 for(const status of [403,429,500])await assert.rejects(inspectWithMockTransport(async()=>({status,body:{}})),/read_failed/);
});
test('broken pagination and invalid response fail closed',async()=>{
 const channel={status:200,body:{items:[{id:'channel',contentDetails:{relatedPlaylists:{uploads:'uploads'}}}]}};
 await assert.rejects(inspectWithMockTransport(async q=>q.resource==='channels'?channel:{status:200,body:{items:[],nextPageToken:'same'}},{maxPages:3}),/pagination_loop/);
 await assert.rejects(inspectWithMockTransport(async q=>q.resource==='channels'?channel:{status:200,body:{items:null}}),/invalid_playlist/);
});
test('no network defaults or token handling',async()=>{
 await assert.rejects(inspectWithMockTransport(),/mock_adapter_required/);
 const fs=require('node:fs');const s=fs.readFileSync(require.resolve('../scripts/youtube_get_only_transport'),'utf8');
 assert.equal(s.includes('fetch('),false);assert.equal(s.includes('https:'),false);
 assert.equal(s.includes('process.env'),false);
});
