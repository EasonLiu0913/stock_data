'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function check(receipt, raw, normalized, date) {
  if (!receipt || receipt.schemaVersion !== 1) throw Error('receipt missing');
  if (receipt.trust !== 'capture_time') throw Error('capture-time provenance missing');
  if (!receipt.capture || receipt.capture.repository !== 'EasonLiu0913/stock_data' ||
      !Number.isSafeInteger(receipt.capture.runId) || receipt.capture.runId <= 0 ||
      !/^[a-f0-9]{40}$/.test(receipt.capture.commitSha || '') ||
      receipt.capture.workflow !== 'crawl-twse-mi-index.yml') throw Error('capture run identity missing');
  if (!/^https:\/\//.test(receipt.url || '')) throw Error('URL missing');
  if (receipt.httpStatus !== 200) throw Error('HTTP status invalid');
  if (!Number.isFinite(Date.parse(receipt.capturedAt))) throw Error('capture time missing');
  if (receipt.sourceDate !== date) throw Error('date mismatch');
  if (!/^[a-f0-9]{64}$/.test(receipt.rawResponseSha256 || '') || !/^[a-f0-9]{64}$/.test(receipt.normalizedFileSha256 || '')) throw Error('SHA-256 missing');
  if (sha256(raw) !== receipt.rawResponseSha256) throw Error('raw SHA-256 mismatch');
  if (sha256(normalized) !== receipt.normalizedFileSha256) throw Error('normalized SHA-256 mismatch');
  return true;
}
test('research-only proposed receipt contract rejects missing and substituted evidence', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const normalized = Buffer.from(JSON.stringify(JSON.parse(raw.toString()), null, 2));
  const receipt = {schemaVersion:1,trust:'capture_time',url:'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',httpStatus:200,capture:{repository:'EasonLiu0913/stock_data',runId:12345,commitSha:'a'.repeat(40),workflow:'crawl-twse-mi-index.yml'},capturedAt:'2026-07-24T07:00:00Z',sourceDate:'20260724',rawResponseSha256:sha256(raw),normalizedFileSha256:sha256(normalized)};
  assert.equal(check(receipt,raw,normalized,'20260724'),true);
  assert.throws(()=>check(null,raw,normalized,'20260724'),/receipt missing/);
  assert.throws(()=>check({...receipt,capture:null},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,capture:{...receipt.capture,runId:0}},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,capture:{...receipt.capture,commitSha:'bad'}},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,trust:'post_hoc'},raw,normalized,'20260724'),/capture-time provenance/);
  assert.throws(()=>check(receipt,raw,Buffer.from('{}'),'20260724'),/normalized SHA-256 mismatch/);
  assert.throws(()=>check(receipt,Buffer.from('{}'),normalized,'20260724'),/raw SHA-256 mismatch/);
  assert.throws(()=>check({...receipt,sourceDate:'20260723'},raw,normalized,'20260724'),/date mismatch/);
  assert.throws(()=>check({...receipt,httpStatus:503},raw,normalized,'20260724'),/HTTP status/);
});

