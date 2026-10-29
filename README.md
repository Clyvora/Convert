# mewvi by Clyvora

Previously Clyvora Convert. The canonical production address is `https://mewvi.xyz/`; repository paths, API routes and saved-preference keys remain compatible. Existing Convert domains are retained during the migration. Browser preferences and anonymous job sessions are scoped to each domain and do not automatically transfer to the new address.

Download public media and convert local audio/video with Clyvora’s interface.

Paste a public link, choose Auto, Audio, or Video only, and press Download. Auto follows the available source streams; inspection happens before a job is submitted. Settings holds separate audio/video format preferences and advanced controls. Unavailable settings require an explicit alternative. Collections open a selection sheet before creating work; playlist, channel, profile and multi-media enumeration depend on the installed extraction engine.

The queue holds progress, cancellation, retries and results. Newly submitted work starts one file or ZIP download when ready, with up to two retries for temporary download-link failures. A complete server transfer moves a successful job into Recent downloads; this acknowledges delivery to the browser, not a saved file on disk. Browser download restrictions can require a manual download. Partial batches remain in the queue for failed-item recovery. Recent downloads retain a Download again action until expiration. Refresh restores jobs without repeating automatic downloads. Download and Local conversion stay mounted when navigating, preserving in-progress operations. Settings (`/settings`), Updates (`/updates`), About (`/about`) and local conversion (`/local`) have dedicated URLs with browser back/forward support. Settings includes section links. Queue, service search, and collection selection remain accessible overlays. The compact interface uses original components and Clyvora assets.

Original preserves source audio without applying saved bitrate, sample-rate or channel conversion preferences. Choose an explicit audio format to enable those settings. Source extraction and genuinely requested conversions can still be slow on the free worker's limited CPU.

Vercel rewrites and the supplied `_redirects` map these page URLs to the application entry without changing API routing. Other static hosts must serve `index.html` for those paths so direct visits and refresh work.

The queue and service browser use compact popovers. The service browser starts with twenty common discovery shortcuts; search reads the backend catalog for actual capability labels. These shortcuts are not verified-provider claims. The transparent navigation mark and theme-aware SVG favicon use a luminance mask of the supplied monochrome cat artwork. Recreate them with `node scripts/prepare-transparent-icon.mjs` after updating `public/brand-cat.webp`.

Settings and About use grouped category navigation with direct URLs such as `/settings/audio` and `/about/privacy`. Settings includes accessibility preferences, automatic light/dark appearance, bounded settings import/export, and confirmed preference reset. Read the [interface reference audit](docs/INTERFACE_REFERENCE.md) for the cobalt comparison, deliberate feature differences, licensing and verification scope.

Local files are processed on-device using lazy-loaded FFmpeg WebAssembly. Supported local formats include MP3, WAV, Vorbis/OGG, Opus, AAC/M4A, FLAC, MP4, WebM and MKV. Codec availability depends on the pinned runtime. Existing size limits remain 300 MiB audio and 500 MiB video. Remote processing supports more source formats and is limited separately by the service.

## Development

Use Node 24 and pnpm. Start the media backend following [its setup guide](../ClyvoraAPI/services/convert/README.md), then:

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
pnpm exec vitest run
pnpm test:media
pnpm lint
pnpm build
```

`pnpm test:remote` tests an actual browser/API/yt-dlp/FFmpeg/download flow using a generated media fixture. It requires the sibling ClyvoraAPI checkout and installed Python/native media tools. Standalone frontend builds do not require that checkout. Fetch remains a separate compatible product.

## Hosting and privacy

Convert remains a static React/TypeScript application. The development server forwards `/api/v1/convert` to port 8790. Production rewrites control requests to the existing ClyvoraAPI Worker; that Worker must be configured to reach the persistent media service. Downloaded files are served directly from its operator-configured HTTPS origin using expiring grants. No backend is deployed merely by building this frontend.

Local files and filenames are not uploaded. Submitted public links, their metadata and remotely downloaded files reach Clyvora infrastructure and the source platform. Remote files expire after 24 hours; job/session metadata after seven days. A refresh restores remote jobs through an HttpOnly session cookie; local files must be reselected. Only non-sensitive output preferences and theme settings are stored in localStorage.

No account cookies, passwords, private content, DRM or paywall bypass are supported. You must have permission to download and use the media. An upstream extractor listing is not a guarantee that a provider’s downloads or profile enumeration work. The searchable catalog labels capabilities as unverified until supported by recorded evidence.

Preserve COOP/COEP hosting headers for local FFmpeg. Service workers cache application assets only; API responses, job previews and media artifacts use no-store. See [NETWORK.md](NETWORK.md), [SECURITY.md](SECURITY.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the backend’s architecture, operational and verification documentation.


## Search and AI discovery

`pnpm build` now renders the public routes to static HTML with the same React page content as the interactive site. It generates page-specific titles, descriptions, canonicals and JSON-LD, then checks the output for missing assets and indexing mistakes. Personal settings and the error page are noindex. Public content is listed in `/sitemap.xml`; `/llms.txt` provides a factual product summary. Crawlers use the same public pages as visitors. No paid ratings, invented review totals or unverified service-count claims are included.

After deployment, verify domain ownership in Google Search Console and Bing Webmaster Tools and submit `https://mewvi.xyz/sitemap.xml`. Check live URL inspection and crawl errors there. Verification tokens must come from the site owner's account; they are not fabricated here. Indexing, rankings and AI citations are not guaranteed. The technical changes do not replace useful content, product reliability or authentic links from other sites.
