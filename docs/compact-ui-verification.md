# Compact interface verification

Verified locally on Windows with Chromium, Node 24, and the controlled native-media fixture. The interface uses original components and Clyvora assets; cobalt is an interaction reference only.

## Completed checks

- 81 frontend tests, including quick submission, Auto stream selection, explicit incompatible settings, clipboard/Enter behavior, queue cancellation and retry, selected collection items, preference migration, and automatic download deduplication.
- Six real browser FFmpeg tests for local conversion.
- Real browser → API → Python extraction worker → FFmpeg → artifact download, with the downloaded MP3 verified by ffprobe.
- Current-session automatic delivery exactly once, manual delivery, and refresh recovery without another automatic delivery.
- Local file selection survives switching between the local and remote workspaces.
- Desktop and mobile layouts in light and dark themes; modal focus entry/restoration, keyboard access, reduced-motion preference, and horizontal overflow checks.
- Lint, production build, generated-contract checksum, and whitespace checks.

`pnpm test:remote` reproduces the full remote fixture journey and writes screenshots to ignored `test-results/compact-*.png` files. Its source-platform traffic is controlled by the test fixture; this does not establish live-provider reliability, production deployment, or Linux container isolation. The backend's release requirements remain applicable.

## State and preferences

The persistent application shell owns remote orchestration. Both workspaces remain mounted when hidden. Only jobs submitted or explicitly retried in the current page lifetime enter the automatic-delivery set. An artifact is marked attempted before requesting access; unsuccessful automatic delivery leaves the manual queue action available. Restored jobs never enter that set.

Remote preferences use `clyvora-convert-remote-preferences-v2`, with separate audio and video containers. Compatible v1 preferences migrate without deleting the original key. Theme storage and local conversion preferences keep their existing contracts. The application service-worker cache version changes with this interface; API responses and artifacts remain outside application caches.
