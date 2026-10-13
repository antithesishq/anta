# Text

A block-level text container that scopes the color hierarchy of its
contents. `priority` sets the emphasis from `primary` (`--text-1`) to
`quaternary` (`--text-4`). It defaults to `secondary` (`--text-2`), so body
text reads a step softer than the strongest foreground; pass `primary`
for emphasis. `tone` adds a tint (`brand`, `success`, `critical`,
`warning`, `info`, or any literal CSS color for a one-off custom tone); the
default `neutral` leaves it untinted. `inline` renders it `inline-block` for use
mid-sentence.

Links nested inside `<Text>` take Anta's prose-link styling from the
design system, with no per-page overrides to maintain.

## Link behavior

Links inside `<Text>` follow a priority-aware hierarchy that keeps
emphasis consistent with the surrounding text:

| Priority      | Link color (default)              | Link color (hover)            |
|---------------|-----------------------------------|-------------------------------|
| `primary`     | `--link-color` (brand blue)       | `--link-color-hover`          |
| `secondary`   | `--link-color`                    | `--link-color-hover`          |
| `tertiary`    | `currentColor` (= `--text-3`)     | `--text-2`                    |
| `quaternary`  | `currentColor` (= `--text-4`)     | `--text-3`                    |

The underline is a 0.5px hairline at 75% alpha by default and bumps to
1px / 100% alpha on hover. On `:active` it returns to the 0.5px / 75%
resting state.

For tinted text (`tone="brand|success|critical|warning|info"`) links are
always muted regardless of priority: they take `currentColor` and step up
to the next-stronger level of the same tint on hover. At
`priority="primary"` there is no level above, so hovering only brings the
underline to full alpha.

## Demo

## Truncation and expansion

`truncate` takes `true` (or `1`) for a single-line ellipsis, any integer
≥ 2 for multi-line clamping, and `0` or a negative value for no
truncation. Both modes use `-webkit-line-clamp` inside
`display: -webkit-box`, supported in every major browser despite the
prefix (Firefox 68+, Chrome, Safari, Edge). The host gets `min-width: 0`
so truncation works inside flex and grid containers.

