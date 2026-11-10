# Network and privacy boundary

Local files stay in the browser. The lazy FFmpeg runtime is served from this application's origin, with COOP/COEP headers. File data is never submitted to the remote API.

Remote API requests live in `src/core/mediaClient.ts`; guarded source-media downloads live in `src/core/browserDownload.ts`. Submitted public links reach Clyvora’s media service and source platforms. The service may retrieve a thumbnail during inspection. Remote artifacts and metadata belong to the session that created them.

The default API prefix is `/api`. During development, Vite forwards control requests to the media service on port 8790; legacy resolver and media routes use port 8787. Production routes requests through `api.clyvora.tech` and its configured media service. See `vite.config.ts` and `vercel.json` for the routing configuration.

Control requests use an HttpOnly SameSite session cookie and CSRF token. The browser stores output and interface preferences locally, separately from session credentials.

Standard downloads stream from the media service using expiring access grants. Compatible source downloads can run directly in the browser. Their files remain available only in the current tab; save them before refreshing or closing it. The browser downloader permits approved HTTPS source hosts, omits cookies and referrers, disables caching, rejects redirects and enforces transfer limits. If browser access fails, the queue can fall back to the standard download path.

Service workers cache only the application shell and versioned assets. API responses, job data, previews and media artifacts are excluded. The content security policy restricts network access to the application and configured source CDNs.

Remote files expire after 24 hours, inspections and previews after ten minutes, and job/session metadata after seven days. A once-per-minute cleanup deletes expired data. Refresh restores remote jobs while the server session remains valid. Local files must be reselected after refresh.

No account passwords, browser cookies for source platforms, authentication bypass, private content or DRM bypass are supported. Provider availability varies.
