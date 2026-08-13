# Clyvora Convert QA review

> Integration update: the final primary-agent review resolved the listed progress semantics, mobile visual/tab-order mismatch, file-input labeling, resize-limit mismatch, loose MP3 frame validation, and service-worker cache-lifetime findings. The remaining performance notes and cross-browser manual checks still apply.

Reviewed 13 August 2026. This is a read-only review of the application code and styles plus the automated tests owned by QA.

## Automated coverage

- File signatures for PNG, JPEG, WebP, WAV, ID3 MP3, and frame-synchronised MP3; RIFF false-positive and extension/content mismatch cases.
- Complete supported-pair registry and representative unsupported pairs.
- Output naming, Unicode normalization, reserved-character replacement, case-insensitive duplicate suffixes, and multi-suffix allocation.
- Byte formatting at byte, KiB, MiB, and GiB boundaries and invalid input behavior.
- Resize calculations, aspect-ratio locking, bounding-box fitting, unlocked dimensions, and unsafe canvas limits.
- General quality and MP3 bitrate validation plus image-engine quality validation.
- JPEG background defaults and normalization; PNG/WebP transparency plans.
- Queue lifecycle rules, stale transition rejection, queued cancellation, retry recovery, and clearing terminal items.
- Image pipeline integration with mocked standard browser primitives. It verifies decode, resize, background-before-image paint order, encoding options, phase callbacks, bitmap release, and canvas disposal.
- Basic rendered interface checks for the first-viewport promise and picker, adding a valid file, and announcing/dismissing a renamed-file error.

## Actionable findings

### Functional and cancellation

- The previously reported engine API, retry-state, and batch-cancellation integration blockers were fixed before final QA. TypeScript build and the queue lifecycle tests now pass.
- **Medium — align resize limits.** Number inputs allow 32,768 pixels while the image engine rejects anything above 32,767. Use the engine limit in the UI or export one shared constant.
- **Medium — strengthen MP3 frame-header detection when practical.** The current frame-sync branch accepts any leading `0xFF` plus three high bits in byte two. Checking MPEG version/layer and valid bitrate/sample-rate fields would reduce false positives from arbitrary binary files.

### Accessibility and keyboard behavior

- **High — expose determinate conversion progress.** The visual progress bar has no `role="progressbar"`, accessible name, `aria-valuemin/max/now`, or equivalent native `<progress>`. The polite live region announces only the phase label while busy, not meaningful percentage changes. Announce throttled milestones to avoid excessive speech.
- **Medium — avoid a visual/tab-order mismatch on mobile.** CSS visually moves `.settings` above the queue with `grid-row: 1`, but DOM and keyboard order still traverse the queue before settings. Either keep visual and DOM order aligned or avoid moving the panel ahead visually.
- **Low — offer a direct label for the hidden file input.** The visible button is keyboard-operable and triggers it, so the picker is usable, but an explicit `aria-label` on the input makes direct assistive-technology navigation clearer.
- Visible focus styles, real buttons/links, implicit form labels, reduced-motion handling, and alert semantics are present and were judged appropriate in static review.

### Privacy, offline behavior, and network boundaries

- External font loading was removed; the styles now use a local system font stack.
- COOP/COEP is configured for Vite development/preview and a static-host `_headers` example is included. Production hosting must preserve these headers.
- A same-origin runtime service worker cache now supports offline use after relevant assets have been requested. **Medium:** return or `waitUntil` the asynchronous `cache.put()` operation in the fetch handler; it is currently started without being attached to the fetch lifetime, so a browser may terminate the worker before a large FFmpeg asset finishes writing.
- **Medium — add a regression check for outbound requests.** Static inspection found no file upload API, backend, analytics, or file-content logging. A browser-level test should intercept requests during image and audio conversion and assert that all requests are same-origin static assets only.

### Performance and resilience

- **Medium — large image work can still occupy the main thread.** `OffscreenCanvas` created and used in the UI realm does not itself move drawing to a worker. Native decode/encode are asynchronous where supported, but a very large `drawImage` can still cause a long task. Measure representative 50–75 MB images; consider a dedicated image worker if long tasks exceed the interaction budget.
- **Medium — avoid an unnecessary output copy in audio conversion.** If `readFile` already returns a `Uint8Array`, wrapping it in a second `Uint8Array` may duplicate a large output in memory. Reuse the returned bytes when the library's lifetime guarantees permit it.
- **Medium — ZIP creation can temporarily retain all outputs plus the archive.** The UI sensibly converts sequentially, but “Download all” necessarily increases peak memory. Disable it while converting, catch ZIP failures, and warn for a large combined output size.
- **Low — keep progress honest.** Image phases are milestones, not measured percentages. Use phase text or fixed milestone values described as estimates; do not animate continuously between them as if measured.

## Manual checks still required

- Real PNG/JPEG/WebP conversion and alpha-to-JPEG compositing in Chromium, Firefox, and Safari.
- Real MP3/WAV conversion in both cross-origin-isolated multithread mode and single-thread fallback.
- Cancellation during FFmpeg loading and execution, retry after cancellation/failure, and temporary-file cleanup.
- Keyboard-only traversal at desktop and mobile widths, focus retention after remove/clear actions, and screen-reader progress announcements.
- 320 px layout, long filenames, 200% zoom, Windows high-contrast/forced-colors mode, and reduced motion.
- Network inspection proving that image conversion loads no FFmpeg chunks and selected file bytes never leave the device.
- Offline reload after the application and each required FFmpeg mode have been cached.

## Test limitation

The image integration test uses deterministic mocked browser image primitives because JSDOM does not ship real image codecs or canvas encoders. It validates orchestration and cleanup, not pixel fidelity. No automated audio fixture conversion was added by QA: downloading/loading roughly 65 MB of FFmpeg cores inside the unit runner would be slow and brittle. Audio should instead receive a small browser smoke test once the app-level wrapper and self-hosted asset headers are finalized.
