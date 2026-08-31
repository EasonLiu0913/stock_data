'use strict';

const DATE_RE = /^(\d{2})\/(\d{2})$/;

function parseAnchor(anchorValue) {
  const anchor = new Date(anchorValue);
  if (Number.isNaN(anchor.getTime())) throw new Error(`Invalid Fubon date anchor: ${anchorValue}`);
  return anchor;
}

function validCandidate(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return candidate;
}

function resolveFubonRankingDate(pageDate, anchorValue) {
  const match = String(pageDate || '').trim().match(DATE_RE);
  if (!match) throw new Error(`Missing or malformed Fubon source page date: ${pageDate || 'null'}`);

  const month = Number(match[1]);
  const day = Number(match[2]);
  const anchor = parseAnchor(anchorValue);
  const anchorYear = anchor.getUTCFullYear();
  const candidates = [anchorYear - 1, anchorYear, anchorYear + 1]
    .map((year) => validCandidate(year, month, day))
    .filter(Boolean)
    .sort((left, right) => {
      const distance = Math.abs(left.getTime() - anchor.getTime()) - Math.abs(right.getTime() - anchor.getTime());
      if (distance !== 0) return distance;
      return left.getTime() - right.getTime();
    });

  if (!candidates.length) throw new Error(`Invalid Fubon source page date: ${pageDate}`);
  const selected = candidates[0];
  return selected.toISOString().slice(0, 10).replaceAll('-', '');
}

function requiredAnchorFromEnv(env = process.env) {
  const value = String(env.FUBON_DATE_ANCHOR || '').trim();
  if (!value) throw new Error('FUBON_DATE_ANCHOR is required; scheduled runs must pass the intended occurrence timestamp.');
  return value;
}

module.exports = { resolveFubonRankingDate, requiredAnchorFromEnv };
