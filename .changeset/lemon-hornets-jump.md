---
"@lightpanda/browser": minor
---

- Feat: the browser binary ships in optional platform packages (`@lightpanda/browser-<platform>-<arch>`), so no separate install is needed; `npx @lightpanda/browser install` still takes precedence, but a binary a 1.x `install` left behind now comes after the bundled one
- Feat: `findBinary` and `bundledBrowserVersion` exports
- `lightpanda.fetch` runs the binary without a shell, and a missing binary now rejects with a `ProcessError` instead of exiting the process
