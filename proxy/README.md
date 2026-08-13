# Clyvora link resolver

This Cloudflare Worker gives the browser app a narrowly scoped SoundCloud link resolver without relaying audio through Clyvora infrastructure.

It accepts a public SoundCloud track URL, a SoundCloud share link, or an unlisted track URL that already contains its access key. Like Cobalt's SoundCloud service, it resolves a public, playable, non-encrypted progressive MP3 stream whether or not SoundCloud displays an uploader-enabled Download button. The browser downloads that short-lived URL directly from SoundCloud's CDN.

The Worker deliberately does not support DRM, account-only private tracks, profiles, playlists, arbitrary proxy targets, paid previews, or region-blocked media.

## Deploy

1. Create a free Cloudflare account if you do not already have one.
2. Replace `https://www.convert.clyvora.tech` in `wrangler.jsonc` if the real production site uses a different origin.
3. From this directory, run `pnpm install`, then `pnpm exec wrangler login`, and finally `pnpm deploy`.
4. Copy the resulting `workers.dev` URL and append `/v1/soundcloud/resolve`.
5. Put that complete address in Convert's production `VITE_MEDIA_RESOLVER_URL` environment variable, then rebuild/deploy Convert. If Cloudflare routes `/api/soundcloud/resolve` on the site's own domain to this Worker, no Vite variable is needed.

For the first deployment, `pnpm deploy:first-time` combines steps 3 and 4: it opens Cloudflare's sign-in page and deploys immediately after approval.

For local development, the easiest option is to run `pnpm dev:links` from Convert's root. It starts the Worker and website together with the correct local address. Alternatively, start the Worker with `pnpm dev` and add a `.env.local` file to Convert containing:

```text
VITE_MEDIA_RESOLVER_URL=http://localhost:8787/v1/soundcloud/resolve
```

`SOUNDCLOUD_CLIENT_ID` is an optional Worker environment variable. When omitted, the Worker first checks SoundCloud's public page data and then its application assets for the current web-client identifier. It caches the result for six hours. This fallback depends on undocumented page structure and can break without notice.

## Security boundary

- Exact SoundCloud page and CDN hosts are allowlisted.
- The endpoint never accepts a media destination supplied by the caller.
- Cross-origin callers must be explicitly listed in `ALLOWED_ORIGINS`.
- Requests are rate-limited and request/upstream response sizes are capped.
- Media bytes do not pass through the Worker.
- Responses and signed media URLs are not cached by Clyvora.

Cloudflare's free tier and SoundCloud's page structure or policies can change. This code cannot promise perpetual free hosting or uninterrupted compatibility.
