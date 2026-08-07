'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositiveInteger(value, fallback, name) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function normalizeNonNegativeNumber(value, fallback, name) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative number`);
  }
  return value;
}

function retryDelayMs(attempt, baseDelayMs, maxDelayMs) {
  if (baseDelayMs <= 0) return 0;
  const delay = baseDelayMs * (2 ** Math.max(0, attempt - 1));
  return Math.min(delay, maxDelayMs);
}

async function runWithRetry(operation, options = {}) {
  if (typeof operation !== 'function') {
    throw new TypeError('retry operation must be a function');
  }

  const maxAttempts = normalizePositiveInteger(options.maxAttempts, 1, 'maxAttempts');
  const baseDelayMs = normalizeNonNegativeNumber(options.baseDelayMs, 0, 'baseDelayMs');
  const maxDelayMs = normalizeNonNegativeNumber(
    options.maxDelayMs,
    Math.max(baseDelayMs, 30000),
    'maxDelayMs',
  );
  const isRetryable = options.isRetryable || (() => true);
  const onRetry = options.onRetry || (async () => {});
  const sleepFn = options.sleepFn || sleep;

  if (typeof isRetryable !== 'function') throw new TypeError('isRetryable must be a function');
  if (typeof onRetry !== 'function') throw new TypeError('onRetry must be a function');
  if (typeof sleepFn !== 'function') throw new TypeError('sleepFn must be a function');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt, retries: attempt - 1 };
    } catch (error) {
      const retryable = attempt < maxAttempts && await isRetryable(error, attempt);
      if (!retryable) {
        try {
          error.task_attempts = attempt;
        } catch (_) {
          // The original error remains authoritative even when it is non-extensible.
        }
        throw error;
      }

      const delayMs = retryDelayMs(attempt, baseDelayMs, maxDelayMs);
      await onRetry({ error, attempt, nextAttempt: attempt + 1, delayMs, maxAttempts });
      if (delayMs > 0) await sleepFn(delayMs);
    }
  }

  throw new Error('Retry loop ended unexpectedly');
}

module.exports = {
  sleep,
  retryDelayMs,
  runWithRetry,
};
