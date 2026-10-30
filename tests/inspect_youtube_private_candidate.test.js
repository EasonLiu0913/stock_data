'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {evaluateYouTubeInventory} = require('../scripts/inspect_youtube_private_candidate');
const sha = 'a'.repeat(64);
const valid = () => ({
  observedAtUtc: '2026-10-30T04:00:00Z',
  candidate: {date:'20261008',sha256:sha},
  channel: {items:[{id:'channel-1', contentDetails:{relatedPlaylists:{uploads:'uploads-1'}}}]},
  pages:[{requestPageToken:null,items:[{contentDetails:{videoId:'video-1'}}]}],
  videoPages:[{items:[{id:'video-1',snippet:{channelId:'channel-1',title:'other date'},status:{privacyStatus:'private'}}]}],
  receipt:{status:'absent_verified'}
});
test('even complete inventory cannot authorize upload', () => {
 const r=evaluateYouTubeInventory(valid());
 assert.equal(r.go_no_go,'NO_GO'); assert.ok(r.blockers.includes('absence_not_independently_proven'));
 assert.equal(r.inventory_paginated_to_end,true);
});
test('private existing candidate is blocked', () => {
 const x=valid();x.videoPages[0].items[0].snippet.title='20261008';
 assert.ok(evaluateYouTubeInventory(x).blockers.includes('existing_candidate_do_not_upload'));
});
test('pagination incomplete fails closed', () => {
 const x=valid();x.pages[0].nextPageToken='next';
 assert.ok(evaluateYouTubeInventory(x).blockers.includes('pagination_incomplete'));
});
test('unknown privacy fails closed', () => {
 const x=valid();x.videoPages[0].items[0].status.privacyStatus='unknown';
 assert.ok(evaluateYouTubeInventory(x).blockers.includes('invalid_video_readback'));
});
test('invalid channel, missing token evidence, or missing readback fail closed', () => {
 const x=valid();x.channel=null;x.videoPages=null;x.receipt=null;
 const r=evaluateYouTubeInventory(x);
 assert.ok(r.blockers.includes('unverified_channel'));
 assert.ok(r.blockers.includes('missing_video_readback'));
 assert.ok(r.blockers.includes('receipt_unreconciled'));
});
test('candidate and result contain no credentials or upload permission', () => {
 const r=evaluateYouTubeInventory(valid());
 assert.equal(JSON.stringify(r).includes('Bearer'),false);
 assert.equal(Object.hasOwn(r,'upload_authorized'),false);
 assert.equal(r.captions_check.status,'not_authorized');
});
test('source is entirely offline with no transport', () => {
 const fs=require('node:fs');
 const src=fs.readFileSync(require.resolve('../scripts/inspect_youtube_private_candidate'),'utf8');
 assert.doesNotMatch(src,/\\bfetch\\s*\\(|https?:\\/\\/|\\bPOST\\b|\\bPUT\\b|\\bPATCH\\b|\\bDELETE\\b/);
});
