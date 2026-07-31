#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const partsDir='scripts/.bootstrap_oversold_rebound_parts';
const archive=fs.readdirSync(partsDir).sort().map(name=>fs.readFileSync(path.join(partsDir,name),'utf8')).join('');
const payload=JSON.parse(zlib.gunzipSync(Buffer.from(archive,'base64')).toString('utf8'));
for(const [file,content] of Object.entries(payload)){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,content,'utf8');
}
fs.rmSync(partsDir,{recursive:true,force:true});
for(const file of ['scripts/.bootstrap_oversold_rebound.js','.github/workflows/bootstrap-oversold-rebound.yml']){
  try{fs.unlinkSync(file)}catch{}
}
console.log(`Installed ${Object.keys(payload).length} oversold rebound files`);
// Trigger the bootstrap workflow after the workflow file exists on this branch.
