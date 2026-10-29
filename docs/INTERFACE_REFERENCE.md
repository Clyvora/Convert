# Interface reference and verification — 29 October 2026

## Reference audit

Reference: [cobalt.tools](https://cobalt.tools/) (displayed version 11.7, commit prefix 9f7953c4), and the route/component inventory in [imputnet/cobalt](https://github.com/imputnet/cobalt/tree/main/web/src).

Inspected the save workspace, services popover, empty processing queue, local remux page, donation/share page, all ten settings categories, all five About categories and update-reader navigation. The update archive was browsed from 11.2 through 5.1; the audit does not establish a review of every historic article. Social links and payment actions were not followed. Destructive storage actions on cobalt were not executed.

| Reference area | Convert implementation |
| --- | --- |
| Save | Compact 640px link workspace; Auto, Audio, Video only; persistent background jobs |
| Queue | Anchored compact popover; existing transfer acknowledgements, Recent downloads, retry and cancellation preserved |
| Services | Compact twenty-provider preview and paginated searchable catalog; no invented verification claims |
| Appearance | Auto/light/dark theme; optional explanations; preferences persist locally |
| Accessibility | Reduced motion, reduced transparency, queue opening and automatic delivery preferences |
| Video/audio/metadata | Existing source-aware formats and validated output settings in flat segmented controls |
| Local processing | On-device conversion explanation and shortcut; no claim that remote extraction runs locally |
| Instances | Actual Clyvora service status and configured limits; no unsupported custom-server/key input |
| Privacy | Accurate local/remote processing and retention information |
| Advanced | Validated, bounded JSON import/export, confirmed preference reset and scoped application-cache clearing |
| App information | Safe capability and build information; no session tokens or signed URLs exposed |
| About | Real category URLs, grouped navigation, readable document column and copyable section links |
| Updates | One honest beta article using supplied Clyvora artwork, with internal settings/privacy links |
| Donate/share | No standalone Support or donation page; feedback information remains in About |
| Remux | Existing broader local conversion, restyled with a file picker and adjacent explanations |

## Implementation and licensing

React and TypeScript remain in place. This is an original implementation of the observed interaction/layout patterns, not a mechanical Svelte port. No upstream component code, mascot assets, branding or article text was copied. Clyvora's application license remains unchanged. Cobalt's web code uses CC-BY-NC-SA-4.0; its branding and mascot assets are excluded from that license. See the [upstream license description](https://github.com/imputnet/cobalt/blob/main/web/README.md#license).

The shared typeface, IBM Plex Mono, is obtained independently from Fontsource 5.3.0, self-hosted, and distributed with its SIL OFL 1.1 license at `/ibm-plex-mono-OFL.txt`. Dependency notices describe that reuse.

New interface preferences use `clyvora-convert-interface-v1`. Existing theme and download preference keys remain compatible. Existing category hashes work alongside nested URLs. New hosting rewrites cover nested Settings/About pages. The application service-worker cache version changes; APIs and artifacts remain excluded.

Following the motion review, artwork stays still: no image entrance, bobbing or hover rotation. Torph is limited to useful text transitions (action labels, job stages and item counts), with a shorter 240ms duration. Both the device's reduced-motion setting and Convert's explicit reduced-motion preference disable those transitions.

## Verification

The actual controlled-fixture browser → API → Python extraction worker → FFmpeg → downloaded playable file journey passes. It covers exactly-once automatic delivery, manual retry, refresh recovery, persistent local workspace, dialog focus restoration, service search, dark/light themes, reduced motion, desktop/mobile layout and horizontal overflow. Additional checks cover nested URLs, preference persistence, real JSON export/import, cancelled reset, copied section links and About feedback access.

Component tests cover import validation and reset confirmation, category history, section-link copying, and automatic queue/download preferences. Lint, production TypeScript/build and generated-contract synchronization are checked separately. Screenshots are generated under ignored `test-results/`.

No backend, extraction behavior, paid resource or production hosting plan changes are part of this UI pass. Translation, custom processing instances, payment collection and a fictional release history are intentionally not represented as working features.
