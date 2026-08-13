# Clyvora Convert

> Convert media locally. No uploads, waiting, or accounts.

Clyvora Convert is an open-source image, audio, and video converter that runs entirely in the browser. Selected files are processed on the user's device and are never sent to a conversion server.

![Clyvora Convert interface](public/clyvora-convert-card.webp)

## Why Clyvora Convert?

- **Private by design:** no backend, accounts, analytics, cloud storage, or external conversion API.
- **Local-first:** native browser image tools and a self-hosted FFmpeg WebAssembly worker do the work.
- **Focused:** only deliberately supported conversion pairs are shown.
- **Batch-friendly:** multiple files, sequential processing, retry, cancellation, collision-safe names, and ZIP export.
- **Offline-capable:** the interface and conversion assets work offline after the required files have been cached.
- **Accessible:** keyboard navigation, visible focus states, status announcements, and reduced-motion support.

## Supported conversions

| Input | Output |
| --- | --- |
| PNG | JPG, WebP |
| JPG / JPEG | PNG, WebP |
| WebP | PNG, JPG |
| MP3 | WAV, OGG, Opus |
| WAV | MP3, OGG, Opus |
| OGG | MP3, WAV, Opus |
| Opus | MP3, WAV, OGG |
| MP4 | WebM, MP3, WAV, OGG, Opus |
| WebM | MP4, MP3, WAV, OGG, Opus |

File signatures are inspected instead of trusting extensions alone. Renamed, damaged, or unsupported files are rejected with a clear explanation.

## Features

- Drag-and-drop, multiple selection, clipboard image paste, and a locally generated sample image.
- A compact conversion queue with per-file output selection, progress, retry, and editing after completion.
- Image resize controls with aspect-ratio locking, no-upscale protection, JPG/WebP quality, and a selectable JPG transparency background.
- Video quality, maximum resolution, codec, and audio-bitrate controls.
- Audio bitrate, channel, and sample-rate controls.
- Native image comparison plus audio and video playback before and after conversion.
- Remembered local preferences and "apply to compatible files."
- Result dimensions, elapsed time, size change, and device-memory guidance.
- Lazy media-engine loading with separate loading and conversion states.
- Individual downloads and lazy "Download all as ZIP."

## Quick start

Requirements: Node.js 20 or newer and npm.

After cloning the repository:

```bash
npm install
npm run dev
```

The development command copies the installed FFmpeg runtime into `public/ffmpeg` before starting Vite. Those generated files are intentionally excluded from source control.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Prepare FFmpeg assets and start development |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build with required headers |
| `npm test` | Run all automated tests |
| `npm run test:unit` | Run core and conversion-engine tests |
| `npm run test:integration` | Run UI and image-pipeline integration tests |
| `npm run lint` | Run the source-code linter |
| `npm run prepare:ffmpeg` | Regenerate local FFmpeg runtime assets |

## Architecture

```text
src/core             signatures, registry, validation, naming, queue and preferences
src/engines/image    native browser image decoding, canvas rendering and encoding
src/engines/audio    lazy FFmpeg audio/video worker and temporary-file cleanup
src/App.tsx          interface, orchestration, cancellation and downloads
public/sw.js         same-origin runtime caching for offline use
```

Image conversion prefers `createImageBitmap` and `OffscreenCanvas`, with safe browser fallbacks. It does not load FFmpeg.

Audio and video conversion dynamically import `@ffmpeg/ffmpeg`. The multithreaded core is selected only when cross-origin isolation and `SharedArrayBuffer` are available; otherwise the single-threaded core is used. The heavy core assets are not part of the initial JavaScript bundle.

## Privacy boundary

Clyvora Convert does not contain an upload path. Object URLs, canvases, local buffers, and FFmpeg's in-browser virtual filesystem keep selected media on the device. The service worker fetches and caches only same-origin application assets.

Contributions must not add telemetry containing filenames or file contents. Any future network feature must be isolated from selected media and receive an explicit privacy review.

## Hosting requirements

Multithreaded FFmpeg requires these response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite development and preview already set them. `public/_headers` provides an example for compatible static hosts. Other hosts need equivalent configuration. Without cross-origin isolation, the application automatically uses the single-threaded fallback.

For offline use, users must first visit the production application and load the conversion assets they need. Clearing site data removes the cache.

## Browser and performance limitations

- Browser codec and canvas support varies, particularly for WebP encoding.
- Large image drawing or encoding may briefly occupy the main thread.
- Each FFmpeg core is roughly 32 MB before transfer compression and needs additional working memory.
- Very large conversions can exceed a browser tab's memory ceiling, especially on mobile devices.
- Image cancellation is cooperative; a native encode may finish internally before its discarded result is released.
- EXIF and other source metadata are not preserved.
- Transcoding cannot restore quality already lost in the source. WAV outputs and high-quality video settings can substantially increase file size.
- Video conversion is CPU- and memory-intensive in a browser, particularly on mobile devices.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Please keep version-one format scope deliberate and include tests for new detection, validation, conversion, failure, cancellation, and cleanup behavior.

For sensitive vulnerability reports, follow [SECURITY.md](SECURITY.md).

## License

The original Clyvora Convert source code is available under the [MIT License](LICENSE).

FFmpeg and the generated `@ffmpeg/core` / `@ffmpeg/core-mt` runtime assets are separate third-party works licensed under **GPL-2.0-or-later**. A deployed build that includes those assets must satisfy the applicable GPL obligations. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [public/ffmpeg/README.md](public/ffmpeg/README.md). This section is a project-maintenance note, not legal advice.
