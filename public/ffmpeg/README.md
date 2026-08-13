# Self-hosted FFmpeg runtime assets

The runtime files in the ignored `runtime/single` and `runtime/multi` directories are generated
from the installed `@ffmpeg/core` and `@ffmpeg/core-mt` packages. The application
fetches them from its own origin only after an audio conversion begins.

Regenerate them after updating FFmpeg packages:

```bash
npm run prepare:ffmpeg
```

Do not commit the generated core files. They are prepared automatically before
development, production builds, and production previews.

The multi-threaded build requires cross-origin isolation (COOP/COEP). The audio
engine automatically uses the single-threaded build when that is unavailable.

`@ffmpeg/ffmpeg` is MIT-licensed. The selected prebuilt `@ffmpeg/core` and
`@ffmpeg/core-mt` packages are GPL-2.0-or-later and include GPL-enabled codecs
beyond this app's MP3/WAV feature set. Distribution must comply with the GPL
and make the corresponding source available as required. A smaller custom core
containing only the needed audio codecs could reduce both download size and the
licensing surface, but it is not part of version one.
