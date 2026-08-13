# Third-party notices

Clyvora Convert depends on open-source packages whose licenses remain with their respective authors. Package names, versions, integrity hashes, and declared licenses are recorded in `package-lock.json` and the installed package metadata.

## FFmpeg WebAssembly runtime

- `@ffmpeg/ffmpeg` — MIT
- `@ffmpeg/util` — MIT
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later
- `@ffmpeg/core-mt` 0.12.10 — GPL-2.0-or-later

The single- and multithreaded core files used by the application are generated from the installed npm packages by `npm run prepare:ffmpeg`. They are not original Clyvora Convert source code and are not covered by the repository's MIT license.

Anyone distributing a built application containing these FFmpeg artifacts is responsible for satisfying the applicable GPL requirements, including providing the license notices and corresponding source as required. Review the installed package metadata and the upstream [ffmpeg.wasm repository](https://github.com/ffmpegwasm/ffmpeg.wasm) before distribution.

This notice is informational and is not legal advice.
