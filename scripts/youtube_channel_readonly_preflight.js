#!/usr/bin/env node
'use strict';
// Read-only probe: no HTTP POST except OAuth token refresh, and no YouTube mutation.
const fs=require('node:fs');
const crypto=require('node:crypto');
function clean(name){let x=String(process.env[name]||'').trim();if(x.startsWith(name+'='))x=x.slice(name.length+1).trim();return x.replace(/^["']|["']$/g,'').replace(/\\[rn]/g,'').trim();}
(async()=>{
 const client_id=clean('YOUTUBE_CLIENT_ID'),client_secret=clean('YOUTUBE_CLIENT_SECRET'),refresh_token=clean('YOUTUBE_REFRESH_TOKEN');
 if(!client_id||!client_secret||!refresh_token)throw Error('Missing OAuth credentials');
 const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'})});
 const t=await tokenRes.json();
 if(!tokenRes.ok||!t.access_token)throw Error('OAuth refresh failed HTTP '+tokenRes.status+' '+(t.error||''));
 const get=async endpoint=>{
   const r=await fetch('https://www.googleapis.com/youtube/v3/'+endpoint,{headers:{authorization:'Bearer '+t.access_token}});
   if(!r.ok){const e=await r.json().catch(()=>({}));throw Error('YouTube GET HTTP '+r.status+' '+(e.error?.status||''));}
   return r.json();
 };
 const c=await get('channels?part=id,snippet,brandingSettings,status&mine=true');
 if(!Array.isArray(c.items)||c.items.length!==1)throw Error('Unexpected owned channel count: '+(c.items?.length||0));
 const ch=c.items[0],v=await get('videos?part=snippet,status&id=GiWA60DJoWI');
 if(v.items?.length!==1||v.items[0].snippet?.channelId!==ch.id)throw Error('Verified private pilot is not owned by credential channel');
 const out={checked_at:new Date().toISOString(),mode:'read_only',youtube_channel_id:ch.id,display_name:ch.snippet?.title||null,custom_url:ch.snippet?.customUrl||null,description:ch.snippet?.description||'',country:ch.snippet?.country||null,language:ch.brandingSettings?.channel?.defaultLanguage||null,branding_image_banner_url_present:!!ch.brandingSettings?.image?.bannerExternalUrl,thumbnail_urls:ch.snippet?.thumbnails?Object.keys(ch.snippet.thumbnails):[],verified_private_video_id:'GiWA60DJoWI',private_video_status:v.items[0].status?.privacyStatus,mutations_performed:false};
 fs.mkdirSync('output',{recursive:true});
 fs.writeFileSync('output/channel-readonly-snapshot.json',JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({channel_id:ch.id,display_name:out.display_name,custom_url:out.custom_url,description_length:out.description.length,banner_configured:out.branding_image_banner_url_present,pilot_privacy:out.private_video_status,mutations_performed:false}));
})().catch(e=>{console.error('CHANNEL_PREFLIGHT_FAILED:',e.message);process.exitCode=1;});
