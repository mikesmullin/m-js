# Runtime location

The docs site loads the **published** m.js bundle from `../dist/`.

| File | Purpose |
|------|---------|
| `dist/m.js` | All-in-one ESM, not minified |
| `dist/m.min.js` | Minified ESM (what the docs import) |
| `dist/m.min.js.gz` | Minified + gzip (download / size) |

CDN: https://mikesmullin.github.io/m-js/dist/m.min.js

Canonical source: https://github.com/mikesmullin/m-js (v3 branch, `src/`)
Built with: `bun build.mjs package` / published via `bun build.mjs release`
