#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function normalizeSecret(name, raw) {
  let value = String(raw ?? '').trim();
  const prefix = `${name}=`;
  if (value.startsWith(prefix)) value = value.slice(prefix.length).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
     (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/\\r|\\n/g, '').trim();
}

const YOUTUBE_CLIENT_ID = normalizeSecret('YOUTUBE_CLIENT_ID', process.env.YOUTUBE_CLIENT_ID);
const YOUTUBE_CLIENT_SECRET = normalizeSecret('YOUTUBE_CLIENT_SECRET', process.env.YOUTUBE_CLIENT_SECRET);
const YOUTUBE_REFRESH_TOKEN = normalizeSecret('YOUTUBE_REFRESH_TOKEN', process.env.YOUTUBE_REFRESH_TOKEN);

for (const [name, value] of Object.entries({YOUTUBE_CLIENT_ID,YOUTUBE_CLIENT_SECRET,YOUTUBE_REFRESH_TOKEN})) {
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const videoId = String(process.argv[2] || '').trim();
const subtitleArg = process.argv[3];
const language = String(process.argv[4] || 'zh-TW').trim();
const trackName = String(process.argv[5] || '繁體中文').trim();

if (!videoId || !subtitleArg) {
  console.error('Usage: node scripts/upload_youtube_caption.js <video-id> <captions.srt> [language] [track-name]');
  process.exit(1);
}

const subtitlePath = path.resolve(subtitleArg);
if (!fs.existsSync(subtitlePath)) throw new Error(`Missing subtitle file: ${subtitlePath}`);
const subtitle = fs.readFileSync(subtitlePath, 'utf8');
if (!subtitle.trim()) throw new Error(`Subtitle file is empty: ${subtitlePath}`);

function fingerprint(value) {
  return crypto.createHmac('sha256', 'daily-gainers-youtube-oauth-v1').update(value).digest('hex').slice(0, 16);
}

console.log('Caption OAuth diagnostics:', JSON.stringify({
  client_id_length: YOUTUBE_CLIENT_ID.length,
  client_secret_length: YOUTUBE_CLIENT_SECRET.length,
  refresh_token_length: YOUTUBE_REFRESH_TOKEN.length,
  client_secret_fingerprint: fingerprint(YOUTUBE_CLIENT_SECRET),
  refresh_token_fingerprint: fingerprint(YOUTUBE_REFRESH_TOKEN),
}));

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    client_secret: YOUTUBE_CLIENT_SECRET,
    refresh_token: YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`OAuth refresh failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function uploadCaption(accessToken) {
  const boundary = `daily-gainers-caption-${crypto.randomBytes(12).toString('hex')}`;
  const metadata = JSON.stringify({
    snippet: {
      videoId,
      language,
      name: trackName,
      isDraft: false,
    },
  });
  const head =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/octet-stream\r\n' +
    `Content-Disposition: attachment; filename="${path.basename(subtitlePath)}"\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(head, 'utf8'),
    Buffer.from(subtitle, 'utf8'),
    Buffer.from(tail, 'utf8'),
  ]);

  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  );
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {raw:text}; }

  if (response.status === 409 && JSON.stringify(data).includes('captionExists')) {
    return { already_exists: true, response: data };
  }
  if (!response.ok) {
    const hint = response.status === 403
      ? ' The refresh token must include https://www.googleapis.com/auth/youtube.force-ssl.'
      : '';
    throw new Error(`Caption upload failed: HTTP ${response.status} ${text}.${hint}`);
  }
  return { already_exists: false, response: data };
}

(async () => {
  const accessToken = await getAccessToken();
  console.log('OAuth access token: PASS');
  const uploaded = await uploadCaption(accessToken);
  const result = {
    video_id: videoId,
    language,
    track_name: trackName,
    caption_id: uploaded.response?.id || null,
    already_exists: uploaded.already_exists,
    subtitle_file: subtitlePath,
  };
  console.log('YOUTUBE_CAPTION_RESULT=' + JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `caption_id=${result.caption_id || ''}\nlanguage=${language}\nalready_exists=${result.already_exists}\n`);
  }
})().catch(err => {
  console.error('YouTube caption upload FAILED');
  console.error(err.stack || err.message || err);
  process.exit(1);
});
