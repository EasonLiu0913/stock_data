#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
function secret(name) {
 let s=String(process.env[name]||'').trim();
 if(s.startsWith(name+'='))s=s.slice(name.length+1).trim();
 return s.replace(/^["']|["']$/g,'').replace(/\\r|\\n/g,'');
}
async function main(videoId,file){
 if(!/^[A-Za-z0-9_-]{8,20}$/.test(videoId||''))throw Error('Invalid YouTube video ID');
 const image=path.resolve(file||'');
 const data=fs.readFileSync(image);
 if(data.length<15000||data.length>2*1024*1024)throw Error('Thumbnail exceeds upload limits or is empty');
 if(data[0]!==0xff||data[1]!==0xd8)throw Error('Thumbnail must be JPEG');
 const client_id=secret('YOUTUBE_CLIENT_ID'),client_secret=secret('YOUTUBE_CLIENT_SECRET'),refresh_token=secret('YOUTUBE_REFRESH_TOKEN');
 if(!client_id||!client_secret||!refresh_token)throw Error('YouTube OAuth secrets missing');
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'})
 });
 const token=await tokenResponse.json();
 if(!tokenResponse.ok||!token.access_token)throw Error('OAuth failed: '+tokenResponse.status+' '+JSON.stringify(token));
 const url='https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId='+encodeURIComponent(videoId);
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'image/jpeg'},body:data});
 const body=await response.text();
 if(!response.ok)throw Error('YouTube thumbnail upload failed: HTTP '+response.status+' '+body);
 const info=JSON.parse(body);
 if(!info.items||!info.items.length)throw Error('YouTube thumbnail response missing items');
 console.log('YOUTUBE_THUMBNAIL_UPLOAD=PASS');
}
main(process.argv[2],process.argv[3]).catch(e=>{console.error(e.stack||e.message);process.exit(1)});
