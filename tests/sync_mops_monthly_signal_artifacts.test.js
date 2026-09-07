'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  artifactNeedsRefresh,
  sourceRevision,
} = require('../scripts/sync_mops_monthly_signal_artifacts');

function payload({
  month = '202608',
  lastCollectedAt = '2026-09-02T01:00:00+08:00',
  companyCount = 1,
  companies = [{
    stock_code: '2402',
    monthly_revenue_thousand_twd: 100,
    yoy_pct: 10,
    mom_pct: 2,
    first_seen_at: '2026-09-01T20:00:00+08:00',
    last_seen_at: '2026-09-02T01:00:00+08:00',
  }],
} = {}) {
  return {
    revenue_month: month,
    source: {
      sha256: 'source-sha',
      report_date: '20260902',
    },
    collection: {
      last_collected_at: lastCollectedAt,
      company_count: companyCount,
    },
    companies,
  };
}

test('legacy artifact is stale when source collection advanced after generation', () => {
  const current = payload({
    lastCollectedAt: '2026-09-06T22:13:56+08:00',
    companyCount: 2,
    companies: [
      {
        stock_code: '2402',
        monthly_revenue_thousand_twd: 100,
        yoy_pct: 10,
        mom_pct: 2,
        first_seen_at: '2026-09-01T20:00:00+08:00',
        last_seen_at: '2026-09-06T22:13:56+08:00',
      },
      {
        stock_code: '8021',
        monthly_revenue_thousand_twd: 770701,
        yoy_pct: 97.75,
        mom_pct: 5.5,
        first_seen_at: '2026-09-04T22:59:22+08:00',
        last_seen_at: '2026-09-06T22:13:56+08:00',
      },
    ],
  });
  const previous = payload({
    month: '202607',
    lastCollectedAt: '2026-08-15T23:50:15+08:00',
  });
  const artifact = {
    generated_at: '2026-09-02T01:40:25.253Z',
    events: [{ stock_code: '2402' }],
  };

  assert.equal(artifactNeedsRefresh(artifact, current, previous), true);
});

test('artifact with matching source revisions remains fresh', () => {
  const current = payload();
  const previous = payload({ month: '202607', lastCollectedAt: '2026-08-15T23:50:15+08:00' });
  const artifact = {
    generated_at: '2026-09-07T00:00:00.000Z',
    source_revision: sourceRevision(current),
    previous_source_revision: sourceRevision(previous),
    events: [],
  };

  assert.equal(artifactNeedsRefresh(artifact, current, previous), false);
});

test('artifact refreshes when source content changes even if timestamps do not', () => {
  const current = payload();
  const previous = payload({ month: '202607', lastCollectedAt: '2026-08-15T23:50:15+08:00' });
  const artifact = {
    generated_at: '2026-09-07T00:00:00.000Z',
    source_revision: sourceRevision(current),
    previous_source_revision: sourceRevision(previous),
    events: [],
  };
  const changed = payload({
    companies: [{
      stock_code: '8021',
      monthly_revenue_thousand_twd: 770701,
      yoy_pct: 97.75,
      mom_pct: 5.5,
      first_seen_at: '2026-09-04T22:59:22+08:00',
      last_seen_at: '2026-09-06T22:13:56+08:00',
    }],
  });

  assert.equal(artifactNeedsRefresh(artifact, changed, previous), true);
});
