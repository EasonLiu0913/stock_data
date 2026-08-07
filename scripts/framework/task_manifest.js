'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_SCHEMA_VERSION = 1;

function assertTaskId(taskId) {
  if (typeof taskId !== 'string' || taskId.trim() === '') {
    throw new TypeError('taskId must be a non-empty string');
  }
}

function createManifest(taskId) {
  assertTaskId(taskId);
  const now = new Date().toISOString();
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    task_id: taskId,
    created_at: now,
    updated_at: now,
    items: {},
  };
}

function validateManifest(manifest, taskId) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Task manifest must be a JSON object');
  }
  if (manifest.schema_version !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported task manifest schema_version: ${manifest.schema_version}; expected ${MANIFEST_SCHEMA_VERSION}`,
    );
  }
  if (manifest.task_id !== taskId) {
    throw new Error(`Task manifest task_id mismatch: ${manifest.task_id} !== ${taskId}`);
  }
  if (!manifest.items || typeof manifest.items !== 'object' || Array.isArray(manifest.items)) {
    throw new Error('Task manifest items must be an object');
  }
  return manifest;
}

function loadManifest(filePath, taskId) {
  assertTaskId(taskId);
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('manifestPath must be a non-empty string');
  }
  if (!fs.existsSync(filePath)) {
    return createManifest(taskId);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return validateManifest(parsed, taskId);
}

function saveManifest(filePath, manifest) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('manifestPath must be a non-empty string');
  }
  validateManifest(manifest, manifest.task_id);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  manifest.updated_at = new Date().toISOString();
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function getItemRecord(manifest, itemKey) {
  return manifest.items[String(itemKey)] || null;
}

function setItemRecord(manifest, itemKey, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Task manifest item record must be an object');
  }
  manifest.items[String(itemKey)] = { ...record };
  return manifest.items[String(itemKey)];
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  createManifest,
  validateManifest,
  loadManifest,
  saveManifest,
  getItemRecord,
  setItemRecord,
};
