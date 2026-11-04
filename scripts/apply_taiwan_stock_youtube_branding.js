#!/usr/bin/env node
'use strict';
// Owner-authorized one-time branding update. No video mutation, no channel title/handle edits.
// Does NOT access or log credentials; verify the selected channel and signed-off PNGs.
const fs=require('node:fs');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const TARGET_CHANNEL_ID='UCL9fFDhPlFZDTu2AeydDRBw';
const PRIVATE_PILOT_ID='GiWA60DJoWI';
const BANNER='assets/youtube-brand/approved/youtube_banner_2560x1440.png';
const description=[
 '歡迎來到 TAIWAN STOCK｜台股資金觀察！',
 '追蹤資金，解讀行情。錢在哪，我們就在哪！',
 '',
 '這裡用真實台股交易日資料，整理市場漲跌家數、加權指數、成交金額及三大法人資金動向，並追蹤每日漲幅達 5% 的強勢標的。',
 '我們結合公司公告、產業新聞、量價、融資與券商分點，辨別可驗證的資金訊號、題材時序與風險。上市、上櫃與 ETF／反向商品都會依資料清楚標示性質。',
 '',
 '不只看漲幅，更要看懂市場資金正在做什麼。',
 '本頻道內容僅供投資研究與資訊交流，不構成個別投資建議或獲利保證。'
].join('\n');
function sec(name){return String(process.env[name]||'').trim().replace(new RegExp('^'+name+'='),'').replace(/^["']|["']$/g,'').replace(/\\[rn]/g,'').trim();}
async function main(){
 cp.execFileSync('node',['scripts/verify_youtube_brand_assets.js'],{stdio:'inherit'});
 if(!fs.existsSync('docs/strategies/taiwan-stock-channel-apply-once.json'))throw Error('Missing explicit channel-update trigger');
 const intent=JSON.parse(fs.readFileSync('docs/strategies/taiwan-stock-channel-apply-once.json','utf8'));
 if(intent.channel_id!==TARGET_CHANNEL_ID||intent.approval!=='owner_authorized_brand_channel_setup_20261104'||intent.allow_change_privacy!==false)throw Error('Owner scope is invalid');
 if(description.length>1000)throw Error('Description too long');
 const client_id=sec('YOUTUBE_CLIENT_ID'),client_secret=sec('YOUTUBE_CLIENT_SECRET'),refresh_token=sec('YOUTUBE_REFRESH_TOKEN');
 if(!client_id||!client_secret||!refresh_token)throw Error('OAuth secrets missing');
 const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'})});
 const t=await tr.json();
 if(!tr.ok||!t.access_token)throw Error('OAuth refresh failed: '+tr.status+' '+(t.error||''));
 const auth={Authorization:'Bearer '+t.access_token};
 const get=async path=>{
  const r=await fetch('https://www.googleapis.com/youtube/v3/'+path,{headers:auth});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error('YouTube GET error '+r.status+' '+(data.error?.status||''));
  return data;
 };
 const owned=await get('channels?part=id,snippet,brandingSettings&mine=true');
 if(owned.items?.length!==1||owned.items[0].id!==TARGET_CHANNEL_ID)throw Error('WRONG_CHANNEL');
 const video=await get('videos?part=snippet,status&id='+PRIVATE_PILOT_ID);
 if(video.items?.length!==1||video.items[0].snippet?.channelId!==TARGET_CHANNEL_ID||video.items[0].status?.privacyStatus!=='private')throw Error('PRIVATE_PILOT_OWNER_OR_PRIVACY_MISMATCH');
 const old=owned.items[0],brand=old.brandingSettings||{},channel=brand.channel||{};
 const allowed=['title','description','keywords','defaultLanguage','country','trackingAnalyticsAccountId','unsubscribedTrailer'];
 const bad=Object.keys(channel).filter(k=>!allowed.includes(k));
 if(bad.length)throw Error('UNKNOWN_EXISTING_CHANNEL_FIELD:'+bad.join(','));
 if(Object.keys(brand.watch||{}).length)throw Error('NONEMPTY_WATCH_BRANDING_NOT_MIGRATED');
 const kept={};
 for(const key of ['keywords','defaultLanguage','country','trackingAnalyticsAccountId','unsubscribedTrailer']){
  if(channel[key]!==undefined)kept[key]=channel[key];
 }
 const image=fs.readFileSync(BANNER);
 if(image.length!==159137||crypto.createHash('sha256').update(image).digest('hex')!=='315d548ff447429bb21c9909c2ff7fd28efed96de110fec7118fbec60c343ad8')throw Error('APPROVED_BANNER_HASH_MISMATCH');
 const response=await fetch('https://www.googleapis.com/upload/youtube/v3/channelBanners/insert?uploadType=media',{
  method:'POST',headers:{...auth,'content-type':'image/png','content-length':String(image.length)},body:image
 });
 const b=await response.json().catch(()=>({}));
 if(!response.ok||!b.url)throw Error('CHANNEL_BANNER_UPLOAD_FAILED HTTP '+response.status+' '+(b.error?.status||''));
 const desired={id:TARGET_CHANNEL_ID,brandingSettings:{channel:{...kept,description},image:{bannerExternalUrl:b.url}}};
 const write=await fetch('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings',{
  method:'PUT',headers:{...auth,'content-type':'application/json'},body:JSON.stringify(desired)
 });
 const w=await write.json().catch(()=>({}));
 if(!write.ok)throw Error('CHANNEL_BRANDING_UPDATE_FAILED HTTP '+write.status+' '+(w.error?.status||''));
 const again=await get('channels?part=id,snippet,brandingSettings&mine=true');
 const final=again.items?.[0];
 if(final?.id!==TARGET_CHANNEL_ID)throw Error('READBACK_CHANNEL_MISMATCH');
 if(final.snippet?.description!==description&&final.brandingSettings?.channel?.description!==description)throw Error('DESCRIPTION_READBACK_MISMATCH');
 if(!final.brandingSettings?.image?.bannerExternalUrl)throw Error('BANNER_READBACK_MISSING');
 const result={target_channel_id:TARGET_CHANNEL_ID,approved_banner_sha256:'315d548ff447429bb21c9909c2ff7fd28efed96de110fec7118fbec60c343ad8',channel_description_updated:true,banner_updated:true,display_name_after:final.snippet?.title||null,custom_url_after:final.snippet?.customUrl||null,video_privacy_unchanged:'private',channel_title_changed_by_script:false,avatar_changed_by_script:false,verified_at:new Date().toISOString()};
 fs.mkdirSync('output',{recursive:true});
 fs.writeFileSync('output/taiwan-stock-branding-update-receipt.json',JSON.stringify(result,null,2)+'\n');
 console.log('CHANNEL_BRANDING_PASS',JSON.stringify({channel_id:TARGET_CHANNEL_ID,description_updated:true,banner_present:true,display_name_after:result.display_name_after,privacy_preserved:'private',title_unchanged:true,avatar_unchanged:true}));
}
main().catch(e=>{console.error('CHANNEL_BRANDING_FAILED:',e.message);process.exitCode=1;});