function verifyGitHubRun(receipt, run, artifacts) {
  if (!run || run.id !== receipt.capture.runId ||
      run.repository?.full_name !== receipt.capture.repository ||
      run.head_sha !== receipt.capture.commitSha ||
      run.path !== '.github/workflows/' + receipt.capture.workflow ||
      run.status !== 'completed' || run.conclusion !== 'success') {
    throw Error('GitHub run identity mismatch');
  }
  if (!Array.isArray(artifacts) || !artifacts.some(a =>
      a.name === receipt.capture.artifactName &&
      a.workflow_run?.id === run.id && a.expired === false)) {
    throw Error('matching nonexpired source artifact missing');
  }
  return true;
}
test('research-only independent GitHub run and artifact binding fails closed', () => {
  const run = {id:12345,repository:{full_name:'EasonLiu0913/stock_data'},
    head_sha:'a'.repeat(40),path:'.github/workflows/crawl-twse-mi-index.yml',
    status:'completed',conclusion:'success'};
  const receipt = {capture:{repository:'EasonLiu0913/stock_data',runId:12345,
    commitSha:'a'.repeat(40),workflow:'crawl-twse-mi-index.yml',artifactName:'twse-mi-index-source-20260724'}};
  const artifacts = [{name:'twse-mi-index-source-20260724',expired:false,workflow_run:{id:12345}}];
  assert.equal(verifyGitHubRun(receipt,run,artifacts),true);
  assert.throws(()=>verifyGitHubRun(receipt,{...run,head_sha:'b'.repeat(40)},artifacts),/run identity mismatch/);
  assert.throws(()=>verifyGitHubRun(receipt,{...run,conclusion:'failure'},artifacts),/run identity mismatch/);
  assert.throws(()=>verifyGitHubRun(receipt,run,[]),/artifact missing/);
  assert.throws(()=>verifyGitHubRun(receipt,run,[{...artifacts[0],expired:true}]),/artifact missing/);
  assert.throws(()=>verifyGitHubRun(receipt,run,[{...artifacts[0],workflow_run:{id:67890}}]),/artifact missing/);
});

function verifyArtifactBundle(receipt, bundle, expectedDate) {
  if (!bundle || !Buffer.isBuffer(bundle.raw) || !Buffer.isBuffer(bundle.normalized)) {
    throw Error('artifact payload missing');
  }
  if (!bundle.receipt || sha256(Buffer.from(JSON.stringify(bundle.receipt))) !== sha256(Buffer.from(JSON.stringify(receipt)))) throw Error('artifact receipt content mismatch');
  if (bundle.date !== expectedDate || receipt.sourceDate !== expectedDate) throw Error('artifact date mismatch');
  if (sha256(bundle.raw) !== receipt.rawResponseSha256) throw Error('artifact raw hash mismatch');
  if (sha256(bundle.normalized) !== receipt.normalizedFileSha256) throw Error('artifact normalized hash mismatch');
  return true;
}
test('research-only artifact bundle binds receipt to exact source bytes and date', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const normalized = Buffer.from(JSON.stringify(JSON.parse(raw.toString()),null,2));
  const receipt = {sourceDate:'20260724',rawResponseSha256:sha256(raw),normalizedFileSha256:sha256(normalized)};
  const bundle = {date:'20260724',receipt,raw,normalized};
  assert.equal(verifyArtifactBundle(receipt,bundle,'20260724'),true);
  assert.throws(()=>verifyArtifactBundle(receipt,{...bundle,raw:Buffer.from('{}')},'20260724'),/raw hash mismatch/);
  assert.throws(()=>verifyArtifactBundle(receipt,{...bundle,normalized:Buffer.from('{}')},'20260724'),/normalized hash mismatch/);
  assert.throws(()=>verifyArtifactBundle(receipt,{...bundle,date:'20260723'},'20260724'),/date mismatch/);
  assert.equal(verifyArtifactBundle(receipt,{...bundle,receipt:JSON.parse(JSON.stringify(receipt))},'20260724'),true);
  assert.throws(()=>verifyArtifactBundle(receipt,{...bundle,receipt:{...receipt,sourceDate:'20260723'}},'20260724'),/receipt content mismatch/);
  assert.throws(()=>verifyArtifactBundle(receipt,{...bundle,raw:null},'20260724'),/payload missing/);
});

function canonicalReceipt(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw Error('unsupported receipt number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalReceipt).join(',') + ']';
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw Error('unsupported receipt type');
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalReceipt(value[k])).join(',') + '}';
}
test('research-only canonical receipt is order invariant and rejects ambiguous types', () => {
  const a = {schemaVersion:1,capture:{runId:12345,workflow:'crawl-twse-mi-index.yml'},sourceDate:'20260724'};
  const b = {sourceDate:'20260724',capture:{workflow:'crawl-twse-mi-index.yml',runId:12345},schemaVersion:1};
  assert.equal(sha256(Buffer.from(canonicalReceipt(a))),sha256(Buffer.from(canonicalReceipt(b))));
  assert.notEqual(sha256(Buffer.from(canonicalReceipt(a))),sha256(Buffer.from(canonicalReceipt({...a,sourceDate:'20260723'}))));
  assert.throws(()=>canonicalReceipt({...a,extra:undefined}),/unsupported receipt type/);
  assert.throws(()=>canonicalReceipt({...a,extra:NaN}),/unsupported receipt number/);
  assert.throws(()=>canonicalReceipt({...a,extra:1.5}),/unsupported receipt number/);
});

