import { execFileSync } from 'node:child_process';

const [endpoint, bucket, prefix, retentionDaysRaw] = process.argv.slice(2);
const retentionDays = Number(retentionDaysRaw);
if (!endpoint || !bucket || !prefix || !Number.isInteger(retentionDays) || retentionDays < 7) {
  throw new Error('Expected R2 endpoint, bucket, prefix, and retention (at least 7 days)');
}

const response = execFileSync('aws', ['s3api', 'list-objects-v2', '--endpoint-url', endpoint, '--bucket', bucket, '--prefix', prefix, '--output', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const objects = JSON.parse(response).Contents ?? [];
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
let removed = 0;

for (const object of objects) {
  if (!object.Key || !object.LastModified || Date.parse(object.LastModified) >= cutoff) continue;
  execFileSync('aws', ['s3api', 'delete-object', '--endpoint-url', endpoint, '--bucket', bucket, '--key', object.Key], {
    stdio: 'ignore',
  });
  removed += 1;
}

console.log(`R2 retention complete: ${removed} expired objects removed`);
