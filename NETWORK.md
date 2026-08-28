# Network boundary

Clyvora Convert accepts local audio and video files only. Selected file bytes and filenames are not sent to Clyvora or another conversion service.

Approved runtime requests are limited to same-origin HTML, JavaScript, CSS, icons, the service worker, and FFmpeg worker/WASM assets. The production Content Security Policy uses `connect-src 'self'` and does not permit analytics, the resolver, SoundCloud, or arbitrary HTTPS origins.

Browser-level privacy tests must fail if a selected filename or file content appears in an outbound request.
