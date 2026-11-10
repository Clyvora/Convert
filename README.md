# mewvi

A media downloader and audio/video converter by Clyvora.

[Open mewvi](https://mewvi.xyz/) · [Release notes](https://mewvi.xyz/updates) · [Report an issue](https://github.com/Clyvora/Convert/issues)

## Features

- Download audio and video from supported public links.
- Convert local files in your browser, without uploading them.
- Save format preferences and manage downloads in one queue.

## Development

Requires **Node.js 24** and **pnpm 11**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Public-link downloads need the separate media service. See [NETWORK.md](NETWORK.md) for connection details.

## Checks

```sh
pnpm test
pnpm lint
pnpm build
```

Full tests use Chromium: install it once with `pnpm exec playwright install chromium`.

mewvi is in beta. Source availability varies; download media you have permission to use.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [License](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