test('research-only canonical receipt Unicode and numeric boundary cases', () => {
  const composed = {source:'臺灣',note:'é'};
  const decomposed = {note:'e\u0301',source:'臺灣'};
  assert.notEqual(canonicalReceipt(composed),canonicalReceipt(decomposed),
    'Unicode normalization is not implicit and must be specified');
  assert.equal(canonicalReceipt({a:'中文',b:'😀'}),canonicalReceipt({b:'😀',a:'中文'}));
  assert.throws(()=>canonicalReceipt({n:Number.MAX_SAFE_INTEGER+1}),/unsupported receipt number/);
  assert.throws(()=>canonicalReceipt({n:Infinity}),/unsupported receipt number/);
  assert.notEqual(canonicalReceipt({n:0}),canonicalReceipt({n:'0'}));
  const duplicateKeyJson = '{"sourceDate":"20260724","sourceDate":"20260723"}';
  assert.equal(JSON.parse(duplicateKeyJson).sourceDate,'20260723');
  assert.notEqual(canonicalReceipt(JSON.parse(duplicateKeyJson)),canonicalReceipt({sourceDate:'20260724'}));
});

test('research-only duplicate JSON keys cannot be authenticated after ordinary parsing', () => {
  const clean = '{"sourceDate":"20260723"}';
  const ambiguous = '{"sourceDate":"20260724","sourceDate":"20260723"}';
  assert.deepEqual(JSON.parse(clean),JSON.parse(ambiguous));
  assert.equal(canonicalReceipt(JSON.parse(clean)),canonicalReceipt(JSON.parse(ambiguous)));
  assert.notEqual(sha256(Buffer.from(clean)),sha256(Buffer.from(ambiguous)));
  // Fail closed at the raw-byte trust boundary until a strict duplicate-key parser exists.
  const authenticateRawReceipt = (bytes, strictDuplicateKeyParser) => {
    if (typeof strictDuplicateKeyParser !== 'function') throw Error('strict raw JSON parser required');
    return strictDuplicateKeyParser(bytes);
  };
  assert.throws(()=>authenticateRawReceipt(ambiguous,null),/strict raw JSON parser required/);
});

test('research-only escaped and nested duplicate JSON keys require token-aware validation', () => {
  const cases = [
    ['{"sourceDate":"20260724","sourceDate":"20260723"}','{"sourceDate":"20260723"}'],
    ['{"sourceDate":"20260724","\\u0073ourceDate":"20260723"}','{"sourceDate":"20260723"}'],
    ['{"capture":{"runId":1,"runId":2}}','{"capture":{"runId":2}}'],
    ['{"capture":{"runId":1,"\\u0072unId":2}}','{"capture":{"runId":2}}']
  ];
  for (const [ambiguous,clean] of cases) {
    assert.deepEqual(JSON.parse(ambiguous),JSON.parse(clean));
    assert.equal(canonicalReceipt(JSON.parse(ambiguous)),canonicalReceipt(JSON.parse(clean)));
    assert.notEqual(sha256(Buffer.from(ambiguous)),sha256(Buffer.from(clean)));
  }
  const separateObjects = '{"a":{"id":1},"b":{"id":2}}';
  assert.deepEqual(JSON.parse(separateObjects),{a:{id:1},b:{id:2}});
});

