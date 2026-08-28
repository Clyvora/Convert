# Clyvora Convert

> Convert audio and video privately in your browser.

Clyvora Convert is the focused local audio/video member of the Clyvora product family. It does not accept images or URLs and has no media-upload backend.

## Supported conversions

| Input | Output |
| --- | --- |
| MP3 | WAV, OGG, Opus |
| WAV | MP3, OGG, Opus |
| OGG | MP3, WAV, Opus |
| Opus | MP3, WAV, OGG |
| MP4 | WebM, MP3, WAV, OGG, Opus |
| WebM | MP4, MP3, WAV, OGG, Opus |

File signatures are checked before enqueueing. Audio is limited to 300 MiB and video to 500 MiB because browser memory is finite. Video conversion remains CPU-intensive, especially on phones.

## Development

Use Node.js 20 or newer and pnpm:

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
```

The lifecycle scripts copy installed FFmpeg assets into the ignored `public/ffmpeg` directory. Real WebAssembly media tests run with `pnpm test:media`.

## Deployment

Deploy the static production build to the owner-configured `convert.clyvora.tech` project. Apply `vercel.json` or equivalent hosting headers, including cross-origin isolation for FFmpeg, then verify the live HTML, `/sw.js`, FFmpeg asset paths, cache identifier, and response headers before calling the release complete.

## Architecture

```text
src/core           media signatures, conversion registry, queue, naming and preferences
src/engines/audio  lazy FFmpeg audio/video runtime and temporary-file cleanup
src/App.tsx        queue, options, cancellation, retry and downloads
public/sw.js       same-origin application and runtime cache
```

Image processing belongs to Clyvora Resize. Public-link retrieval and the SoundCloud resolver belong to Clyvora Fetch and ClyvoraAPI.

## Privacy and networking

Selected files and filenames remain in browser memory, object URLs, and FFmpeg's browser-local virtual filesystem. The application contacts only its own origin for application files and FFmpeg assets. It does not contain analytics, URL import, or a remote conversion endpoint.

Multithreaded FFmpeg requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Without cross-origin isolation, audio falls back to the single-thread runtime.

## Known limitations

- Codec support depends on the bundled FFmpeg build.
- Transcoding cannot restore quality lost in the source.
- Large video jobs may be slow or exceed a browser tab's memory ceiling.
- The first conversion downloads an approximately 32 MiB FFmpeg runtime.
- Cancellation terminates the active runtime; the next conversion loads a clean runtime and can retry immediately.

See [SECURITY.md](SECURITY.md), [NETWORK.md](NETWORK.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
