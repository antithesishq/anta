# Normalization

Anta ships an opinionated reset + typography baseline in **`reset.css`**, so plain
HTML (`<h2>`, `<ul>`, `<a>`, `<table>`…) renders in the same visual language as the
components — no per-page restyling to make prose match a `<Title>` or a `<Table>`.

It's a **separate import**, and every rule lives in `@layer anta.reset`, inside
Anta's outer cascade layer. You can override individual rules or use a different
reset. Omit this import when another reset provides the baseline.

```js
import '@antadesign/anta/tokens.css'   // design tokens
import '@antadesign/anta/reset.css'     // ← this page (optional)
import '@antadesign/anta/elements'      // web components (client-side only)
```

## What it normalizes

### Structural reset

- **The page itself** — `html` takes `--sans-serif`, `--text-2`, a `22px` leading on the 15px body (unitless, so it inherits as a ratio), `-webkit-tap-highlight-color: transparent` (Anta's controls carry their own `:active`, so the platform overlay only muddies them), and `color-scheme: light` (flipped to `dark` by a `.dark` ancestor). `body` paints `--bg-2`, which becomes the browser canvas while leaving `body.dark` and consumer body backgrounds in control. Running prose is looser than a UI label on purpose: `<Text>` and the control labels stay at 15/20, which is what keeps them aligned with each other. The reset takes no position on `letter-spacing`. Without it the components render in Anta's font while the prose around them falls back to the browser's default serif at UA black. `--bg-2` rather than `--bg-1`, since `--bg-1` is what a field paints itself — a `--bg-1` page would leave inputs flush with the ground.
- `box-sizing: border-box` on every element (and `::before` / `::after`).
- `margin: 0` on everything — apps build spacing from explicit values.
- Replaced elements (`img`, `picture`, `video`, `canvas`, `svg`) → `display: block` + `max-width: 100%`, so a stray large asset can't blow out the layout.
- Form controls (`input`, `button`, `textarea`, `select`) → `font: inherit`.
- Keyboard-focused elements → a 1px `--focus-ring` outline. Component-specific
  focus styles keep their own geometry.
- `overflow-wrap: break-word` on paragraphs + headings; `text-wrap: pretty` on `<p>` and `text-wrap: balance` on headings.

### Typography (Anta's opinion)

This is **not** a neutral normalize — these defaults make raw markup match the components.

- **Headings** adopt the exact scale of `<Title level={n}>` — `h1`–`h6` sizes, line-heights, weight `≈585`, `letter-spacing: 0`, color `--text-1` (kept in lockstep with `a-title.css`) — plus per-level block margins for document rhythm. Those margins live only on the raw headings: `<Title>` itself is margin-free and leaves spacing to its container, so running prose gets the rhythm while the component stays neutral.
- **Block rhythm** — `p`, `ul`, `ol`, `blockquote`, `dl`, `pre`, and `figure` take a `1rem` bottom margin, so a run of markup reads as a document. Bottom-only, so two adjacent blocks never negotiate which margin wins, and `rem` rather than `em` so a `pre` set at 13px still sits the same distance from its neighbour as a paragraph. A **last child** has it removed, so a block at the end of a card or dialog doesn't push a phantom gap against the container's padding. `table` and `hr` are out of the set: a table is usually placed by its container, and a rule's spacing belongs to whatever it divides.
- `strong` → `font-weight: 600`.
- `dfn` (defined term) → non-italic, with a dotted underline at half the surrounding text's strength (`3px` offset) in place of the UA italic. No `cursor: help` — that's for where the term is actually hoverable.
- Inline `code` → a tinted pill: the `--monospace` face at `0.933em`, padding, a 3px radius, and a background mixed from `currentColor` (6%, 10% in dark) so it follows the surrounding tone and theme from one value. `line-height: 1em` keeps it from inflating the line box. `pre code` drops the pill — a code block is already a surface.
- **Lists** (`ul` / `ol`): `3ch` left padding so markers hug the text; a small bottom margin between items; markers toned to `--text-5`.
- **Blockquotes** get a 3px rule down the inline start in the list marker's `--text-5`, with border plus padding totalling `2ch`. No indent, no italics.
- `mark` → a tuned yellow per theme with a 2px radius, in place of the UA's `#ff0`; the text stays near-black in both, since light-on-yellow never clears contrast.
- `del` → `--text-2-critical` with a strike; `ins` → `--text-2-success` with no underline (it would read as a link in prose). The tone carries the edit.
- `var` and `dl`'s `dt` → italic at `font-weight: 600`. A variable and the term it names read as the same thing.
- `small` and `figcaption` → `calc(13em / 15)`, the 13-of-15 step that matches `<Text size="small">` against the body and still steps down proportionally inside a heading. It replaces the UA's `font-size: smaller`, a keyword whose factor is UA-defined and compounds when nested. `figcaption` also takes `--text-3`, secondary to the content it labels.
- `sub` / `sup` → `75%`, kept on the baseline at zero line-height and shifted with relative offsets. The UA raises them with `vertical-align: super` / `sub`, which moves the inline box so it protrudes and every line holding a footnote mark grows taller than its neighbours; this keeps the line at its normal height.
- `hr` → a 1px `--border-4` line (the UA's inset 3D border is cleared first), matching a table's cell divider so horizontal rules agree across a page.
- `pre` → a code-block surface: `--bg-3` behind a 1px `--border-5` at a 6px radius, `10px 1rem 6px` padding, `--monospace` at 13px/20px, and `overflow-x: auto` so a long line scrolls inside the block rather than widening the page.
- `menu` is stripped to a clean semantic container (no disc markers / default padding).
- **Links** get `--link-color` with a hairline underline (75% alpha, `0.5px`); hover only thickens it to `1px` (no color repaint). Anchor-buttons (`<a role="button">`) are excluded so they keep button styling.
- `::selection` → the focus-ring color, tuned per theme (20% alpha in light, 30% in dark).
- **Tables**: `border-collapse`, `tabular-nums`, and a polite cell baseline; opt into a framed look with `<table data-bordered>` (outer frame + column dividers + rounded corners).

Everything above is defined in `src/reset.css`, inside `@layer anta.reset` — read
that file for the authoritative set (it's short and commented). The headings block
is duplicated in `src/elements/a-title.css`; the two are kept in sync.

## Cascade layers — how to override

Anta declares this layer order once (in `tokens.css`):

```css
@layer base, anta, components, utilities;
@layer anta.reset, anta.components, anta.theme;
```

Everything Anta ships lives inside **`@layer anta`**: the reset uses
`anta.reset`, components use `anta.components`, and the optional reference palette
uses `anta.theme`. That placement is deliberate:

- **Above `base`** — a framework preflight you drop into `@layer base` (e.g. Tailwind) won't wipe Anta's typography.
- **Below `components` and `utilities`** — your own component or utility CSS overrides Anta with no specificity battles.
- **Unlayered CSS beats every layer** — so any plain rule you write already wins over Anta's reset, no `!important` needed.

> **Gotcha — don't re-add a _universal_ hard reset unlayered.** Overriding a
> *specific* element unlayered is the intended escape hatch (below). But a blanket
> `* { margin: 0 }` / `*, *::before, *::after { box-sizing: border-box }` left
> **unlayered** also outranks Anta's *per-element* defaults — its `p`, `caption`,
> and `ul / ol` margins — because unlayered wins over `@layer anta.reset` regardless of
> specificity. Anta already runs that universal `*` reset itself, inside
> `@layer anta.reset`, so the copy-pasted duplicate is redundant *and* harmful: delete it,
> or if you keep your own reset wrap it in `@layer base { … }` (below `anta`) so
> Anta's element defaults still apply.

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

A blank-slate reset would leave headings, lists, links, and tables looking like raw
browser defaults — out of step with the components beside them. Anta's reset instead
gives plain markup the same baseline as `<Title>`, `<Table>`, and the link styles, so a
page mixing prose and components reads as one system. When you want a clean slate, opt
out above.

Every tag the reset has an opinion about, rendered live.

A few are still the browser's own — `dd`, `abbr`, `q`, and `cite`.
`kbd` is left alone on purpose: a keyboard key is a component, not a typographic
default, and one is coming.