test('research-only receipt rejects substituted bytes even when path, date and metadata remain unchanged', () => {
  const original = Buffer.from('{"date":"20260724","close":100}');
  const substituted = Buffer.from('{"date":"20260724","close":999}');
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const receipt = {
    schemaVersion: 1, trust: 'capture_time',
    capture: {repository: 'EasonLiu0913/stock_data', runId: 12345,
      commitSha: 'a'.repeat(40), workflow: 'crawl-twse-mi-index.yml'},
    url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
    httpStatus: 200, capturedAt: '2026-07-24T07:00:00Z', sourceDate: '20260724',
    rawResponseSha256: sha256(raw), normalizedFileSha256: sha256(original),
  };
  assert.equal(check(receipt, raw, original, '20260724'), true);
  assert.throws(() => check(receipt, raw, substituted, '20260724'),
    /normalized SHA-256 mismatch/);
  // Replacing both data and its local digest is not authenticated by a digest alone.
  const forged = {...receipt, normalizedFileSha256: sha256(substituted)};
  assert.equal(check(forged, raw, substituted, '20260724'), true,
    'research finding: a forged local receipt can accompany substituted data');
  assert.notEqual(sha256(Buffer.from(canonicalReceipt(receipt))),
    sha256(Buffer.from(canonicalReceipt(forged))),
    'independently trusted receipt identity must bind the original digest');
});

test('research-only GitHub run identity is not a cryptographic artifact-content attestation', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const original = Buffer.from('{"date":"20260724","close":100}');
  const replacement = Buffer.from('{"date":"20260724","close":999}');
  const base = {
    schemaVersion: 1, trust: 'capture_time',
    capture: {repository: 'EasonLiu0913/stock_data', runId: 12345,
      commitSha: 'a'.repeat(40), workflow: 'crawl-twse-mi-index.yml',
      artifactName: 'twse-mi-index-source-20260724'},
    url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
    httpStatus: 200, capturedAt: '2026-07-24T07:00:00Z',
    sourceDate: '20260724', rawResponseSha256: sha256(raw),
    normalizedFileSha256: sha256(original),
  };
  const run = {id: 12345, repository: {full_name: 'EasonLiu0913/stock_data'},
    head_sha: 'a'.repeat(40), path: '.github/workflows/crawl-twse-mi-index.yml',
    status: 'completed', conclusion: 'success'};
  const artifacts = [{name: base.capture.artifactName, expired: false,
    workflow_run: {id: run.id}}];
  assert.equal(verifyGitHubRun(base, run, artifacts), true);
  const forged = {...base, normalizedFileSha256: sha256(replacement)};
  assert.equal(verifyGitHubRun(forged, run, artifacts), true,
    'run identity and artifact name alone cannot authenticate receipt contents');
  assert.equal(check(forged, raw, replacement, '20260724'), true,
    'a self-consistent forged local receipt passes digest comparison');
  assert.notEqual(sha256(Buffer.from(canonicalReceipt(base))),
    sha256(Buffer.from(canonicalReceipt(forged))),
    'independent artifact-byte authentication must bind the expected receipt digest');
});

function verifyIndependentlyPinnedArtifactBytes(artifactBytes, expectedSha256) {
  if (!Buffer.isBuffer(artifactBytes)) throw Error('artifact bytes missing');
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256))
    throw Error('independently trusted artifact digest missing');
  if (sha256(artifactBytes) !== expectedSha256) throw Error('artifact digest mismatch');
  return true;
}

test('research-only independent artifact digest pin rejects coherent bundle replacement', () => {
  const original = Buffer.from('{"sourceDate":"20260724","close":100}');
  const replacement = Buffer.from('{"sourceDate":"20260724","close":999}');
  const pinnedDigest = sha256(original); // Model a digest obtained from a separate trusted channel.
  assert.equal(verifyIndependentlyPinnedArtifactBytes(original, pinnedDigest), true);
  assert.throws(() => verifyIndependentlyPinnedArtifactBytes(replacement, pinnedDigest),
    /artifact digest mismatch/);
  assert.throws(() => verifyIndependentlyPinnedArtifactBytes(replacement, undefined),
    /independently trusted artifact digest missing/);
  assert.throws(() => verifyIndependentlyPinnedArtifactBytes(replacement, sha256(replacement).toUpperCase()),
    /independently trusted artifact digest missing/);
  assert.throws(() => verifyIndependentlyPinnedArtifactBytes(null, pinnedDigest),
    /artifact bytes missing/);
  // A locally recomputed "expected" digest is not an independent pin.
  assert.equal(verifyIndependentlyPinnedArtifactBytes(replacement, sha256(replacement)), true);
});

