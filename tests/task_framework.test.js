'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ITEM_STATES,
  TaskRunError,
  createManifest,
  loadManifest,
  saveManifest,
  setItemRecord,
  runTask,
} = require('../scripts/framework');

function createTempManifest(t, taskId = 'test-task') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-data-task-framework-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    path: path.join(dir, 'manifest.json'),
    taskId,
  };
}

function seedManifest(manifestPath, taskId, itemKey, record) {
  const manifest = createManifest(taskId);
  setItemRecord(manifest, itemKey, record);
  saveManifest(manifestPath, manifest);
}

test('task runner processes and validates items sequentially', async (t) => {
  const fixture = createTempManifest(t);
  const processed = [];

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['202401', '202402'],
    manifestPath: fixture.path,
    logger: false,
    async processItem(item) {
      processed.push(item);
    },
    async validateItem() {
      return { valid: true, metadata: { records: 10 } };
    },
  });

  assert.deepEqual(processed, ['202401', '202402']);
  assert.equal(summary.done, 2);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.items['202401'].status, ITEM_STATES.DONE);

  const manifest = loadManifest(fixture.path, fixture.taskId);
  assert.equal(manifest.items['202401'].status, ITEM_STATES.DONE);
  assert.deepEqual(manifest.items['202401'].metadata, { records: 10 });
});

test('existing valid item is skipped without rewriting an existing done record', async (t) => {
  const fixture = createTempManifest(t);
  seedManifest(fixture.path, fixture.taskId, '202401', {
    status: ITEM_STATES.DONE,
    completed_at: '2026-01-01T00:00:00.000Z',
    validator_version: 1,
  });
  const before = fs.readFileSync(fixture.path, 'utf8');
  let processCalls = 0;

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['202401'],
    manifestPath: fixture.path,
    logger: false,
    async isComplete() {
      return true;
    },
    async processItem() {
      processCalls += 1;
    },
    async validateItem() {
      return true;
    },
  });

  assert.equal(processCalls, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.done, 0);
  assert.equal(summary.items['202401'].status, ITEM_STATES.SKIPPED);
  assert.equal(fs.readFileSync(fixture.path, 'utf8'), before);
});

test('manifest done state does not skip an item when current output is invalid', async (t) => {
  const fixture = createTempManifest(t);
  seedManifest(fixture.path, fixture.taskId, '202401', {
    status: ITEM_STATES.DONE,
    completed_at: '2026-01-01T00:00:00.000Z',
    validator_version: 1,
  });
  let processCalls = 0;

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['202401'],
    manifestPath: fixture.path,
    logger: false,
    async isComplete() {
      return false;
    },
    async processItem() {
      processCalls += 1;
    },
    async validateItem() {
      return true;
    },
  });

  assert.equal(processCalls, 1);
  assert.equal(summary.done, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(loadManifest(fixture.path, fixture.taskId).items['202401'].status, ITEM_STATES.DONE);
});

test('stale transient manifest state does not block a valid existing output', async (t) => {
  const fixture = createTempManifest(t);
  seedManifest(fixture.path, fixture.taskId, '202401', {
    status: ITEM_STATES.RUNNING,
    started_at: '2026-01-01T00:00:00.000Z',
  });
  let processCalls = 0;

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['202401'],
    manifestPath: fixture.path,
    logger: false,
    async isComplete() {
      return { complete: true, metadata: { records: 999 } };
    },
    async processItem() {
      processCalls += 1;
    },
  });

  assert.equal(processCalls, 0);
  assert.equal(summary.skipped, 1);
  const record = loadManifest(fixture.path, fixture.taskId).items['202401'];
  assert.equal(record.status, ITEM_STATES.DONE);
  assert.equal(record.adopted_existing, true);
  assert.deepEqual(record.metadata, { records: 999 });
});

