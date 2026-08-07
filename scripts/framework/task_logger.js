'use strict';

function formatSeconds(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function createTaskLogger(options = {}) {
  const label = options.label || 'TASK';
  const write = options.write || console.log;
  if (typeof write !== 'function') throw new TypeError('logger write must be a function');

  return {
    taskStart(event) {
      write(`[${label}] START ${event.taskId} (${event.total} items)`);
    },
    itemStart(event) {
      write(`[${label}] [${event.index}/${event.total}] ${event.itemKey} START`);
    },
    itemRetry(event) {
      write(
        `[${label}] [${event.index}/${event.total}] ${event.itemKey} RETRY ${event.attempt}/${event.maxAttempts}`
        + (event.delayMs > 0 ? ` after ${event.delayMs}ms` : ''),
      );
    },
    itemSkipped(event) {
      write(`[${label}] [${event.index}/${event.total}] ${event.itemKey} SKIPPED`);
    },
    itemDone(event) {
      write(
        `[${label}] [${event.index}/${event.total}] ${event.itemKey} DONE ${formatSeconds(event.elapsedMs)}`,
      );
    },
    itemFailed(event) {
      write(
        `[${label}] [${event.index}/${event.total}] ${event.itemKey} FAILED after ${event.attempts} attempt(s): ${event.error.message}`,
      );
    },
    checkpoint(event) {
      write(
        `[${label}] CHECKPOINT ${event.reason} done=${event.summary.done} skipped=${event.summary.skipped} failed=${event.summary.failed}`,
      );
    },
    taskFinish(event) {
      write(
        `[${label}] FINISH total=${event.summary.total} done=${event.summary.done} skipped=${event.summary.skipped}`
        + ` failed=${event.summary.failed} retries=${event.summary.retries}`
        + ` checkpoints=${event.summary.checkpoints} elapsed=${formatSeconds(event.summary.elapsed_ms)}`,
      );
    },
  };
}

function createNoopLogger() {
  const noop = () => {};
  return {
    taskStart: noop,
    itemStart: noop,
    itemRetry: noop,
    itemSkipped: noop,
    itemDone: noop,
    itemFailed: noop,
    checkpoint: noop,
    taskFinish: noop,
  };
}

module.exports = {
  formatSeconds,
  createTaskLogger,
  createNoopLogger,
};
