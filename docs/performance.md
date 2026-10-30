# Performance changes — 30 October 2026

Measured with the production build on the same Windows workspace, before and after these changes:

| Entry asset | Before | After |
| --- | ---: | ---: |
| Main JavaScript | 148.82 kB | 128.87 kB |
| Main JavaScript, gzip | 46.08 kB | 40.86 kB |
| Initial CSS | 59.54 kB | 53.76 kB |

These are bundle sizes, not measured page-load timings. Converter JS (21.29 kB) and CSS (5.79 kB) load when the converter is first opened. It remains mounted afterwards to preserve queued local files. Pre-rendering waits for the lazy component so the local page still contains readable content. FFmpeg remains loaded only when conversion is requested, with immutable versioned runtime caching.

Queue polling no longer waits for capabilities or discovery-history restoration. Capabilities are fetched once per mount with retries after failures, rather than every two seconds. Collection status and visible item-page requests run concurrently. Existing incremental discovery results remain visible while collection discovery continues.

Link checks show a slower-source status after four seconds. Cancellation now covers session setup, and the 40-second request budget includes that setup. The backend already has a 30-second extraction limit; optional preview artwork now uses a one-second socket timeout and short read budget instead of the metadata socket timeout. Source extraction and transfer speed still depend on providers and network conditions.

Immutable asset responses are delivered without waiting for cache storage; cache failures remain optional. API requests, tickets and user media remain excluded. Service-worker installation also tolerates unavailable cache storage.

Validation: production build, static-page SEO checks, lint and frontend tests. Backend core tests and worker syntax pass. The backend controlled transfer benchmark failed with SOURCE_UNAVAILABLE in the local extraction runtime, so no real link-check, transfer-time, or first-byte improvement is claimed. Test production first/repeat visits and provider transfers after deploying both repositories; this change does not deploy them.
