'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { hashFreezePayload } = require('../freeze_institutional_accumulation_development_sample');

const SOURCE_PATH = 'data_history_sma/1213.json';
const FREEZE_DIR = 'data_research/institutional-flow';
const VERSIONS = Object.freeze({
  v1: Object.freeze({
    freezePath: `${FREEZE_DIR}/institutional-accumulation-development-sample-freeze-v1.json`,
    freezeBlob: '4215a84a110406714e200618d280b70d0d1e7f46',
    semanticSha256: '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b',
    sourceCommit: '01d79c2ed2d6b5b78d5875a06e319b1f20dd480a',
    sourceBlob: 'dc52d8eb2ec32dd57606b6dc1a0c4a904d4e8346',
    sourceSha256: 'b5951a9a69a3f915a7d69e07851631ec41e06a58c12321ce8008e044ac4097f3',
  }),
  v2: Object.freeze({
    freezePath: `${FREEZE_DIR}/institutional-accumulation-development-sample-freeze-v2.json`,
    freezeBlob: '6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96',
    semanticSha256: '4ffa70f518bf4c94c61630d09ee8e9cb6e37fb0eb98edc1bec828f151ba566ea',
    sourceCommit: 'fdbe6e0bfaa193626aa1197bcba52e5be49e5236',
    sourceBlob: '74e5f719416999acdd7397af3c5196078bd2f992',
    sourceSha256: '641afb37313090d5090329d3fc0ff8a8c02bb22a4b593da9c568a525b517d6f4',
  }),
});

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

function gitShowMany(root, commit, relativePaths) {
  const uniquePaths = [...new Set(relativePaths)];
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: Buffer.from(uniquePaths.map(relativePath => `${commit}:${relativePath}\n`).join('')),
    encoding: 'buffer',
    maxBuffer: 128 * 1024 * 1024,
  });
  const result = new Map();
  let offset = 0;
  for (const relativePath of uniquePaths) {
    const lineEnd = output.indexOf(0x0a, offset);
    if (lineEnd < 0) throw new Error(`Missing git object header for ${relativePath}`);
    const [blob, type, sizeText] = output.subarray(offset, lineEnd).toString('utf8').split(' ');
    if (!blob || type !== 'blob' || !/^\d+$/.test(sizeText || '')) throw new Error(`Missing pinned source object: ${relativePath}`);
    const size = Number(sizeText);
    const start = lineEnd + 1;
    const end = start + size;
    if (end > output.length || output[end] !== 0x0a) throw new Error(`Truncated git object: ${relativePath}`);
    result.set(relativePath, { blob, bytes: output.subarray(start, end) });
    offset = end + 1;
  }
  return result;
}

function assertSourceIdentity(version, identity) {
  const expected = VERSIONS[version];
  if (!expected) throw new Error(`Unsupported freeze version: ${version}`);
  if (identity.commit !== expected.sourceCommit || identity.blob !== expected.sourceBlob) {
    throw new Error(`${version} source identity mismatch; refusing source substitution`);
  }
  return expected;
}

function resolveFreezeVersion(version, options = {}) {
  const expected = VERSIONS[version];
  if (!expected) throw new Error(`Unsupported freeze version: ${version}`);
  const root = path.resolve(options.root || path.resolve(__dirname, '../..'));
  assertSourceIdentity(version, options.sourceIdentity || { commit: expected.sourceCommit, blob: expected.sourceBlob });
  const file = path.join(root, expected.freezePath);
  const freezeBytes = fs.readFileSync(file);
  const freezeBlob = gitBlobSha(freezeBytes);
  if (freezeBlob !== expected.freezeBlob) throw new Error(`${version} freeze blob mismatch`);
  const payload = JSON.parse(freezeBytes.toString('utf8'));
  if (hashFreezePayload(payload) !== expected.semanticSha256 || payload.content_sha256 !== expected.semanticSha256) {
    throw new Error(`${version} semantic freeze hash mismatch`);
  }
  const sourceRecord = gitShowMany(root, expected.sourceCommit, [SOURCE_PATH]).get(SOURCE_PATH);
  const sourceBytes = sourceRecord.bytes;
  if (sourceRecord.blob !== expected.sourceBlob || gitBlobSha(sourceBytes) !== expected.sourceBlob || sha256(sourceBytes) !== expected.sourceSha256) {
    throw new Error(`${version} pinned source bytes mismatch`);
  }
  if (payload.source_file_sha256?.[SOURCE_PATH] !== expected.sourceSha256) {
    throw new Error(`${version} freeze does not pin the registered source bytes`);
  }
  return { version, payload, sourceBytes, sourceIdentity: { commit: expected.sourceCommit, blob: expected.sourceBlob } };
}

module.exports = { SOURCE_PATH, VERSIONS, assertSourceIdentity, gitBlobSha, resolveFreezeVersion, sha256 };