function verifyPinnedSnapshotSource(sourceBytes, receipt, trusted, expectedDate) {
  if (!trusted || trusted.origin !== 'independent_capture_artifact')
    throw Error('independent capture evidence missing');
  if (!receipt || !receipt.capture || receipt.capture.runId !== trusted.runId ||
      receipt.capture.commitSha !== trusted.commitSha ||
      receipt.capture.artifactName !== trusted.artifactName)
    throw Error('capture identity mismatch');
  if (receipt.sourceDate !== expectedDate || trusted.sourceDate !== expectedDate)
    throw Error('source date mismatch');
  verifyIndependentlyPinnedArtifactBytes(sourceBytes, trusted.normalizedFileSha256);
  if (receipt.normalizedFileSha256 !== trusted.normalizedFileSha256)
    throw Error('receipt digest not bound to trusted evidence');
  return true;
}

test('research-only Snapshot source gate fails closed on missing or substituted independent evidence', () => {
  const source = Buffer.from('{"date":"20260724","close":100}');
  const changed = Buffer.from('{"date":"20260724","close":999}');
  const trusted = {origin: 'independent_capture_artifact', runId: 12345,
    commitSha: 'a'.repeat(40), artifactName: 'twse-mi-index-source-20260724',
    sourceDate: '20260724', normalizedFileSha256: sha256(source)};
  const receipt = {capture: {runId: trusted.runId, commitSha: trusted.commitSha,
    artifactName: trusted.artifactName}, sourceDate: trusted.sourceDate,
    normalizedFileSha256: trusted.normalizedFileSha256};
  assert.equal(verifyPinnedSnapshotSource(source, receipt, trusted, '20260724'), true);
  assert.throws(() => verifyPinnedSnapshotSource(source, receipt, null, '20260724'),
    /independent capture evidence missing/);
  assert.throws(() => verifyPinnedSnapshotSource(changed, receipt, trusted, '20260724'),
    /artifact digest mismatch/);
  assert.throws(() => verifyPinnedSnapshotSource(source, {...receipt,
    normalizedFileSha256: sha256(changed)}, trusted, '20260724'),
    /receipt digest not bound/);
  assert.throws(() => verifyPinnedSnapshotSource(source, {...receipt,
    capture: {...receipt.capture, runId: 67890}}, trusted, '20260724'),
    /capture identity mismatch/);
  assert.throws(() => verifyPinnedSnapshotSource(source, receipt, trusted, '20260723'),
    /source date mismatch/);
  assert.throws(() => verifyPinnedSnapshotSource(source, receipt, {...trusted,
    normalizedFileSha256: undefined}, '20260724'),
    /independently trusted artifact digest missing/);
});

test('research-only raw HTTP bytes must be captured before JSON parsing', () => {
  const raw = Buffer.from(' { "date" : "20260724", "tables" : [1] }\n');
  const parsed = JSON.parse(raw.toString('utf8'));
  const reserialized = Buffer.from(JSON.stringify(parsed));
  assert.deepEqual(JSON.parse(raw.toString('utf8')), JSON.parse(reserialized.toString('utf8')));
  assert.notEqual(sha256(raw), sha256(reserialized),
    'semantic JSON equality cannot reproduce raw HTTP response SHA-256');
  const receipt = {schemaVersion: 1, trust: 'capture_time',
    capture: {repository: 'EasonLiu0913/stock_data', runId: 12345,
      commitSha: 'a'.repeat(40), workflow: 'crawl-twse-mi-index.yml'},
    url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
    httpStatus: 200, capturedAt: '2026-07-24T07:00:00Z',
    sourceDate: '20260724', rawResponseSha256: sha256(raw),
    normalizedFileSha256: sha256(reserialized)};
  assert.equal(check(receipt, raw, reserialized, '20260724'), true);
  assert.throws(() => check(receipt, reserialized, reserialized, '20260724'),
    /raw SHA-256 mismatch/,
    'post-parse serialization cannot stand in for authenticated raw response bytes');
});

