# Third-party notices

mewvi depends on independently licensed projects. Their authors retain their rights. `pnpm-lock.yaml` and installed package metadata record the frontend versions and declared licenses. The build prepares `/third-party-notices.txt` with installed frontend runtime license texts and a development-tool inventory. The website's Thanks & licenses page summarizes their roles.

## Interface and animation

- React and React DOM — MIT; interface components and rendering.
- Scheduler (a React DOM dependency) — MIT; rendering scheduling.
- Torph — MIT; short text transitions. Its copyright notice names Lochie Axon.
- TypeScript — Apache-2.0; type checking and development tooling.
- Vite and its React plugin — MIT; development server and production builds.
- Vitest, Testing Library, jsdom and Oxlint — MIT; testing and code checks.
- Playwright — Apache-2.0; browser testing. Development tools are not the conversion runtime.

## FFmpeg WebAssembly runtime

- `@ffmpeg/ffmpeg` — MIT
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later
- `@ffmpeg/core-mt` 0.12.10 — GPL-2.0-or-later

The single- and multithreaded core files used by the application are generated from the installed npm packages by `npm run prepare:ffmpeg`. They are not original Clyvora Convert source code and are not covered by the repository's PolyForm Shield license.

Anyone distributing a built application containing these FFmpeg artifacts is responsible for satisfying the applicable GPL requirements, including providing the license notices and corresponding source as required. Review the installed package metadata and the upstream [ffmpeg.wasm repository](https://github.com/ffmpegwasm/ffmpeg.wasm) before distribution.

The upstream wrapper MIT text and GPL version 2 text are supplied at `/licenses/ffmpeg-wrapper-MIT.txt` and `/licenses/GPL-2.0.txt`. The GPL text comes from FFmpeg's `COPYING.GPLv2`; the npm core packages declare GPL-2.0-or-later. FFmpeg and enabled codec libraries have their own source and licensing obligations. The wrapper's MIT license does not replace the core licenses. A dependency inventory and upstream links do not by themselves fulfill corresponding-source obligations.

This notice is informational and is not legal advice.

## Remote processing dependencies

The independently deployed media service uses yt-dlp 2026.10.26 and yt-dlp-ejs 0.8.0. Their own licenses and bundled-component notices apply; review upstream THIRD_PARTY_LICENSES before distributing container images. Native FFmpeg licensing depends on its build and enabled codecs. The container includes the Debian FFmpeg package; preserve its copyright/license files and provide corresponding source where required. Python dependency versions are pinned in the service's requirements.txt.

The pinned service environment also includes curl-cffi (MIT), Mutagen (GPL-2.0-or-later), PyCryptodome/PyCryptodomex (BSD/public-domain components), Requests (Apache-2.0), urllib3 (MIT), Brotli (MIT), certifi (MPL-2.0), cffi (MIT-0), pycparser (BSD-3-Clause), websockets (BSD-3-Clause), charset-normalizer (MIT) and idna (BSD-3-Clause). yt-dlp declares Unlicense; yt-dlp-ejs declares Unlicense AND MIT AND ISC. Bundled components can add notices beyond a package's top-level declaration.

Service requirement baseline for this release (separate from the frontend inventory): yt-dlp 2026.10.26; yt-dlp-ejs 0.8.0; curl-cffi 0.17.0; cffi 2.1.1; pycparser 3.12; brotli 1.2.1; certifi 2026.10.23; mutagen 1.48.1; pycryptodomex 3.24.1; requests 2.34.2; urllib3 2.8.0; websockets 17.3; charset-normalizer 3.5.2; idna 3.20. A separately deployed media-service image may use a different set; its actual image and notices determine what it includes.

Cobalt is used as an interaction and layout reference. The React components are original; no cobalt source code, branding, mascot artwork or copy is included. Cobalt web and API have different licenses.

## Typography

IBM Plex Mono is distributed through `@fontsource/ibm-plex-mono` 5.3.0 under the SIL Open Font License 1.1. Copyright 2017 IBM Corp. The fonts are self-hosted; no Google Fonts or other external font request is made. The full license is shipped at `/ibm-plex-mono-OFL.txt`. This independently licensed typeface is also used by cobalt; the files here come from Fontsource, not the cobalt repository.

## Platform icons and artwork

Platform icons use Simple Icons under CC0 1.0, except the Audius glyph from Audius Brand Resources. Brand names and marks remain subject to their owners' rights; their appearance does not imply affiliation or endorsement. See `public/platforms/README.md` for sources.

mewvi's mascot illustrations include AI-generated artwork selected and prepared for this project. Project branding and third-party trademarks have different considerations from software licensing. Contact Clyvora before reusing the mewvi name, cat mark or mascot; do not assume that a dependency license covers them.
