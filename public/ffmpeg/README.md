# Self-hosted FFmpeg runtime assets

The runtime files in the ignored `runtime/single` and `runtime/multi` directories are generated
from the installed `@ffmpeg/core` and `@ffmpeg/core-mt` packages. The application
fetches them from its own origin only after an audio or video conversion begins.

Regenerate them after updating FFmpeg packages:

```bash
npm run prepare:ffmpeg
```

Do not commit the generated core files. They are prepared automatically before
development, production builds, and production previews.

The multi-threaded build requires cross-origin isolation (COOP/COEP). Audio uses
it when available; video uses the stable single-threaded build.

`@ffmpeg/ffmpeg` is MIT-licensed. The selected prebuilt `@ffmpeg/core` and
`@ffmpeg/core-mt` packages are GPL-2.0-or-later and include the audio and video
codecs used for MP3, WAV, OGG, Opus, MP4, and WebM conversion. Distribution must comply with the GPL
and make the corresponding source available as required. A smaller custom core
containing only the required media codecs could reduce both download size and the
licensing surface, but it is not part of version one.
