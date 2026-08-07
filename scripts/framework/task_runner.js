'use strict';

const {
  loadManifest,
  saveManifest,
  getItemRecord,
  setItemRecord,
} = require('./task_manifest');
const { runWithRetry } = require('./task_retry');
const { createTaskLogger, createNoopLogger } = require('./task_logger');

const ITEM_STATES = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  RETRY_WAIT: 'retry_wait',
  VALIDATING: 'validating',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

class TaskValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'TaskValidationError';
    this.details = details;
  }
}

class TaskRunError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'TaskRunError';
    this.taskId = options.taskId;
    this.itemKey = options.itemKey || null;
    this.summary = options.summary || null;
  }
}

function assertFunction(value, name, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${name} must be a function`);
    return;
  }
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
}

function normalizeCheckpointEvery(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('checkpoint.everyItems must be a positive integer');
  }
  return value;
}

function normalizeCompletionResult(result) {
  if (typeof result === 'boolean') return { complete: result, metadata: null };
  if (result && typeof result === 'object' && !Array.isArray(result) && typeof result.complete === 'boolean') {
    return { complete: result.complete, metadata: result.metadata || null };
  }
  throw new TypeError('isComplete must return a boolean or { complete, metadata? }');
}

function normalizeValidationResult(result) {
  if (typeof result === 'boolean') return { valid: result, metadata: null };
  if (result && typeof result === 'object' && !Array.isArray(result) && typeof result.valid === 'boolean') {
    return { valid: result.valid, metadata: result.metadata || null };
  }
  throw new TypeError('validateItem must return a boolean or { valid, metadata? }');
}

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
  };
}

function resolveLogger(taskId, loggerOption) {
  if (loggerOption === false) return createNoopLogger();
  if (loggerOption && typeof loggerOption === 'object') return loggerOption;
  return createTaskLogger({ label: taskId });
}

async function callHook(hooks, name, event) {
  const hook = hooks?.[name];
  if (hook === undefined) return;
  if (typeof hook !== 'function') throw new TypeError(`hooks.${name} must be a function`);
  await hook(event);
}

function makeRunId(taskId) {
  return `${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function runTask(options = {}) {
  const {
    taskId,
    items,
    manifestPath,
    processItem,
    isComplete,
    validateItem,
    getItemKey = (item) => String(item),
    retry = {},
    checkpoint = {},
    hooks = {},
    force = false,
    validatorVersion = 1,
  } = options;

  if (typeof taskId !== 'string' || taskId.trim() === '') {
    throw new TypeError('taskId must be a non-empty string');
  }
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (typeof manifestPath !== 'string' || manifestPath.trim() === '') {
    throw new TypeError('manifestPath must be a non-empty string');
  }
  assertFunction(processItem, 'processItem', true);
  assertFunction(isComplete, 'isComplete');
  assertFunction(validateItem, 'validateItem');
  assertFunction(getItemKey, 'getItemKey', true);

  const itemEntries = items.map((item, index) => ({
    item,
    index: index + 1,
    key: String(getItemKey(item)),
  }));
  const seenKeys = new Set();
  for (const entry of itemEntries) {
    if (entry.key === '') throw new Error('Task item key must not be empty');
    if (seenKeys.has(entry.key)) throw new Error(`Duplicate task item key: ${entry.key}`);
    seenKeys.add(entry.key);
  }

  const checkpointEvery = normalizeCheckpointEvery(checkpoint.everyItems);
  const manifest = loadManifest(manifestPath, taskId);
  const logger = resolveLogger(taskId, options.logger);
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const runId = options.runId || makeRunId(taskId);

  const summary = {
    task_id: taskId,
    run_id: runId,
    started_at: startedAt,
    ended_at: null,
    elapsed_ms: 0,
    total: itemEntries.length,
    done: 0,
    skipped: 0,
    failed: 0,
    retries: 0,
    checkpoints: 0,
    items: {},
  };

  for (const entry of itemEntries) {
    summary.items[entry.key] = {
      status: ITEM_STATES.PENDING,
      attempts: 0,
    };
  }

  let checkpointProgress = 0;
  let activeEntry = null;

  function baseEvent(entry, extra = {}) {
    return {
      taskId,
      runId,
      item: entry?.item,
      itemKey: entry?.key,
      index: entry?.index,
      total: itemEntries.length,
      manifestPath,
      ...extra,
    };
  }

  async function persistManifest() {
    saveManifest(manifestPath, manifest);
  }

  async function emitCheckpoint(reason) {
    if (checkpointProgress <= 0) return;
    const event = {
      taskId,
      runId,
      reason,
      validatedSinceCheckpoint: checkpointProgress,
      manifestPath,
      summary,
    };
    try {
      await callHook(hooks, 'onCheckpoint', event);
      summary.checkpoints += 1;
      logger.checkpoint({ ...event, summary });
      checkpointProgress = 0;
    } catch (error) {
      try {
        error.task_checkpoint_failure = true;
      } catch (_) {
        // Preserve the original hook error when it cannot be extended.
      }
      throw error;
    }
  }

  async function finish(error = null) {
    const endedMs = Date.now();
    summary.ended_at = new Date(endedMs).toISOString();
    summary.elapsed_ms = endedMs - startedMs;
    const event = { taskId, runId, summary, error };
    logger.taskFinish(event);
    await callHook(hooks, 'onTaskFinish', event);
  }

  logger.taskStart({ taskId, runId, total: itemEntries.length });
  await callHook(hooks, 'onTaskStart', { taskId, runId, total: itemEntries.length, manifestPath });

  try {
    for (const entry of itemEntries) {
      activeEntry = entry;
      const itemSummary = summary.items[entry.key];
      const previousRecord = getItemRecord(manifest, entry.key);

      if (!force && isComplete) {
        const completion = normalizeCompletionResult(await isComplete(entry.item, baseEvent(entry, {
          manifestRecord: previousRecord,
        })));
        if (completion.complete) {
          itemSummary.status = ITEM_STATES.SKIPPED;
          summary.skipped += 1;

          let adoptedProgress = false;
          if (!previousRecord || previousRecord.status !== ITEM_STATES.DONE) {
            setItemRecord(manifest, entry.key, {
              status: ITEM_STATES.DONE,
              completed_at: new Date().toISOString(),
              validator_version: validatorVersion,
              adopted_existing: true,
              ...(completion.metadata ? { metadata: completion.metadata } : {}),
            });
            await persistManifest();
            checkpointProgress += 1;
            adoptedProgress = true;
          }

          const event = baseEvent(entry, {
            status: ITEM_STATES.SKIPPED,
            manifestRecord: getItemRecord(manifest, entry.key),
            adoptedProgress,
          });
          logger.itemSkipped(event);
          await callHook(hooks, 'onItemDone', event);

          if (checkpointEvery > 0 && checkpointProgress >= checkpointEvery) {
            await emitCheckpoint('count');
          }
          continue;
        }
      }

      const itemStartedMs = Date.now();
      itemSummary.status = ITEM_STATES.RUNNING;
      logger.itemStart(baseEvent(entry));
      await callHook(hooks, 'onItemStart', baseEvent(entry));

      let validationMetadata = null;
      let attempts = 0;

      try {
        await runWithRetry(async (attempt) => {
          attempts = attempt;
          itemSummary.attempts = attempt;
          itemSummary.status = ITEM_STATES.RUNNING;

          await processItem(entry.item, baseEvent(entry, { attempt }));

          itemSummary.status = ITEM_STATES.VALIDATING;
          if (validateItem) {
            const validation = normalizeValidationResult(
              await validateItem(entry.item, baseEvent(entry, { attempt })),
            );
            validationMetadata = validation.metadata;
            if (!validation.valid) {
              throw new TaskValidationError(`Validation failed for task item ${entry.key}`, validation.metadata);
            }
          }
        }, {
          maxAttempts: retry.maxAttempts,
          baseDelayMs: retry.baseDelayMs,
          maxDelayMs: retry.maxDelayMs,
          sleepFn: retry.sleepFn,
          isRetryable: async (error, attempt) => {
            if (retry.isRetryable) {
              return retry.isRetryable(error, baseEvent(entry, { attempt }));
            }
            return !(error instanceof TaskValidationError);
          },
          onRetry: async ({ error, attempt, nextAttempt, delayMs, maxAttempts }) => {
            summary.retries += 1;
            itemSummary.status = ITEM_STATES.RETRY_WAIT;
            const event = baseEvent(entry, {
              error,
              attempt,
              nextAttempt,
              delayMs,
              maxAttempts,
            });
            logger.itemRetry(event);
            await callHook(hooks, 'onItemRetry', event);
          },
        });
      } catch (error) {
        itemSummary.status = ITEM_STATES.FAILED;
        itemSummary.attempts = error.task_attempts || attempts;
        itemSummary.error = serializeError(error);
        summary.failed += 1;

        setItemRecord(manifest, entry.key, {
          status: ITEM_STATES.FAILED,
          failed_at: new Date().toISOString(),
          attempts: itemSummary.attempts,
          error: serializeError(error),
        });
        await persistManifest();

        logger.itemFailed(baseEvent(entry, {
          error,
          attempts: itemSummary.attempts,
        }));
        throw error;
      }

      itemSummary.status = ITEM_STATES.DONE;
      itemSummary.attempts = attempts;
      summary.done += 1;
      checkpointProgress += 1;

      setItemRecord(manifest, entry.key, {
        status: ITEM_STATES.DONE,
        completed_at: new Date().toISOString(),
        attempts,
        validator_version: validatorVersion,
        ...(validationMetadata ? { metadata: validationMetadata } : {}),
      });
      await persistManifest();

      const doneEvent = baseEvent(entry, {
        status: ITEM_STATES.DONE,
        attempts,
        elapsedMs: Date.now() - itemStartedMs,
        metadata: validationMetadata,
      });
      logger.itemDone(doneEvent);
      await callHook(hooks, 'onItemDone', doneEvent);

      if (checkpointEvery > 0 && checkpointProgress >= checkpointEvery) {
        await emitCheckpoint('count');
      }
    }

    if (checkpointProgress > 0) await emitCheckpoint('final');
    await finish();
    return summary;
  } catch (error) {
    if (checkpointProgress > 0 && !error.task_checkpoint_failure) {
      try {
        await emitCheckpoint('before_failure');
      } catch (checkpointError) {
        checkpointError.cause = checkpointError.cause || error;
        error = checkpointError;
      }
    }

    await finish(error);
    throw new TaskRunError(
      `Task ${taskId} failed${activeEntry ? ` at item ${activeEntry.key}` : ''}: ${error.message}`,
      {
        cause: error,
        taskId,
        itemKey: activeEntry?.key,
        summary,
      },
    );
  }
}

module.exports = {
  ITEM_STATES,
  TaskValidationError,
  TaskRunError,
  runTask,
};
