'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const page=fs.readFileSync(path.resolve(__dirname,'../public/daily-gainers-v2-video-preview.html'),'utf8');
const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1,'preview must keep a single auditable inline script');
new vm.Script(scripts[0][1],{filename:'daily-gainers-v2-video-preview.html'});
for(const element of ['player','videoFile','subtitleFile','planFile','qaFile','chapters','checks'])
 assert.ok(page.includes('id="'+element+'"'),'missing interface '+element);
assert.ok(page.includes('URL.createObjectURL'),'browser local file preview required');
assert.ok(page.includes('parseSRT'),'subtitle conversion required');
assert.ok(page.includes('currentTime=start'),'scene jump required');
assert.ok(!/fetch\s*\(|XMLHttpRequest\s*\(/.test(scripts[0][1]),'preview should not upload or network-fetch local files');
console.log('V2 Video Preview Dashboard static contract PASS');
