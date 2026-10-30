'use strict';
// Research-only planner and fake-transport executor. No fetch, credentials, or network defaults.
const ALLOWED = Object.freeze({
  channels: new Set(['part','mine']),
  playlistItems: new Set(['part','playlistId','maxResults','pageToken']),
  videos: new Set(['part','id'])
});
function makeRequest(resource, params) {
  if (!Object.hasOwn(ALLOWED,resource)) throw Error('resource_not_allowed');
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw Error('invalid_params');
  for (const key of Object.keys(params)) if (!ALLOWED[resource].has(key)) throw Error('param_not_allowed');
  const p={...params};
  if (resource==='channels' && (p.mine!==true || p.part!=='id,snippet,contentDetails')) throw Error('channel_request_invalid');
  if (resource==='playlistItems' && (p.part!=='snippet,contentDetails' || typeof p.playlistId!=='string' || !/^[A-Za-z0-9_-]+$/.test(p.playlistId) || p.maxResults!==50 || (p.pageToken!==undefined && !/^[A-Za-z0-9_-]+$/.test(p.pageToken)))) throw Error('playlist_request_invalid');
  if (resource==='videos' && (p.part!=='id,snippet,status' || typeof p.id!=='string' || p.id.split(',').length>50 || !p.id.split(',').every(x=>/^[A-Za-z0-9_-]+$/.test(x)))) throw Error('videos_request_invalid');
  return Object.freeze({method:'GET',resource,params:Object.freeze(p)});
}
async function inspectWithMockTransport(adapter, {maxPages=100}={}) {
  if (typeof adapter!=='function') throw Error('mock_adapter_required');
  if (!Number.isInteger(maxPages)||maxPages<1||maxPages>100) throw Error('invalid_page_limit');
  const request = async (resource,params) => {
    const spec=makeRequest(resource,params);
    const response=await adapter(spec);
    if (!response || response.status!==200 || !response.body || typeof response.body!=='object' || Array.isArray(response.body)) throw Error('read_failed');
    return response.body;
  };
  const channel=await request('channels',{mine:true,part:'id,snippet,contentDetails'});
  if (!Array.isArray(channel.items)||channel.items.length!==1||!channel.items[0]?.id) throw Error('invalid_channel');
  const playlistId=channel.items[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw Error('missing_uploads_playlist');
  const pages=[],seen=new Set();let pageToken;
  for(let i=0;i<maxPages;i++){
    const args={part:'snippet,contentDetails',playlistId,maxResults:50};
    if(pageToken)args.pageToken=pageToken;
    const body=await request('playlistItems',args);
    if(!Array.isArray(body.items))throw Error('invalid_playlist');
    pages.push({...body,requestPageToken:pageToken||null});
    if(!body.nextPageToken) { pageToken=undefined;break; }
    if(seen.has(body.nextPageToken))throw Error('pagination_loop');
    seen.add(body.nextPageToken);pageToken=body.nextPageToken;
  }
  if(pageToken)throw Error('pagination_limit');
  const ids=[...new Set(pages.flatMap(p=>p.items.map(v=>v?.contentDetails?.videoId)))];
  if(ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)))throw Error('invalid_video_id');
  const videoPages=[];
  for(let i=0;i<ids.length;i+=50) {
    const body=await request('videos',{part:'id,snippet,status',id:ids.slice(i,i+50).join(',')});
    if(!Array.isArray(body.items))throw Error('invalid_videos');
    videoPages.push(body);
  }
  // Data only: no upload decision or authorization can be emitted.
  return {channel,pages,videoPages};
}
module.exports={makeRequest,inspectWithMockTransport};
