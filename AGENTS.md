# Anta design system

Anta is a portable UI component library, published as `@antadesign/anta`. It works in React, Preact through `preact/compat`, and custom JSX runtimes through `configure()`.

This pnpm workspace contains two publishable packages and one private site:

- `@antadesign/anta` — the root package; its source is in `src/`.
- `@antadesign/stickers` — a separate sticker package in `stickers/`, keeping `lottie-web` out of anta's dependency graph.
- `site/` — the documentation site; it is not published to npm.

## Task routing

Read the closest guidance before changing a scoped area:

- `src/AGENTS.md` — Anta component architecture, web-component and JSX-wrapper conventions, CSS rules, and component additions.
- `site/AGENTS.md` — Astro site, interactive playground, client-router, and documentation-page conventions.
- `stickers/AGENTS.md` — sticker package layout, generation, and publishing details. Read `src/AGENTS.md` as well before changing its elements or wrappers.
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
```

Use `pnpm run dev` for any development work, including docs-site work. It rebuilds anta and stickers before the site, so package-source edits propagate to the running site. Do not start `site`'s dev server directly for package work.

The docs site consumes the built workspace `dist/` output. Esbuild runs without bundling, so a new component's CSS must be explicitly included by the package build; see `src/AGENTS.md`.

## Verification

CI runs build, custom linting, anta and sticker type checks, the stickers build, site CSS linting, and a production site build. Run the checks relevant to the area you changed; run the complete set before handing off a broad change.

## Shared conventions

- Use `color-mix(in oklch, <color> <percent>%, transparent)` to adjust colour alpha or interpolate colours. Do not use `rgba()`, hex alpha, or parent `opacity` for a one-property alpha change.
- Follow `WRITING.md` for docs prose, source comments, and TSDoc.
- When extracting from Figma, read the full variable list directly from its collection; do not infer tokens from one node.

## Changelog

`CHANGELOG.md` records only changes that ship in the published `@antadesign/anta` package: `src/`, `dist/`, package build/generator scripts, and published root files. Documentation-site-only work does not belong there.

Ask: would an npm consumer see this change? If not, keep the narrative in the commit or PR instead.

## Publishing

Before publishing either package, read and follow [`RELEASING.md`](RELEASING.md). The order and use of `npm` versus `pnpm` are mandatory.