JSX `Text` adds a `truncatedOnly` tooltip containing its text content. It
opens only when the text clips. Nest a `<Tooltip>` to replace that tooltip;
an empty nested tooltip suppresses it. `expandable` text has no automatic
tooltip because its own control reveals the content. Tooltip still has its own
shadow styling and CSP requirements; see [Content Security Policy](../install-config.md#content-security-policy).

```tsx
{/* Single line */}
<Text truncate>{longSentence}</Text>

{/* Multi-line: pass the line count */}
<Text truncate={2}>{longSentence}</Text>
<Text truncate={3}>{longSentence}</Text>
```

Pair `expandable` with `truncate` to let the reader reveal the full text.
The fade and chevron appear only when the clamped content overflows; text
that fits gets neither. Single-line truncation fades on the right edge,
multi-line over the last line. The chevron is a light-DOM `a-button` with
button semantics and an accessible expanded state: click it, or focus it and
press Enter or Space, to drop the clamp.
`expandable` takes effect only with `truncate`.

Expanding is one-way by default, so the control is hidden once the text
is revealed. Add `collapsible` for a two-way toggle: the chevron stays
visible while expanded (rotated up) and flips its label between "Show
more" and "Show less". The collapse control follows the revealed text in normal
flow and wraps when needed, so it does not cover links in the final line. `collapsible` takes effect only with `expandable`.

```tsx
{/* One-way: the chevron is hidden once expanded */}
<Text truncate expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
<Text truncate={3} expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>

{/* Two-way: the reader can collapse it back */}
<Text truncate={3} expandable collapsible>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsible?` | boolean | — | Let the reader collapse back after expanding: the chevron becomes a "Show more" / "Show less" toggle that stays visible while expanded. Only takes effect together with `expandable`. |
| `expandable?` | boolean | — | Show a fade hint and chevron over the truncated text and let the user expand it by clicking the chevron region or pressing Enter while the chevron has keyboard focus. Only takes effect together with `truncate`. On its own, expanding is **one-way** — the control is hidden once expanded; add `collapsible` for a two-way toggle. |
| `inline?` | boolean | — | Render as inline-block instead of the default block element. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Visual priority. Maps to text-1..text-4 (`primary` = text-1, the strongest). The default is `secondary` (text-2) — body text reads a step softer than the strongest foreground; pass `primary` for emphasis. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Type scale. `small` = 13/16, `medium` = 15/20, `large` = 17/24. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is kept while lightness/chroma are pinned per priority in oklch. |
| `truncate?` | boolean \| number | — | Truncate with a trailing ellipsis. `true` (or `1`) clamps to a single line; any integer ≥ 2 clamps to that many lines; `0` or a negative value means no truncation. A clipped, non-expandable JSX `Text` shows its text content in a tooltip by default. Nest a `<Tooltip>` to provide your own tooltip instead. Uses the `-webkit-line-clamp` technique, supported in all major browsers (Firefox 68+, Chrome, Safari, Edge). |

## Web Component

Use `<a-text>` directly for a block that carries the text priority and tone.

```html
<a-text priority="secondary">
  Read the <a href="/colors/">color guidance</a>.
</a-text>
```

### Use a tooltip with the web component

`<a-text>` does not add a tooltip. Nest `<a-tooltip truncated-only>` and pass
the full text as its content:

```html
<a-text truncate="1" style="max-width: 260px; cursor: help">
  A long status message that is clipped until you hover it.
  <a-tooltip truncated-only>
    A long status message that is clipped until you hover it.
  </a-tooltip>
</a-text>
```

`a-text.isTruncated` is a read-only layout measurement. Read it on the UI
thread when you compose custom truncation behavior.

### Expand raw HTML

Expandable raw Text needs an `a-text-content` region and a direct `a-button`
control. Both elements work without JSX or application-written toggle handlers.
Import their entries alongside your shared tokens and styles:

```ts
import '@antadesign/anta/elements/a-text'
import '@antadesign/anta/elements/a-button'
```

```html
<a-text truncate="1" expandable collapsible>
  <a-text-content>A long description that needs more than one line.</a-text-content>
  <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
</a-text>
```

The Text element owns overflow and expansion state through `ElementInternals`.
The Button element publishes its own accessible label and expanded state through
`ElementInternals` too. Neither rewrites your attributes or children. Explicit
ARIA on the button overrides those defaults; keep any explicit `aria-expanded`
value synchronized yourself. The control stays in the DOM and becomes hidden
after one-way expansion.

Existing flat expandable raw markup needs these two children. Ordinary raw Text
and the JSX props remain unchanged. Plain Text has no extra content wrapper;
expandable Text has no shadow root or injected stylesheet.

For multi-line raw Text, set `--line-clamp` in an allowed stylesheet. JSX sets
counts greater than one through an inline custom property, which needs separate
handling under `style-src-attr 'none'` (see [Content Security Policy](../install-config.md#content-security-policy)):

```html
<a-text class="summary" truncate="3" expandable collapsible>
  <a-text-content>A longer description to show across three lines.</a-text-content>
  <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
</a-text>
```

```css
a-text.summary { --line-clamp: 3; }
```

## Styling

Color comes from **`priority`** (the neutral text level) and **`tone`** (the tint);
`size` and the type props set the rest. For a named tone, `Text` consumes the
global **text role tokens** (`--text-1` … `--text-5`, the `-{tone}` tints,
`--link-color`), so retuning those once on `:root` / `.dark` shifts text color
everywhere (see [Colors](../colors.md)). A custom `tone` (any CSS color) is derived in
oklch from **`--text-tone-source`** — the same one-off knob as `Button` / `Tag`.

```tsx
<Text priority="secondary" tone="brand">Tinted secondary text</Text>
<Text tone="#0d9488">Custom-tone body copy</Text>
```

`<a-text>` uses light DOM, so one-offs are plain CSS on the element or its prose
links. The `.fancy` class names the demo example:

```css
/* teal body text via light-dark() (deep in light, bright in dark; Anta drives
   color-scheme from its theme toggle), with wider tracking */
a-text.fancy {
  color: light-dark(#0f6e5f, #5fd0bb);
  font-size: 16px;
  line-height: 1.7;
  letter-spacing: 0.06em;
}
a-text.fancy a { text-decoration-thickness: 2px; text-underline-offset: 3px; }
```

## Example

```tsx
import { Text } from '@antadesign/anta'

<Text>The quick brown fox jumps over the lazy dog with a <a href="#">link inside</a> the sentence, followed by enough additional prose to push the paragraph well past a single line. Curabitur sodales ligula in libero, and Donec a tincidunt elit. Mauris vehicula, est nec porta cursus, tellus eros vestibulum lectus, vitae luctus turpis enim sed nibh.</Text>
```
