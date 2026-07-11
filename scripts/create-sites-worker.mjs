import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const serverDir = join(process.cwd(), 'dist', 'server');
const workerPath = join(serverDir, 'index.js');

const workerSource = `const cacheHeaders = {
  "Cache-Control": "public, max-age=31536000, immutable"
};

const htmlHeaders = {
  "Cache-Control": "no-store"
};

function withHeaders(response, headers) {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    nextHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetResponse = await env.ASSETS.fetch(request);

    if (assetResponse.status !== 404) {
      const immutableAsset = url.pathname.startsWith("/assets/");
      return withHeaders(assetResponse, immutableAsset ? cacheHeaders : htmlHeaders);
    }

    const fallbackUrl = new URL("/index.html", url);
    const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    return withHeaders(fallbackResponse, htmlHeaders);
  }
};
`;

await mkdir(serverDir, { recursive: true });
await writeFile(workerPath, workerSource, 'utf8');
console.log(`Created ${workerPath}`);