test('retryable failure retries and eventually succeeds', async (t) => {
  const fixture = createTempManifest(t);
  let attempts = 0;

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['202401'],
    manifestPath: fixture.path,
    logger: false,
    retry: {
      maxAttempts: 3,
      baseDelayMs: 0,
      isRetryable: () => true,
    },
    async processItem() {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary network failure');
    },
    async validateItem() {
      return true;
    },
  });

  assert.equal(attempts, 2);
  assert.equal(summary.retries, 1);
  assert.equal(summary.done, 1);
  assert.equal(summary.items['202401'].attempts, 2);
});

test('retry exhaustion records visible failure and rejects with summary', async (t) => {
  const fixture = createTempManifest(t);
  let attempts = 0;
  let caught;

  try {
    await runTask({
      taskId: fixture.taskId,
      items: ['202401'],
      manifestPath: fixture.path,
      logger: false,
      retry: {
        maxAttempts: 3,
        baseDelayMs: 0,
        isRetryable: () => true,
      },
      async processItem() {
        attempts += 1;
        throw new Error('still unavailable');
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof TaskRunError);
  assert.equal(attempts, 3);
  assert.equal(caught.summary.failed, 1);
  assert.equal(caught.summary.retries, 2);
  assert.equal(caught.summary.items['202401'].status, ITEM_STATES.FAILED);
  assert.equal(loadManifest(fixture.path, fixture.taskId).items['202401'].status, ITEM_STATES.FAILED);
});

test('non-retryable failure stops after the first attempt', async (t) => {
  const fixture = createTempManifest(t);
  let attempts = 0;
  let caught;

  try {
    await runTask({
      taskId: fixture.taskId,
      items: ['202401'],
      manifestPath: fixture.path,
      logger: false,
      retry: {
        maxAttempts: 3,
        baseDelayMs: 0,
        isRetryable: () => false,
      },
      async processItem() {
        attempts += 1;
        throw new Error('deterministic failure');
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof TaskRunError);
  assert.equal(attempts, 1);
  assert.equal(caught.summary.retries, 0);
  assert.equal(caught.summary.failed, 1);
});

test('count checkpoint and final partial checkpoint are emitted after validated progress', async (t) => {
  const fixture = createTempManifest(t);
  const checkpoints = [];

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['a', 'b', 'c'],
    manifestPath: fixture.path,
    logger: false,
    checkpoint: { everyItems: 2 },
    hooks: {
      async onCheckpoint(event) {
        checkpoints.push({
          reason: event.reason,
          validated: event.validatedSinceCheckpoint,
        });
      },
    },
    async processItem() {},
    async validateItem() {
      return true;
    },
  });

  assert.deepEqual(checkpoints, [
    { reason: 'count', validated: 2 },
    { reason: 'final', validated: 1 },
  ]);
  assert.equal(summary.checkpoints, 2);
});

test('validated partial progress is checkpointed before a later item failure', async (t) => {
  const fixture = createTempManifest(t);
  const checkpoints = [];
  let caught;

  try {
    await runTask({
      taskId: fixture.taskId,
      items: ['a', 'b', 'c'],
      manifestPath: fixture.path,
      logger: false,
      checkpoint: { everyItems: 3 },
      hooks: {
        async onCheckpoint(event) {
          checkpoints.push({
            reason: event.reason,
            validated: event.validatedSinceCheckpoint,
          });
        },
      },
      async processItem(item) {
        if (item === 'c') throw new Error('late failure');
      },
      async validateItem() {
        return true;
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof TaskRunError);
  assert.deepEqual(checkpoints, [
    { reason: 'before_failure', validated: 2 },
  ]);
  assert.equal(caught.summary.done, 2);
  assert.equal(caught.summary.failed, 1);
});

test('framework works without optional lifecycle hooks', async (t) => {
  const fixture = createTempManifest(t);

  const summary = await runTask({
    taskId: fixture.taskId,
    items: ['only'],
    manifestPath: fixture.path,
    logger: false,
    async processItem() {},
    async validateItem() {
      return true;
    },
  });

  assert.equal(summary.done, 1);
  assert.equal(summary.failed, 0);
});
