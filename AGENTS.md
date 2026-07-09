# AGENTS.md

This is a public repo of tools by kevinquinn.fun, separate from my personal homepage.

## Goals

It's intended to lower the friction for me building & hosting simple utilities that I put together for myself or for others, without needing to manage 50 different domains or other annoying logistics. One place, all my published tools.

Agents developing in this repo should avoid adding excess complexity without great reasons that I have agreed to.

## Development

- We aim to build loops where possible for agents to help work towards goals I set. At a minimum, we should strive to be able to fix simple errors, and usually be able to run the full application in a way that an agent can interact directly, such as Playwright or APIs.

## Monorepo build

This is a monorepo: every top-level folder is one independently-built tool, and the whole
repo builds into a single static site (`_site/`) deployed as one Cloudflare Pages project.
Each tool is served at `/that-folder-name/`.

Run `npm run build` at the repo root to build everything. It runs `build.mjs`, which walks
each top-level folder and, per folder, in priority order:

1. **`build.sh` present** — run it, then copy its `dist/` output (or the whole folder if it
   has no `dist/`). Escape hatch for anything that isn't an npm project (e.g. Python).
2. **`package.json` with a `build` script** — run `npm ci && npm run build`, copy `dist/`.
   This is the path for Vite/React/etc. tools (see `bank-bonus-allocator`).
3. **`index.html` present, nothing else** — copy the folder as-is. This is the path for
   bare-HTML tools (see `bus`, `barebones-bingo-cards`, `points-depreciation`). No build
   config needed.
4. Otherwise the folder is skipped.

A landing page listing all built tools is generated automatically at `_site/index.html`.

**Adding a new tool:**
- Bare HTML/CSS/JS: just create `your-tool/index.html`. Nothing else required.
- Needs a build step: give it a real `package.json` with a `build` script that emits to
  `your-tool/dist/`. If it's a Vite app, set `base: '/your-tool/'` in `vite.config` so
  asset URLs resolve correctly once deployed under that subpath.

**Cloudflare Pages project settings** (Git-connected build): Build command `npm run build`,
Build output directory `_site`, root directory `/`.