test('research-only receipt URL date and host require independent validation', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const normalized = Buffer.from(JSON.stringify(JSON.parse(raw.toString('utf8'))));
  const receipt = {schemaVersion: 1, trust: 'capture_time',
    capture: {repository: 'EasonLiu0913/stock_data', runId: 12345,
      commitSha: 'a'.repeat(40), workflow: 'crawl-twse-mi-index.yml'},
    url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
    httpStatus: 200, capturedAt: '2026-07-24T07:00:00Z',
    sourceDate: '20260724', rawResponseSha256: sha256(raw),
    normalizedFileSha256: sha256(normalized)};
  const untrustedUrl = {...receipt, url: 'https://example.invalid/MI_INDEX?date=20260723'};
  assert.equal(check(untrustedUrl, raw, normalized, '20260724'), true,
    'characterization: generic HTTPS-only URL validation accepts wrong host/date');
  function requireTwseEndpointDate(value, expectedDate) {
    let url;
    try { url = new URL(value); } catch { throw Error('TWSE endpoint invalid'); }
    if (url.protocol !== 'https:' || url.hostname !== 'www.twse.com.tw' ||
        url.pathname !== '/rwd/zh/afterTrading/MI_INDEX' ||
        url.searchParams.getAll('date').length !== 1 ||
        url.searchParams.get('date') !== expectedDate)
      throw Error('TWSE endpoint or date mismatch');
    return true;
  }
  assert.equal(requireTwseEndpointDate(receipt.url, '20260724'), true);
  assert.throws(() => requireTwseEndpointDate(untrustedUrl.url, '20260724'),
    /TWSE endpoint or date mismatch/);
  assert.throws(() => requireTwseEndpointDate(receipt.url + '&date=20260723', '20260724'),
    /TWSE endpoint or date mismatch/);
  assert.throws(() => requireTwseEndpointDate('https://www.twse.com.tw.evil.invalid/rwd/zh/afterTrading/MI_INDEX?date=20260724', '20260724'),
    /TWSE endpoint or date mismatch/);
});

test('research-only capture receipt must bind to successful matching-date retry attempt', () => {
  const attempts = [
    {requestedDate: '20260724', responseDate: '20260723',
      raw: Buffer.from('{"date":"20260723"}'), httpStatus: 200},
    {requestedDate: '20260724', responseDate: '20260724',
      raw: Buffer.from('{"date":"20260724"}'), httpStatus: 200},
  ];
  function selectCapturedAttempt(items, expectedDate) {
    const matching = items.filter(a => a.requestedDate === expectedDate &&
      a.responseDate === expectedDate && a.httpStatus === 200);
    if (matching.length !== 1) throw Error('unique successful matching-date capture missing');
    return {sourceDate: expectedDate, rawResponseSha256: sha256(matching[0].raw)};
  }
  const selected = selectCapturedAttempt(attempts, '20260724');
  assert.equal(selected.rawResponseSha256, sha256(attempts[1].raw));
  assert.notEqual(selected.rawResponseSha256, sha256(attempts[0].raw));
  assert.throws(() => selectCapturedAttempt(attempts.slice(0, 1), '20260724'),
    /unique successful matching-date capture missing/);
  assert.throws(() => selectCapturedAttempt([...attempts, {...attempts[1]}], '20260724'),
    /unique successful matching-date capture missing/);
  assert.throws(() => selectCapturedAttempt([{...attempts[1], httpStatus: 503}], '20260724'),
    /unique successful matching-date capture missing/);
});


