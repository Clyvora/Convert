# Contributing to Clyvora Convert

Use Node.js 20 or newer and pnpm. Run `pnpm test`, `pnpm lint`, and `pnpm build` before opening a pull request.

Convert owns local audio/video conversion only. Do not add image processing, URL import, remote conversion, accounts, cloud storage, or telemetry containing filenames or media contents. New formats require signature detection, explicit conversion pairs, FFmpeg coverage, cancellation/retry coverage, cleanup, documentation, and browser testing.

Report vulnerabilities privately using the instructions in [SECURITY.md](SECURITY.md). Never attach confidential media to a public issue.
