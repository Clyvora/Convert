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

Cobalt is used only as an interaction-design reference. No cobalt code, branding, fonts or other assets have been copied. Cobalt web and API have different licenses.
