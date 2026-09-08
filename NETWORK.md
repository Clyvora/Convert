# Network boundary

Local audio and video files are converted on this device. Selected local file contents and filenames are not uploaded.

Public SoundCloud track retrieval is isolated in `src/core/mediaClient.ts`. Only after submission, a validated URL is sent to the existing resolver. Retrieved media enters the same local file validation and conversion queue. The client retains the existing host checks, size limits, cancellation, and download validation.

The default resolver endpoint is `/api/v1/convert/media/resolve`. Configure `VITE_CLYVORA_API_BASE_URL` or `VITE_CLYVORA_API_URL` for the merger deployment. The development server proxies `/api` to the existing ClyvoraAPI on `127.0.0.1:8787`; run that API with its SoundCloud credentials configured. Same-origin retrieval requires the existing API route to be served or proxied by the deployment; this UI change adds no backend routes. Cross-origin retrieval also requires compatible CSP, CORS, and cross-origin resource headers.

Production on Vercel rewrites `/api/v1/convert/media/resolve` to the currently deployed worker route `https://api.clyvora.tech/v1/media/resolve`. Other `/api/*` paths retain their path on the API host for the future merged download-ticket contract. The production preview uses the same live resolver with Convert's approved origin. The deployed worker currently returns validated HTTPS `*.sndcdn.com` media locations, which are allowed by `connect-src`; local file data is never included in these requests. API and media responses are not stored by the app service worker.
