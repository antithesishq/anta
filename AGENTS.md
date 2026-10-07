# Anta design system

Anta is a portable UI component library, published as `@antadesign/anta`. It works in React, Preact through `preact/compat`, and custom JSX runtimes through `configure()`.

This pnpm workspace contains four publishable packages and one private site:

- `@antadesign/anta` — the root package; its source is in `src/`.
- `@antadesign/stickers` — a separate sticker package in `stickers/`, keeping `lottie-web` out of anta's dependency graph.
- `@antadesign/plot` — the separate canvas plot package in `plot/`.
- `@antadesign/typedoc-theme` — the separate TypeDoc theme package in `typedoc-theme/`.
- `site/` — the documentation site; it is not published to npm.

## Task routing

Read the closest guidance before changing a scoped area:

- `src/AGENTS.md` — Anta component architecture, web-component and JSX-wrapper conventions, CSS rules, and component additions.
- `site/AGENTS.md` — Astro site, interactive playground, client-router, and documentation-page conventions.
- `stickers/AGENTS.md` — sticker package layout, generation, and publishing details. Read `src/AGENTS.md` as well before changing its elements or wrappers.
- `plot/AGENTS.md` — plot entry points, build, and package verification.
- `typedoc-theme/README.md` — TypeDoc theme setup and package behavior.
- `RELEASING.md` — mandatory publish order and package-manager commands.
- `FIGMA.md`, `WRITING.md`, and `DESIGN.md` — Figma extraction, prose, and design guidance respectively.

Keep instructions in the narrowest file that applies. Update an `AGENTS.md` when a recurring review correction or repository-specific pitfall should persist.

## Common commands

Run commands from the repository root unless the command says otherwise:

```sh
pnpm run dev        # Long-running package watcher and docs-site dev server
pnpm run build      # Build anta JS, CSS, and declarations
pnpm run lint       # Enforce custom-element / React 19 safety rules
pnpm run typecheck  # Type check anta without emitting
pnpm test           # Run root regression tests (requires Chromium or installed Chrome)
```

Use `pnpm run dev` for any development work, including docs-site work. It rebuilds anta and stickers before the site, so package-source edits propagate to the running site. Do not start `site`'s dev server directly for package work.

`pnpm run dev` runs package builds, watchers, and the Astro site without Wrangler.
Use `pnpm run dev --wrangler` to enable the local Cloudflare search/chat worker
needed for AI search. The flag also works with `--parallel` (or `-new`).

