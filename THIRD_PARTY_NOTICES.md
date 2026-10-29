# Third-party notices

Clyvora Convert depends on open-source packages whose licenses remain with their respective authors. Package names, versions, integrity hashes, and declared licenses are recorded in `pnpm-lock.yaml` and the installed package metadata.

## FFmpeg WebAssembly runtime

- `@ffmpeg/ffmpeg` — MIT
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later
- `@ffmpeg/core-mt` 0.12.10 — GPL-2.0-or-later

The single- and multithreaded core files used by the application are generated from the installed npm packages by `npm run prepare:ffmpeg`. They are not original Clyvora Convert source code and are not covered by the repository's PolyForm Shield license.

Anyone distributing a built application containing these FFmpeg artifacts is responsible for satisfying the applicable GPL requirements, including providing the license notices and corresponding source as required. Review the installed package metadata and the upstream [ffmpeg.wasm repository](https://github.com/ffmpegwasm/ffmpeg.wasm) before distribution.

This notice is informational and is not legal advice.

## Remote processing dependencies

The independently deployed media service uses yt-dlp 2026.10.26 and yt-dlp-ejs 0.8.0. Their own licenses and bundled-component notices apply; review upstream THIRD_PARTY_LICENSES before distributing container images. Native FFmpeg licensing depends on its build and enabled codecs. The container includes the Debian FFmpeg package; preserve its copyright/license files and provide corresponding source where required. Python dependency versions are pinned in the service's requirements.txt.

Cobalt is used as an interaction and layout reference. The React components are original; no cobalt source code, branding, mascot artwork or copy is included. Cobalt web and API have different licenses.

## Typography

IBM Plex Mono is distributed through `@fontsource/ibm-plex-mono` 5.3.0 under the SIL Open Font License 1.1. Copyright 2017 IBM Corp. The fonts are self-hosted; no Google Fonts or other external font request is made. The full license is shipped at `/ibm-plex-mono-OFL.txt`. This independently licensed typeface is also used by cobalt; the files here come from Fontsource, not the cobalt repository.
