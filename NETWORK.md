# Network and privacy boundary

Local files stay in the browser. The lazy FFmpeg runtime is served from this application's origin, with COOP/COEP headers. File data is never submitted to the remote API.

Remote operations are isolated in `src/core/mediaClient.ts`. After submission, public source URLs reach Clyvora’s media service and source platforms. Inspecting a link may retrieve its thumbnail through the backend’s guarded network path. Remote artifacts and metadata are temporary, owner-scoped server data.

The default API prefix is `/api`. Development forwards `/api/v1/convert/*` to the new persistent service on 8790; the older Node API remains on 8787. Production forwards control requests through `api.clyvora.tech` and its configured Convert upstream. Fetch's existing resolver contract and the old Convert resolver rewrite remain compatible.

Control requests use an HttpOnly SameSite session cookie and CSRF token. The browser retains no credentials in localStorage. Non-sensitive remote preferences use `clyvora-convert-remote-preferences-v1`; existing local preferences use `clyvora-convert-media-preferences-v2`; the theme continues using `clyvora-theme`.

Artifact access grants expire after five minutes. Downloads navigate directly to the operator-configured media origin and stream from disk; the browser does not fetch them into blobs. Backend thumbnails use owner-authorized same-origin API preview paths. The application CSP continues to restrict scripts and network requests; no arbitrary source CDN needs to be added for the new flow.

Service workers cache only the application shell and versioned assets. API responses, job data, previews, and artifacts are excluded. The cache identifier changes with this release to retire stale shells. Legacy SoundCloud CDN permission remains for old-client compatibility and can be removed after that migration window closes.

Remote files expire after 24 hours, inspections and previews after ten minutes, and job/session metadata after seven days. A once-per-minute cleanup deletes expired data. Refresh restores remote jobs while the server session remains valid. Local files must be reselected after refresh.

No account passwords, browser cookies for source platforms, authentication bypass, private content or DRM bypass are supported. Provider availability varies. See the media service README and verification records for deployment isolation requirements and measured capability limits.
