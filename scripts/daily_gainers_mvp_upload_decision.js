'use strict';

// Pure decision gate for research MVP. No network, secrets or side effects.
// A missing receipt is NOT proof that YouTube did not create a video.
// Only a separately verified absence may permit first upload.
function decide({receipt, verifiedAbsence = false, authorized = false, fixtureDryRun = false}) {
  if (!authorized) return {action:'blocked', reason:'owner_private_pilot_authorization_required'};
  if (receipt !== null && receipt !== undefined) {
    if (receipt?.fixture_only === true && !fixtureDryRun) return {action:'blocked', reason:'synthetic_receipt_not_valid_for_upload'};
    if (typeof receipt !== 'object' || !/^[A-Za-z0-9_-]{8,}$/.test(receipt.youtube_video_id || '') ||
        receipt.privacy !== 'private') {
      return {action:'blocked', reason:'invalid_or_untrusted_receipt'};
    }
    if (receipt.upload_status === 'complete') return {action:'already_uploaded', videoId:receipt.youtube_video_id};
    if (receipt.upload_status === 'video_created') return {action:'captions_only', videoId:receipt.youtube_video_id};
    return {action:'blocked', reason:'unknown_receipt_status'};
  }
  if (!verifiedAbsence) return {action:'blocked', reason:'unknown_upload_state_reconcile_youtube_first'};
  return {action:'first_upload', reason:'verified_absence_and_owner_authorized'};
}
module.exports = {decide};