test('research-only retry receipt must bind the exact successful HTTP response bytes', () => {
  const attempts = [
    {requestedDate: '20260724', status: 200, url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
      bytes: Buffer.from('{"date":"20260723","tables":[]}')},
    {requestedDate: '20260724', status: 503, url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
      bytes: Buffer.from('{"date":"20260724","tables":[]}')},
    {requestedDate: '20260724', status: 200, url: 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',
      bytes: Buffer.from(' { "date": "20260724", "tables": [] }\n')},
  ];
  function bindAcceptedAttempt(items, expectedDate) {
    const accepted = items.filter(a => {
      if (a.status !== 200 || a.requestedDate !== expectedDate) return false;
      const u = new URL(a.url);
      if (u.protocol !== 'https:' || u.hostname !== 'www.twse.com.tw' ||
          u.pathname !== '/rwd/zh/afterTrading/MI_INDEX' ||
          u.searchParams.getAll('date').length !== 1 ||
          u.searchParams.get('date') !== expectedDate) return false;
      return JSON.parse(a.bytes.toString('utf8')).date === expectedDate;
    });
    if (accepted.length !== 1) throw Error('ambiguous or missing accepted HTTP attempt');
    return {status: accepted[0].status, rawResponseSha256: sha256(accepted[0].bytes)};
  }
  const receipt = bindAcceptedAttempt(attempts, '20260724');
  assert.equal(receipt.rawResponseSha256, sha256(attempts[2].bytes));
  assert.notEqual(receipt.rawResponseSha256, sha256(attempts[0].bytes));
  assert.notEqual(receipt.rawResponseSha256, sha256(attempts[1].bytes));
  assert.throws(() => bindAcceptedAttempt(attempts.slice(0, 2), '20260724'),
    /ambiguous or missing accepted HTTP attempt/);
  assert.throws(() => bindAcceptedAttempt([...attempts, {...attempts[2]}], '20260724'),
    /ambiguous or missing accepted HTTP attempt/);
  assert.throws(() => bindAcceptedAttempt([{...attempts[2], url: 'https://example.invalid/?date=20260724'}], '20260724'),
    /ambiguous or missing accepted HTTP attempt/);
  assert.throws(() => bindAcceptedAttempt([{...attempts[2], bytes: Buffer.from('not json')}], '20260724'),
    SyntaxError);
});

test('research-only receipt to Snapshot bytes requires independently pinned digest', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[{"value":1}]}');
  const normalized = Buffer.from(JSON.stringify(JSON.parse(raw.toString('utf8'))));
  const sourceHash = sha256(raw);
  const normalizedHash = sha256(normalized);
  const independentPin = {sourceDate:'20260724', rawResponseSha256:sourceHash,
    normalizedFileSha256:normalizedHash};
  const snapshot = {base_trade_date_compact:'20260724', source_receipt: {...independentPin}};
  function requirePinnedEvidence(record, receipt, originalBytes, normalizedBytes, pin) {
    if (!pin || record.base_trade_date_compact !== pin.sourceDate ||
        receipt.sourceDate !== pin.sourceDate ||
        receipt.rawResponseSha256 !== pin.rawResponseSha256 ||
        receipt.normalizedFileSha256 !== pin.normalizedFileSha256 ||
        sha256(originalBytes) !== pin.rawResponseSha256 ||
        sha256(normalizedBytes) !== pin.normalizedFileSha256 ||
        JSON.stringify(record.source_receipt) !== JSON.stringify(receipt)) {
      throw Error('independent source evidence mismatch');
    }
    return true;
  }
  assert.equal(requirePinnedEvidence(snapshot, independentPin, raw, normalized, independentPin), true);
  const alternate = Buffer.from('{"date":"20260724","tables":[{"value":9}]}');
  const forged = {...independentPin, rawResponseSha256:sha256(alternate)};
  assert.throws(() => requirePinnedEvidence(
    {...snapshot, source_receipt:forged}, forged, alternate, normalized, independentPin),
    /independent source evidence mismatch/,
    'internally consistent substituted receipt must not replace independent source proof');
  assert.throws(() => requirePinnedEvidence(snapshot, independentPin, raw, normalized, null),
    /independent source evidence mismatch/);
  assert.throws(() => requirePinnedEvidence(
    {...snapshot,base_trade_date_compact:'20260723'}, independentPin,raw,normalized,independentPin),
    /independent source evidence mismatch/);
});
