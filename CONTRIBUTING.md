# Contributing to mewvi

Use Node.js 24 and pnpm 11. Run `pnpm test`, `pnpm lint`, and `pnpm build` before opening a pull request.

Keep changes focused on public-link downloads and local audio/video conversion. Local file contents and filenames must stay on the device. Add relevant tests for new behavior and preserve cancellation, retry and cleanup support.

Keep internal notes, image prompts and source artwork in the ignored `.private/` folder. Commit the optimized assets the application uses.

Report vulnerabilities privately using the instructions in [SECURITY.md](SECURITY.md). Never attach confidential media to a public issue.
