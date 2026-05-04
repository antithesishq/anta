# Changelog

All notable changes to the `@antadesign/anta` package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project tries to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file only tracks what ships to npm consumers — anything under `src/`, `dist/`, the build / generator scripts, and root files in the published tarball. Updates to the documentation site at `antadesign.dev` are not consumer-facing and are intentionally not in this changelog; see the commit history for the site narrative.

Versions ending in `-dev.N` are pre-release builds published under the npm `dev` dist-tag; main releases drop the suffix. Always pin a specific version in your `package.json` (`"@antadesign/anta": "0.1.1-dev.1"`) rather than the floating `"dev"` tag — the floating tag tracks the latest dev build and will silently change between installs.

## 0.1.1-dev.2 — May 3, 2026

### Added
- Five new icons on `<a-icon>`: `swatch-book`, `hat-glasses`, `heart-handshake`, `hourglass`, `text-initial` (Lucide-derived). `synonyms.json` updated; `a-icon.shapes.{ts,css}` regenerated.
- `Icon` wrapper gains an optional `label` prop. When set, the wrapper exposes `role="img"` + `aria-label={label}` so the icon is announced. When omitted (the default), the icon is treated as decorative — `aria-hidden="true"` is applied so it doesn't add noise alongside neighbouring text.
- `Progress` wrapper now composes a single `aria-label` from `label` + percentage + `hint`, joined with ` · `, so screen readers announce what sighted users see in one phrase. The element still sets `role="progressbar"`, `aria-valuenow`, and `aria-valuemax` independently.
- `general_types.ts`: `AProgressAttributes` and `AIconAttributes` now declare typed ARIA attributes (`role`, `aria-label`, `aria-valuenow`, `aria-valuemax`, `aria-valuemin`, `aria-hidden`) so JSX type-checks the wrapper's pass-through.

### Changed
- **Convention strengthened (no API impact):** ARIA wiring (`role`, `aria-*`, `tabindex`, etc.) lives in `src/components/<Name>.tsx` JSX wrappers as attribute pass-through, never inside the web component class. Web components stay pure declarative DOM — neither the constructor nor `attributeChangedCallback` mutates host attributes or inline styles. Documented in `CLAUDE.md`.

## 0.1.1-dev.1 — May 3, 2026

### Added
- `:root, .light` selector mirror in `anta_global_tokens.css`, so consumers can apply the `light` class to a subtree to opt back into light tokens explicitly even when a `.dark` ancestor would otherwise be in effect (useful for dark/light comparison demos).

## 0.1.0-dev.1 — May 2, 2026

### Added
- `Text` component + `<a-text>` element. Props: `priority` (`primary` / `secondary` / `tertiary` / `quaternary` / `quinary`), `tone` (`brand` / `success` / `critical` / `warning` / `info`), `inline`, `truncate` (`true` for single line, integer ≥ 2 for line-clamp), `expandable` (chevron + fade-out mask, click or Enter to expand).
- `Icon` component + `<a-icon>` element. Mask-based icon set recolored via `currentColor`. `size` prop sets `--icon-size`. 80+ shapes derived from Lucide / Feather / Blueprint sources.
- `scripts/generate-icons.mjs` — Node generator that emits `a-icon.shapes.css` and `a-icon.shapes.ts` from a folder of SVGs. The `.ts` file augments `IconShapes` via a `declare module '@antadesign/anta'` block, so consumer-generated icons auto-merge with Anta's `IconShape` type.
- Global element defaults in `anta_global_tokens.css`:
  - `<a>` styling — color, hairline (0.5 px) underline at 75 % alpha by default, `--link-color-hover` + 1 px underline on hover.
  - `<ul>` / `<ol>` get `padding-left: 3ch` and `li::marker` muted to `--text-5`; `li` gets a `0.5em` bottom margin.
  - `<menu>` is reset (no list-style, no padding, no margins) so consumers can use it as a clean semantic container.
- New tokens `--link-color`, `--link-color-hover` (in `:root` and `.dark`).
- `NOTICES.md` at repo root attributing Lucide (ISC), Feather (MIT), and Blueprint (Apache 2.0) for derived icons; `NOTICES.md` is included in the published tarball.

### Changed
- Prose link styling moved out of the docs `base.css` and into Anta's global tokens, so every consumer of `anta_global_tokens.css` gets the same defaults.

### Notes for upgraders
- If you were inlining your own `a { color: ... }` rule, Anta's defaults will now apply unless overridden — the generated underline / link color / 1 px hover thickness / `currentColor` decoration mirror are picked up automatically. To opt out for a specific element, set `text-decoration: none` and your own `color`.
- If you were styling `<menu>`, `<ul>`, or `<ol>` from scratch, expect the new defaults to take effect; override with more-specific selectors as needed.

## 0.0.x — through April 2026

Initial scaffolding: package layout, `<Progress>` component (`<a-progress>` element + `Progress` JSX wrapper), the light/dark CSS-token system imported from the Figma "Anta 0.2" library (background / text / border tokens × 5 levels × 5 tints + neutral, with hex + oklch dual declarations). No formal versioning during this period; treat as the seed of the design system.
