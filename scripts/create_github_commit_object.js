#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const https = require('node:https');
const { execFileSync } = require('node:child_process');

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function requestJson(method, path, body) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}${path}`,
      method,
      headers: {
        'User-Agent': 'stock-data-commit-object-builder',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        if ((res.statusCode || 500) >= 300) {
          reject(new Error(`GitHub API ${method} ${path} failed: ${res.statusCode} ${text}`));
          return;
        }
        try { resolve(text ? JSON.parse(text) : {}); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const message = process.argv.slice(2).join(' ') || 'perf: make workflow schedule summaries lightweight';
  const baseSha = git('rev-parse', 'HEAD');
  const baseTree = git('rev-parse', 'HEAD^{tree}');
  const changed = git('diff', '--name-only', '--', '.github/workflows')
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (!changed.length) {
    console.log('NO_CHANGES=true');
    return;
  }

  const tree = [];
  for (const path of changed) {
    const content = fs.readFileSync(path, 'utf8');
    const blob = await requestJson('POST', '/git/blobs', { content, encoding: 'utf-8' });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const treeObject = await requestJson('POST', '/git/trees', { base_tree: baseTree, tree });
  const commit = await requestJson('POST', '/git/commits', {
    message,
    tree: treeObject.sha,
    parents: [baseSha],
  });

  console.log(`BASE_COMMIT=${baseSha}`);
  console.log(`CHANGED_WORKFLOWS=${changed.length}`);
  console.log(`NORMALIZATION_COMMIT=${commit.sha}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
