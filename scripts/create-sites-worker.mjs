import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const serverDir = join(process.cwd(), 'dist', 'server');
const workerPath = join(serverDir, 'index.js');

const workerSource = `const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
};

const cacheHeaders = {
  ...securityHeaders,
  "Cache-Control": "public, max-age=31536000, immutable"
};

const htmlHeaders = {
  ...securityHeaders,
  "Cache-Control": "no-store"
};

function withHeaders(response, headers, pathname) {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    nextHeaders.set(key, value);
  }
  if (pathname === "/support") {
    nextHeaders.set(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://mediaplatform.pages.dev; object-src 'none'; base-uri 'self'"
    );
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
      return withHeaders(assetResponse, immutableAsset ? cacheHeaders : htmlHeaders, url.pathname);
    }

    const fallbackUrl = new URL("/index.html", url);
    const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    return withHeaders(fallbackResponse, htmlHeaders, url.pathname);
  }
};
`;

await mkdir(serverDir, { recursive: true });
await writeFile(workerPath, workerSource, 'utf8');
console.log(`Created ${workerPath}`);
