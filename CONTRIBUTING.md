# Contributing to Clyvora Convert

Thank you for helping improve Clyvora Convert.

## Before you start

- Keep conversion local. Selected files, filenames, and file contents must never be transmitted or logged.
- Keep the format list focused. A format is not supported until detection, conversion, naming, errors, cleanup, and tests are complete.
- Avoid adding accounts, analytics, cloud storage, external conversion APIs, or unrelated product features.
- Discuss large dependencies or architectural changes in an issue before implementing them.

## Development

Use Node.js 20 or newer.

```bash
npm install
npm run dev
```

FFmpeg runtime files are generated from the installed npm packages and are not committed. `npm run dev` and `npm run build` prepare them automatically.

## Pull requests

Keep changes focused and explain the user-facing behavior. Before submitting, run:

```bash
npm test
npm run lint
npm run build
```

A pull request should:

- Include tests for new behavior and recoverable failures.
- Preserve keyboard navigation, visible focus, status announcements, and reduced-motion behavior.
- Release object URLs, bitmaps, canvases, workers, FFmpeg files, and large buffers when no longer needed.
- Keep audio dependencies lazy so image conversion never loads FFmpeg.
- Avoid large binary fixtures; generate or include only tiny, legally safe samples.
- Update documentation when commands, supported formats, hosting requirements, or licensing change.

## Adding a conversion format

1. Add the normalized format and MIME information to `src/core/types.ts`.
2. Register only valid pairs in `src/core/registry.ts`.
3. Add content-signature detection in `src/core/detection.ts`.
4. Extend an engine behind the existing conversion boundary.
5. Add naming and format-specific controls only where relevant.
6. Test detection, pair validation, options, conversion, cancellation, errors, and cleanup.
7. Confirm the initial bundle and privacy boundary remain intact.

## Bug reports

Use tiny generated or freely redistributable fixtures. Never attach private media or filenames that expose personal information.
