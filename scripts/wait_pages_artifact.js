'use strict';
const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForArtifact({ api, repo, runId, artifactId, name, token, request=fetch, pause=sleep, log=console.log }) {
  if (!/^\d+$/.test(runId || '') || !/^\d+$/.test(artifactId || '') || !/^github-pages-\d+$/.test(name || '') ||
      !/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !api) {
    throw new Error('Invalid Pages artifact identity');
  }
  const url = api.replace(/\/$/, '') + '/repos/' + repo + '/actions/runs/' + runId + '/artifacts?name=' + encodeURIComponent(name) + '&per_page=100';
  const delays = [0, 3000, 5000, 10000, 15000, 30000];
  let last = 'not visible';
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await pause(delays[i]);
    log('Pages artifact readiness attempt ' + (i+1) + '/' + delays.length + ': ' + name + ' id=' + artifactId);
    try {
      const get = auth => request(url, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
        signal: AbortSignal.timeout(10000)
      });
      let response = await get(token);
      // Existing reusable-workflow callers need not grant actions:read.
      // This repository is public; use public metadata if its job token is denied.
      if (token && [401,403,404].includes(response.status)) response = await get('');
      if (!response.ok) {
        last = 'HTTP ' + response.status;
        log('Artifact metadata unavailable: ' + last);
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.artifacts)) throw new Error('Missing artifacts array');
      const matches = payload.artifacts.filter(a => a.name === name);
      if (matches.length > 1) throw Object.assign(new Error('Duplicate Pages artifact name'), {fatal:true});
      if (matches.length === 1) {
        const a = matches[0];
        if (String(a.id) !== artifactId || (a.workflow_run && String(a.workflow_run.id) !== runId)) {
          throw Object.assign(new Error('Pages artifact identity mismatch'), {fatal:true});
        }
        if (a.expired === true) throw Object.assign(new Error('Pages artifact expired'), {fatal:true});
        if (a.expired === false && Number.isFinite(a.size_in_bytes) && a.size_in_bytes > 0) {
          log('Pages artifact visible: id=' + a.id + ' bytes=' + a.size_in_bytes + '; allowing 5s for internal service propagation');
          await pause(5000);
          return a;
        }
      }
      last = 'artifact not yet visible or incomplete';
    } catch (error) {
      if (error.fatal) throw error;
      last = String(error.message || error);
      log('Artifact metadata check failed: ' + last);
    }
  }
  throw new Error('Pages artifact readiness exhausted: ' + last);
}

async function selfTest() {
  const identity = {api:'https://api.github.com',repo:'owner/repo',runId:'123',artifactId:'456',name:'github-pages-1',token:'mock',log:()=>{}};
  const good = {id:456,name:'github-pages-1',expired:false,size_in_bytes:123,workflow_run:{id:123}};
  const response = (artifacts, status=200) => ({ok:status===200,status,json:async()=>({artifacts})});
  let calls=0, waits=[];
  const found = await waitForArtifact({...identity,request:async()=>response(++calls===1?[]:[good]),pause:async ms=>waits.push(ms)});
  assert.equal(found.id,456); assert.equal(calls,2); assert.deepEqual(waits,[3000,5000]);
  calls=0;
  await waitForArtifact({...identity,request:async(url,opts)=>{
    calls++;
    if(calls===1){assert.ok(opts.headers.Authorization);return response([],403);}
    assert.equal(opts.headers.Authorization,undefined);return response([good]);
  },pause:async()=>{}});
  assert.equal(calls,2);
  calls=0;
  await assert.rejects(waitForArtifact({...identity,request:async()=>{calls++;return response([]);},pause:async()=>{}}),/exhausted/);
  assert.equal(calls,6);
  for(const bad of [[{...good,id:999}],[{...good,expired:true}],[good,good],[{...good,workflow_run:{id:999}}]]) {
    await assert.rejects(waitForArtifact({...identity,request:async()=>response(bad),pause:async()=>{}}),/mismatch|expired|Duplicate/);
  }
  await assert.rejects(waitForArtifact({...identity,request:async()=>response([{...good,size_in_bytes:0}]),pause:async()=>{}}),/exhausted/);
  console.log('Pages artifact readiness self-test passed');
}

if (require.main === module) {
  const task = process.argv.includes('--self-test') ? selfTest() : waitForArtifact({
    api:process.env.GITHUB_API_URL,repo:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,
    artifactId:process.env.PAGES_ARTIFACT_ID,name:process.env.PAGES_ARTIFACT_NAME,token:process.env.GITHUB_TOKEN
  });
  task.catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports = {waitForArtifact};
