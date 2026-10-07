#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const {
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REFRESH_TOKEN,
} = process.env;

for (const [name, value] of Object.entries({YOUTUBE_CLIENT_ID,YOUTUBE_CLIENT_SECRET,YOUTUBE_REFRESH_TOKEN})) {
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const videoArg = process.argv[2];
const metadataArg = process.argv[3];
if (!videoArg || !metadataArg) {
  console.error('Usage: node scripts/upload_youtube.js <video.mp4> <metadata.json>');
  process.exit(1);
}

const videoPath = path.resolve(videoArg);
const metadataPath = path.resolve(metadataArg);
if (!fs.existsSync(videoPath)) throw new Error(`Missing video: ${videoPath}`);
if (!fs.existsSync(metadataPath)) throw new Error(`Missing metadata: ${metadataPath}`);

const metadataInput = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const stat = fs.statSync(videoPath);

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

async function startUpload(accessToken) {
  const body = {
    snippet: {
      title: metadataInput.title,
      description: metadataInput.description || '',
      tags: metadataInput.tags || [],
      categoryId: String(metadataInput.categoryId || '25'),
    },
    status: {
      // Test/automation guard: never publish directly from this script.
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
  };
  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(stat.size),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(body),
    }
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Initialize upload failed: HTTP ${response.status} ${text}`);
  const location = response.headers.get('location');
  if (!location) throw new Error('YouTube did not return a resumable upload URL');
  return location;
}

async function uploadBytes(uploadUrl) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type':'video/mp4',
      'Content-Length':String(stat.size),
    },
    duplex:'half',
    body: fs.createReadStream(videoPath),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {raw:text}; }
  if (!response.ok) throw new Error(`Video upload failed: HTTP ${response.status} ${text}`);
  return data;
}

(async () => {
  console.log(`Uploading ${videoPath} (${(stat.size/1024/1024).toFixed(2)} MiB) as private`);
  const accessToken = await getAccessToken();
  console.log('OAuth access token: PASS');
  const uploadUrl = await startUpload(accessToken);
  console.log('Resumable session: PASS');
  const video = await uploadBytes(uploadUrl);
  if (!video.id) throw new Error(`Upload response missing video id: ${JSON.stringify(video)}`);
  const result = {
    video_id: video.id,
    privacy_status: video.status?.privacyStatus || 'private',
    watch_url: `https://www.youtube.com/watch?v=${video.id}`,
    studio_url: `https://studio.youtube.com/video/${video.id}/edit`,
  };
  console.log('YOUTUBE_UPLOAD_RESULT=' + JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `video_id=${result.video_id}\nwatch_url=${result.watch_url}\nstudio_url=${result.studio_url}\n`);
  }
})().catch(err => {
  console.error('YouTube upload FAILED');
  console.error(err.stack || err.message || err);
  process.exit(1);
});
