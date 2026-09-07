# Static assets outside the repository

Use Cloudflare R2 for fonts, images, and downloads. The recommended first setup
is a public bucket at `assets.anta.design`: files stay outside Git and are usable
from the docs site without changing its Pages deployment. An exact
`anta.design/assets/` URL needs the routing integration described later.

## Create and connect the bucket

1. Open the Cloudflare account that owns the `anta.design` zone. Open **Storage &
   databases → R2 object storage**, enable R2 if needed, and choose **Create bucket**.
2. Name it `anta-assets`, leave the location on automatic unless you have a specific
   location requirement, and create it. See [Create buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/).
3. Open the bucket and use **Create folder** and **Upload** to upload an asset as
   `fonts/antune-sans-v1.woff2`, for example. Folder prefixes form part of the object
   key. See [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/).
4. Open the bucket's **Settings → Custom Domains → Add**. Enter
   `assets.anta.design`, review the proposed DNS record, and choose **Connect
   Domain**. Wait for **Active**. Keep `anta.design` itself connected to Pages.
5. Leave the **Public Development URL** disabled. The production URL is now
   `https://assets.anta.design/fonts/antune-sans-v1.woff2`.

Connecting the custom domain makes this bucket's objects public. It also enables
Cloudflare caching; the `r2.dev` URL is intended for development. See
[Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Allow fonts and browser fetches

In the bucket's **Settings → CORS policy**, use this policy for the docs site and
local development:

```json
[
  {
    "AllowedOrigins": ["https://anta.design", "http://localhost:4321", "http://localhost:4322"],
    "AllowedMethods": ["GET", "HEAD"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

If the published themes eventually reference these public font URLs for use on
arbitrary consumer websites, use `"AllowedOrigins": ["*"]` instead. Add exact
preview origins if using an allowlist. CORS governs browser access, not whether a
public asset can be downloaded. See [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

Use versioned object names and set upload metadata to `Content-Type: font/woff2`
for WOFF2 files and `Cache-Control: public, max-age=31536000, immutable` for files
whose URLs never change content. Use shorter caching for mutable URLs. Check the
response headers after upload. A Cache Rule limited to hostname
`assets.anta.design` can make additional file types eligible for caching. See
[R2 caching](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/).

Verify the font URL with an Origin header:

```sh
curl -I -H 'Origin: https://anta.design' \
  https://assets.anta.design/fonts/antune-sans-v1.woff2
```

Expect `200`, `Content-Type: font/woff2`, and an `Access-Control-Allow-Origin`
header matching the policy. Update CSS URLs after upload. The docs currently
reference Uploadcare URLs in `src/styles/base.css` and font preloads in
`src/layouts/DocsLayout.astro`; change both when moving those files. Only preload
fonts that the page actually uses.

## Serve an exact anta.design/assets/ path

A bucket custom domain maps a hostname, not a path prefix. For
`https://anta.design/assets/fonts/antune-sans-v1.woff2`, the existing Pages Worker
can read R2 through a binding. The bucket can remain private for this option.
Cloudflare documents [R2 bindings in Pages](https://developers.cloudflare.com/pages/functions/bindings/#r2-buckets).

The repository integration would require these changes before deployment:

1. Add an R2 binding named `STATIC_ASSETS` for `anta-assets` to `site/wrangler.jsonc`.
   Declare the preview binding explicitly too, choosing the same public-content
   bucket or a separate preview bucket.
2. Extend `site/lib/search/worker.ts` with a `/assets/` handler before its existing
   search route. Remove that prefix to obtain the R2 key; accept `GET` and `HEAD`,
   return `404` for missing keys, and stream the object's body with its HTTP
   metadata and ETag. Support conditional requests and ranges if serving large
   downloads or video.
3. Add `/assets/*` to `site/public/_routes.json` so Pages invokes the Worker for
   those requests. Preserve the search routes and keep ordinary docs pages outside
   the Worker. See [Pages routing](https://developers.cloudflare.com/pages/functions/routing/).
4. Regenerate the Worker types, build, test the new route and search route, then
   deploy the Pages project. Uploaded files become available without subsequent
   site builds. Same-origin font requests need no CORS permission; requests from
   other sites still need response CORS headers in this handler.

This guide does not create a bucket, upload files, or change the deployed routes.
