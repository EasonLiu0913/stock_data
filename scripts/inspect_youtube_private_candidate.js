'use strict';
// Research-only pure evaluator. No credential handling, network access, upload or CLI side effects.
const EXPECTED_DATE = '20261008';
function evaluateYouTubeInventory({channel, pages, videoPages, receipt, candidate, observedAtUtc} = {}) {
  const blockers = [];
  const result = {
    schema_version: 'mvp10.youtube.inspection.v1',
    target_date: EXPECTED_DATE,
    artifact_id: '12953454424',
    render_run_id: '41002179152',
    artifact_sha256: candidate?.sha256 || null,
    observed_at_utc: observedAtUtc || null,
    oauth_scope_class: 'youtube.readonly',
    channel_id: null,
    channel_match_confirmed: false,
    uploads_playlist_id: null,
    inventory_paginated_to_end: false,
    inventory_count: null,
    candidate_video_ids: [],
    candidate_match_explanations: [],
    video_readbacks: [],
    receipt_lookup_status: receipt?.status || 'not_checked',
    receipt_video_id: receipt?.videoId || null,
    captions_check: {status: 'not_authorized', required_scope: 'youtube.force-ssl', track_id: null, language: null, track_status: null},
    duplicate_video_decision: 'blocked',
    go_no_go: 'NO_GO',
    blockers
  };
  const fail = (code) => { if (!blockers.includes(code)) blockers.push(code); };
  if (!candidate || candidate.date !== EXPECTED_DATE || !/^[a-f0-9]{64}$/i.test(candidate.sha256 || '')) fail('invalid_candidate_identity');
  if (!observedAtUtc || !Number.isFinite(Date.parse(observedAtUtc))) fail('missing_observation_time');
  if (!channel || !Array.isArray(channel.items) || channel.items.length !== 1) fail('unverified_channel');
  else {
    const c = channel.items[0];
    const id = c?.id;
    const uploads = c?.contentDetails?.relatedPlaylists?.uploads;
    if (typeof id !== 'string' || !id || typeof uploads !== 'string' || !uploads) fail('invalid_channel_response');
    else { result.channel_id = id; result.uploads_playlist_id = uploads; result.channel_match_confirmed = true; }
  }
  if (!Array.isArray(pages) || pages.length < 1) fail('missing_inventory');
  else {
    const seenTokens = new Set();
    let expected = null;
    let count = 0;
    const ids = new Set();
    for (const page of pages) {
      if (!page || !Array.isArray(page.items) || (page.requestPageToken || null) !== expected) { fail('pagination_incomplete'); break; }
      for (const item of page.items) {
        const id = item?.contentDetails?.videoId;
        if (typeof id !== 'string' || !id) { fail('invalid_inventory_item'); continue; }
        ids.add(id); count++;
      }
      const next = page.nextPageToken || null;
      if (!next) { expected = null; result.inventory_paginated_to_end = true; break; }
      if (seenTokens.has(next)) { fail('pagination_loop'); break; }
      seenTokens.add(next);
      expected = next;
    }
    if (expected || pages.length && pages[pages.length - 1]?.nextPageToken) fail('pagination_incomplete');
    result.inventory_count = count;
    result._all_ids = [...ids];
  }
  const ids = result._all_ids || [];
  delete result._all_ids;
  if (!Array.isArray(videoPages)) fail('missing_video_readback');
  else {
    const found = new Map();
    for (const v of videoPages.flatMap(p => Array.isArray(p?.items) ? p.items : [])) {
      if (!v || !ids.includes(v.id) || v.snippet?.channelId !== result.channel_id ||
          !['private','unlisted','public'].includes(v.status?.privacyStatus)) { fail('invalid_video_readback'); continue; }
      found.set(v.id, v);
    }
    if (found.size !== ids.length) fail('incomplete_video_readback');
    for (const [id,v] of found) {
      const title = String(v.snippet.title || '');
      const matches = title.includes(EXPECTED_DATE) || (receipt?.videoId === id);
      if (matches) {
        result.candidate_video_ids.push(id);
        result.candidate_match_explanations.push({video_id:id, basis: receipt?.videoId === id ? 'receipt_id' : 'title_date'});
        result.video_readbacks.push({video_id:id, channel_id:result.channel_id, privacy_status:v.status.privacyStatus});
      }
    }
  }
  if (!receipt || !['found','absent_verified'].includes(receipt.status)) fail('receipt_unreconciled');
  if (result.candidate_video_ids.length > 1) fail('ambiguous_candidates');
  if (result.candidate_video_ids.length > 0) fail('existing_candidate_do_not_upload');
  // An empty listing never constitutes proof that a video was not uploaded elsewhere.
  if (result.candidate_video_ids.length === 0) fail('absence_not_independently_proven');
  if (!result.inventory_paginated_to_end) fail('inventory_incomplete');
  if (blockers.length === 0) fail('owner_approval_still_required');
  return result;
}
module.exports = {evaluateYouTubeInventory};
