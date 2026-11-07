import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const supabaseUrl = process.env.SUPABASE_RESTORE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_RESTORE_SERVICE_ROLE_KEY;
const inputDir = process.argv[2];

if (!supabaseUrl || !serviceKey || !inputDir) {
  throw new Error('SUPABASE_RESTORE_URL, SUPABASE_RESTORE_SERVICE_ROLE_KEY, and input directory are required');
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const manifest = JSON.parse(await readFile(join(inputDir, 'storage-manifest.json'), 'utf8'));
const bucketResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, { headers });
if (!bucketResponse.ok) throw new Error(`Could not list recovery buckets (${bucketResponse.status})`);
const currentBuckets = await bucketResponse.json();
const currentNames = new Set(currentBuckets.map((bucket) => bucket.name));

for (const bucket of manifest.buckets) {
  if (currentNames.has(bucket.name)) continue;
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: bucket.name,
      name: bucket.name,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit,
      allowed_mime_types: bucket.allowed_mime_types,
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Could not create recovery bucket ${bucket.name} (${response.status})`);
  }
}

function encodeObjectPath(value) {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function archiveObjectPath(bucketIndex, key) {
  return join(inputDir, 'objects', String(bucketIndex), Buffer.from(key, 'utf8').toString('base64url'));
}

let restored = 0;
for (const object of manifest.objects) {
  const localPath = archiveObjectPath(object.bucket_index, object.key);
  const bytes = await readFile(localPath);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(manifest.buckets[object.bucket_index].name)}/${encodeObjectPath(object.key)}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': object.content_type || 'application/octet-stream',
      'Cache-Control': `max-age=${object.cache_control || '3600'}`,
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Could not restore Storage object (${response.status})`);
  restored += 1;
}

console.log(`Storage restore complete: ${restored} objects`);
