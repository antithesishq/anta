# Normalization

`reset.css` gives plain HTML (`<h2>`, `<ul>`, `<a>`, `<table>`) the same baseline as
Anta components.

It is a separate import in `@layer anta.reset`. Override individual rules, or omit
it when another reset provides the baseline.

```js
import '@antadesign/anta/tokens.css'   // design tokens
import '@antadesign/anta/reset.css'     // ← this page (optional)
import '@antadesign/anta/elements'      // web components (client-side only)
```

## What it normalizes

### Structural reset

- `html` uses `--sans-serif`, `--text-2`, 22px leading, and `color-scheme`.
  `.dark` selects dark mode. `body` paints `--bg-2`, including the browser canvas.
- `box-sizing: border-box` on every element (and `::before` / `::after`).
- `margin: 0` on everything — apps build spacing from explicit values.
- Replaced elements (`img`, `picture`, `video`, `canvas`, `svg`) → `display: block` + `max-width: 100%`, so a stray large asset can't blow out the layout.
- Form controls (`input`, `button`, `textarea`, `select`) → `font: inherit`.
- Keyboard-focused elements → a 1px `--focus-ring` outline. Component-specific
  focus styles keep their own geometry.
- `overflow-wrap: break-word` on paragraphs + headings; `text-wrap: pretty` on `<p>` and `text-wrap: balance` on headings.

### Typography (Anta's opinion)

These defaults make raw markup match Anta components.

- **Headings** match `<Title level={n}>` and have document margins. `<Title>` remains margin-free.
- **Block rhythm:** `p`, `ul`, `ol`, `blockquote`, `dl`, `pre`, and `figure` have a
  `1rem` bottom margin, removed on a last child. `table` and `hr` have no reset margin.
- `strong` → `font-weight: 600`.
- `dfn` (defined term) → non-italic, with a dotted underline at half the surrounding text's strength (`3px` offset) in place of the UA italic. No `cursor: help` — that's for where the term is actually hoverable.
- Inline `code` → a tone-aware `--monospace` pill. `line-height: 1em` preserves the
  surrounding line box; `pre code` has no pill.
- **Lists** (`ul` / `ol`): `3ch` left padding so markers hug the text; a small bottom margin between items; markers toned to `--text-5`.
- **Blockquotes** → a 3px `--text-5` rule on the left with `2ch` total left inset.
- `mark` → a theme-specific yellow with near-black text.
- `del` → `--text-2-critical` with a strike; `ins` → `--text-2-success` without an underline.
- `var` and `dt` → italic at `font-weight: 600`.
- `small` and `figcaption` → `calc(13em / 15)`; `figcaption` also uses `--text-3`.
- `sub` / `sup` → 75% with relative offsets that preserve line height.
- `hr` → a 1px `--border-4` line.
- `pre` → a bordered `--bg-3` code surface with horizontal scrolling.
- `menu` is stripped to a clean semantic container (no disc markers / default padding).
- **Links** get `--link-color` with a hairline underline (75% alpha, `0.5px`); hover only thickens it to `1px` (no color repaint). Anchor-buttons (`<a role="button">`) are excluded so they keep button styling.
- `::selection` → the focus-ring color, tuned per theme (20% alpha in light, 30% in dark).
- **Tables**: `border-collapse`, `tabular-nums`, and a polite cell baseline; opt into a framed look with `<table data-bordered>` (outer frame + column dividers + rounded corners).

See `src/reset.css` for the full set. Heading values are duplicated in
`src/elements/a-title.css` and kept in sync.

## Cascade layers — how to override

Anta declares this layer order once (in `tokens.css`):

```css
@layer base, anta, components, utilities;
@layer anta.reset, anta.components, anta.theme;
```

Anta uses child layers inside `@layer anta`: `anta.reset`, `anta.components`, and
the optional `anta.theme`.

- **Above `base`** — a framework preflight you drop into `@layer base` (e.g. Tailwind) won't wipe Anta's typography.
- **Below `components` and `utilities`** — your own component or utility CSS overrides Anta with no specificity battles.
- **Unlayered CSS beats every layer** — so any plain rule you write already wins over Anta's reset, no `!important` needed.

> **Don't add an unlayered universal reset.** It overrides Anta's element defaults.
> Anta already applies `box-sizing` and `margin: 0`; delete duplicates, or put your
> reset in `@layer base`.

### Override one thing

Write the rule unlayered (or in a layer after `anta`) — targeting a **specific** element, not `*`:

```css
/* wins over Anta's @layer anta.reset — no !important */
h2 { letter-spacing: -0.01em; }
```

### Use a different reset

Because `reset.css` is a separate import, omit it when your own reset governs typography. Keep the tokens and elements:

```js
import '@antadesign/anta/tokens.css'   // keep — tokens
import '@antadesign/anta/elements'      // keep — components
// no '@antadesign/anta/reset.css'      // your reset is in charge
```

**One dependency to keep:** Anta's elements don't set their own `box-sizing` — they
assume the global `* { box-sizing: border-box }` that this reset provides. Every common
reset (normalize.css, Tailwind's preflight, and others) sets it too. If yours does not, keep that rule or component padding, `max-width`, and icon-button sizing will be slightly off.

Or import both and override only the pieces you want (unlayered, or in a later layer).

## Why it's opinionated

The reset gives headings, lists, links, and tables the same baseline as Anta
components. Omit it when your own reset should control them.

Tags styled by the reset, rendered live.

`abbr`, `q`, and `cite` keep browser typographic styles. `dd` has no browser indent
because the reset clears margins. The reset adds no `kbd` typography.
