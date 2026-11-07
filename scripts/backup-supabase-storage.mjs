import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputDir = process.argv[2];

if (!supabaseUrl || !serviceKey || !outputDir) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and output directory are required');
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const storageDir = join(outputDir, 'objects');
await mkdir(storageDir, { recursive: true });

async function request(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase Storage request failed (${response.status}): ${detail}`);
  }
  return response;
}

function encodeObjectPath(value) {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function archivePath(bucketIndex, key) {
  return join(storageDir, String(bucketIndex), Buffer.from(key, 'utf8').toString('base64url'));
}

const bucketResponse = await request('/storage/v1/bucket');
const buckets = await bucketResponse.json();
const manifest = { format_version: 1, buckets: [], objects: [] };
let downloaded = 0;

for (const [bucketIndex, bucket] of buckets.entries()) {
  manifest.buckets.push({
    name: bucket.name,
    public: Boolean(bucket.public),
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
  });

  async function walk(prefix = '') {
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const listResponse = await request(`/storage/v1/object/list/${encodeURIComponent(bucket.name)}`, {
        method: 'POST',
        body: JSON.stringify({ prefix, limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      const rows = await listResponse.json();
      for (const row of rows) {
        const key = prefix ? `${prefix}/${row.name}` : row.name;
        if (row.id === null && row.metadata === null) {
          await walk(key);
          continue;
        }

        const response = await request(`/storage/v1/object/${encodeURIComponent(bucket.name)}/${encodeObjectPath(key)}`);
        const target = archivePath(bucketIndex, key);
        await mkdir(join(target, '..'), { recursive: true });
        await pipeline(Readable.fromWeb(response.body), createWriteStream(target, { flags: 'w', mode: 0o600 }));
        manifest.objects.push({
          bucket_index: bucketIndex,
          key,
          content_type: row.metadata?.mimetype || row.metadata?.contentType || 'application/octet-stream',
          cache_control: row.cacheControl || '3600',
          size: Number(row.metadata?.size ?? row.metadata?.contentLength ?? 0),
        });
        downloaded += 1;
      }
      if (rows.length < pageSize) break;
    }
  }

  await walk();
}

await writeFile(join(outputDir, 'storage-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`Storage snapshot complete: ${buckets.length} buckets, ${downloaded} objects`);