For production previews and browser checks, follow the command selection and
server ownership rules in [site/AGENTS.md](site/AGENTS.md#local-servers). Agents
choose the appropriate command without asking the user about process flags.

The docs site consumes the built workspace `dist/` output. Esbuild runs without bundling, so a new component's CSS must be explicitly included by the package build; see `src/AGENTS.md`.

## Verification

CI runs build, custom linting, anta and sticker type checks, root regression tests,
the stickers build, site CSS linting, and a production site build. `pnpm test`
includes Capture, Slider, and disclosure-navigation browser tests and Markdown
conversion tests. CI sets `CAPTURE_TEST_BROWSER_CHANNEL=chrome` to use the runner's installed Chrome.
Run the checks relevant to the area you changed; run the complete set before
handing off a broad change.

The Button property harness runs separately from `pnpm test`. Start or reuse a
site preview as described in [site/AGENTS.md](site/AGENTS.md#local-servers), then
run `ANTA_HARNESS_ORIGIN=<preview-url> pnpm test:fuzz_component`. To check one
case, add `ANTA_HARNESS_SHARD=22905 ANTA_HARNESS_CASES=1` (replace `22905` with
the case ID). Failures and screenshots go to `tests/pbt/.runs/`.

CI's `pnpm install --frozen-lockfile` runs the workspace `prepare` scripts to
build Anta, stickers, and Plot. Do not repeat those builds in the same job or
disable install scripts without providing an explicit replacement build stage.

For scoped package-documentation changes, run
`node scripts/generate-package-docs.mjs --only <generated-path...>` with paths
relative to `docs/`, such as `theming.md`. The unscoped command intentionally
deletes and rebuilds the complete `docs/` tree, so reserve it for broad
documentation synchronization.

Cloudflare Pages must use the Node version in `.node-version`; a dashboard
`NODE_VERSION` override can make its build differ from CI. The manual
`trigger-cloudflare-deploy.yml` workflow supports `action: logs` for diagnostics
and an optional `node_version` when redeploying. That override applies to the
project's preview or production environment, according to the target branch.

### Periodic consumer validation

Run the saved Next.js and Preact production fixtures with `pnpm test:consumers`.
These tests install a local npm tarball and cover full bundle and granular usage.
They run only on request; they are excluded from `pnpm test` and regular CI.
See [Consumer validation](tests/consumers/README.md) for filters, saved reports,
and the manual GitHub Actions workflow. Reuse these fixtures for package
regressions without asking agents to recreate apps.

Occasionally validate Anta in fresh consumer apps, especially after changes to
exports, bundles, JSX runtime integration, or installation guidance. This checks
that the packaged docs lead new consumers to the working full bundle default.

1. Use current, verified package build output and packaged docs; rebuild or
   refresh stale artifacts first. Run
   `npm pack --ignore-scripts --pack-destination <temporary-directory>` to pack
   those artifacts without repeating build and documentation lifecycle scripts.
   Install the resulting `.tgz` in isolated apps with `npm install <tarball-path>`.
   Use the tarball as the Anta dependency, without publishing, workspace links,
   or Anta source aliases.
2. Ask separate subagents to create a minimal Next.js App Router app and a
   minimal Preact app, each with Title, Tag, and a Button that updates a count.
   Give each agent its own temporary directory and a fresh context without the
   preceding implementation discussion. Have them use the installed
   `docs/index.md`, `docs/install-config.md`, and component docs as their Anta
   guidance. Let them choose imports independently; do not prescribe the bundle
   imports. Record the initial choice and reasoning before implementation.
3. Pin direct framework dependencies to exact stable versions compatible with
   Anta's peer requirements. Normal runtime aliases such as `react` to
   `preact/compat` are allowed. Keep app changes inside the assigned directories.
4. Run production builds and browser checks for styles, Button registration,
   pointer and keyboard interaction, and browser errors. Check Next.js server
   rendering and hydration. Title and Tag should be styled without registered
   custom element classes. Each agent owns and cleans up its servers and browsers.
5. Record framework versions, dependency provenance, initial and final imports,
   commands, screenshots, and any confusion or workarounds. Report whether both
   agents selected the full bundle from the docs and whether their initial
   approach worked. Preserve failures before troubleshooting so corrections do
   not hide a package or documentation problem.

## Git workflow

Commit and push work on the current branch by default. Never commit or push task
changes directly to `main`; when the current branch is `main`, create and switch
to a descriptively named feature or fix branch before committing or pushing.

## Shared conventions

- Pin registry dependencies and dev dependencies to exact stable versions. Keep
  `workspace:*` for local packages and peer ranges for consumer compatibility.
- TypeScript uses exact npm aliases: `@typescript/native` supplies TypeScript 7
  and `tsc`; `typescript` supplies the TypeScript 6 compatibility API required
  by TypeDoc and compiler-API scripts. Update both when upgrading the toolchain.

- Use `color-mix(in oklch, <color> <percent>%, transparent)` to adjust color alpha or interpolate colors. Do not use `rgba()`, hex alpha, or parent `opacity` for a one-property alpha change.
- Follow `WRITING.md` for docs prose, source comments, and TSDoc.
- When extracting from Figma, read the full variable list directly from its collection; do not infer tokens from one node.

## Changelog

`CHANGELOG.md` records only changes that ship in the published `@antadesign/anta` package: `src/`, `dist/`, package build/generator scripts, and published root files. Documentation-site-only work does not belong there.

Ask: would an npm consumer see this change? If not, keep the narrative in the commit or PR instead.

## Publishing

Before publishing any package, read and follow [`RELEASING.md`](RELEASING.md). The order and use of `npm` versus `pnpm` are mandatory.
