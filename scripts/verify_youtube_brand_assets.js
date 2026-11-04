#!/usr/bin/env node
// Owner-approved TAIWAN STOCK brand binary gate. This script never changes YouTube.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const manifestPath=path.resolve('assets/youtube-brand/approved/approved-assets-manifest.json');
const root=path.dirname(manifestPath);
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(m.schema_version!==1||m.brand!=='TAIWAN STOCK｜台股資金觀察'||m.files.length!==3)throw Error('MANIFEST_CONTRACT_DRIFT');
if(m.files.some(x=>x.name.includes('circle')))throw Error('DISALLOWED_CIRCLE_PREVIEW');
const approved=['logo_master_1024.png','youtube_avatar_800.png','youtube_banner_2560x1440.png'];
if(JSON.stringify(m.files.map(x=>x.name))!==JSON.stringify(approved))throw Error('ASSET_LIST_DRIFT');
const sig=Buffer.from('89504e470d0a1a0a','hex');
for(const x of m.files){
  const f=path.join(root,x.name);
  if(!fs.existsSync(f))throw Error('MISSING_APPROVED_BINARY: '+f);
  const b=fs.readFileSync(f);
  if(!b.subarray(0,8).equals(sig)||b.length!==x.bytes)throw Error('ASSET_FORMAT_OR_SIZE_DRIFT:'+x.name);
  const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
  if(width!==x.width||height!==x.height)throw Error('DIMENSIONS_DRIFT:'+x.name);
  const hash=crypto.createHash('sha256').update(b).digest('hex');
  if(hash!==x.sha256)throw Error('SHA256_DRIFT:'+x.name);
  process.stdout.write('PASS '+x.name+' '+width+'x'+height+' '+hash+'\n');
}
if(fs.existsSync(path.join(root,'avatar_circle_preview.png')))throw Error('CIRCLE_PREVIEW_NOT_ALLOWED');
console.log('ALL_APPROVED_YOUTUBE_BRAND_ASSETS_VERIFIED');
