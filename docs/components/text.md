# Text

A block-level container for text and links. `priority` sets emphasis from
`primary` to `quaternary`; the default is `secondary`. `tone` adds a named tint
or custom CSS color, and `inline` selects inline-block layout. Nested links
follow the text's priority and tone.

## Link behavior

Neutral text uses these link colors:

| Priority      | Link color (default)              | Link color (hover)            |
|---------------|-----------------------------------|-------------------------------|
| `primary`     | `--link-color` (brand blue)       | `--link-color-hover`          |
| `secondary`   | `--link-color`                    | `--link-color-hover`          |
| `tertiary`    | `currentColor` (= `--text-3`)     | `--text-2`                    |
| `quaternary`  | `currentColor` (= `--text-4`)     | `--text-3`                    |

Link underlines use 0.5px at 75% alpha, increasing to 1px at full alpha on hover.
`:active` restores the resting underline.

With named tones, links use `currentColor` and the next-stronger level of the same
tone on hover. At `primary`, hover changes only the underline.

## Demo

## Truncation and expansion

`truncate` clamps to one line with `true` or `1`, or to multiple lines with an
integer ≥ 2. `0` and negative values disable truncation. Text uses CSS
`-webkit-line-clamp` in `display: -webkit-box`, with `min-width: 0` for flex and grid layouts.

Clipped, non-expandable JSX Text shows its content in an automatic tooltip.
Nest `<Tooltip>` to replace it or an empty tooltip to suppress it.

```tsx
{/* Single line */}
<Text truncate>{longSentence}</Text>

{/* Multi-line: pass the line count */}
<Text truncate={2}>{longSentence}</Text>
<Text truncate={3}>{longSentence}</Text>
```

Pair `expandable` with `truncate` to reveal all content through **Show more**.
Its fade and chevron appear only when text overflows. Single-line text fades at
the inline end; multiline text fades over the last line. Select the control or
focus it and press Enter or Space to expand. The button reports its expanded
state. Expandable Text has no automatic tooltip.

Expansion is one-way: the control hides after revealing the text. Add
`collapsible` to keep it visible, rotate the chevron, and switch its accessible
label between **Show more** and **Show less**.

The multiline expand target spans the full width; the single-line target
occupies the inline end. While expanded, the full-width collapse target overlays
16px of reserved bottom padding. Folded text has no extra padding, and expansion
preserves its width. Removing the padding with custom CSS allows the control to
overlap content.

Folded content stays selectable and clips without scrolling. The expand control
is the first Tab stop. Content links remain in Tab order and keep native click behavior.

```tsx
{/* One-way: the chevron is hidden once expanded */}
<Text truncate expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
<Text truncate={3} expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>

{/* Two-way: the reader can collapse it back */}
<Text truncate={3} expandable collapsible>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>

{/* Make the folded preview a single expansion target */}
<Text truncate={3} expandable collapsible expandableInert>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
```

`expandableInert` makes the whole folded, overflowing preview an expand target.
JSX applies [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)
to `a-text-content`, blocking focus, clicks, and selection and removing it from
the accessibility tree until expanded. Collapse keeps its 16px area. Fitting
text and server-rendered content before browser measurement remain interactive.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsible?` | boolean | — | Allow refolding after expansion. The control stays visible, rotates its chevron, and switches between "Show more" and "Show less". Requires `expandable`. |
| `expandable?` | boolean | — | Show a fade and expansion control when truncated text overflows. Select the control or focus it and press Enter or Space to reveal all content. Expansion is one-way: the control hides once expanded. Add `collapsible` to allow refolding. Requires `truncate`. |
| `expandableInert?` | boolean | — | Make the entire folded, overflowing preview an expand target. JSX applies `inert` to its content, blocking focus, clicks, and text selection and removing it from the accessibility tree until expanded. Fitting text stays interactive, as does server-rendered content before browser measurement. Requires `expandable`. |
| `inline?` | boolean | — | Render as inline-block instead of the default block element. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Text emphasis, from `primary` (`--text-1`, strongest) to `quaternary` (`--text-4`). `secondary` uses `--text-2`. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Font size / line height in pixels: `small` = 13/16, `medium` = 15/20, `large` = 17/24. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` uses `--text-{N}`; named tones use `--text-{N}-{tone}`. A CSS color such as `rebeccapurple` keeps its hue, with lightness and chroma set per priority in oklch. |
| `truncate?` | boolean \| number | — | Clamp with a trailing ellipsis: `true` or `1` selects one line, integers ≥ 2 select that many lines, and `0` or negative values disable truncation. Clipped, non-expandable Text shows its content in an automatic tooltip. Nest `<Tooltip>` to replace it or an empty tooltip to suppress it. |

## Web Component

Use `<a-text>` directly for text priority and tone.

```html
<a-text priority="secondary">
  Read the <a href="/colors/">color guidance</a>.
</a-text>
```

### Use a tooltip with the web component

Raw Text has no automatic tooltip. Nest `<a-tooltip truncated-only>` with the
full text:

```html
<a-text truncate="1" style="max-width: 260px; cursor: help">
  A long status message that is clipped until you hover it.
  <a-tooltip truncated-only>
    A long status message that is clipped until you hover it.
  </a-tooltip>
</a-text>
```

Read `a-text.isTruncated` on the UI thread to check whether the clamp hides content.
This read-only layout measurement does not change markup or accessibility.

### Expand raw HTML

Place a direct `a-button` before `a-text-content` to put expansion first in Tab
order. No application toggle handler is needed. Load both entries alongside your
shared tokens and styles:

```ts
import '@antadesign/anta/elements/a-text'
import '@antadesign/anta/elements/a-button'
```

```html
<a-text truncate="1" expandable collapsible>
  <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
  <a-text-content>A long description that needs more than one line.</a-text-content>
</a-text>
```

Text owns overflow and expansion; Button supplies its accessible label and
expanded state. Both use `ElementInternals` and leave authored attributes and
children untouched. Explicit button ARIA overrides the defaults; synchronize any
authored `aria-expanded` yourself. One-way expansion hides the control without
removing it.

Migrate flat expandable raw markup to these two children. Plain Text needs no
content wrapper, and JSX supplies expansion markup. Both modes use light DOM
and external CSS, with no injected stylesheet.

For multiline raw Text, set `--line-clamp` in your stylesheet. JSX sets the line
count through the `truncate` prop:

```html
<a-text class="summary" truncate="3" expandable collapsible>
  <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
  <a-text-content>A longer description to show across three lines.</a-text-content>
</a-text>
```

```css
a-text.summary { --line-clamp: 3; }
```

### Make folded content inert

Raw authors manage `inert` on `a-text-content`. Add `expandable-inert` for a
full-preview expand target, and update `inert` from `textpresentationchange`:

```html
<a-text id="summary" truncate="1" expandable collapsible expandable-inert>
  <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
  <a-text-content>A long description with <a href="/text/">a link</a>.</a-text-content>
</a-text>
```

```js
const text = document.querySelector('#summary')
const content = text.querySelector(':scope > a-text-content')
text.addEventListener('textpresentationchange', ({ detail }) => {
  content.inert = detail.overflowing && !detail.expanded
})
```

This non-bubbling notification reports `{ expanded, overflowing }` after
measurement or expansion. Late listeners receive the current snapshot
asynchronously. `overflowing` describes the folded preview, retained while
expanded. The element leaves `inert` to you.

## Styling

Use `priority`, `tone`, and `size` for emphasis, color, and type scale. Neutral
and named tones use shared text and link tokens (see [Colors](../colors.md)). Changing
them on `:root` or `.dark` updates Text throughout that scope. Custom colors use
`--text-tone-source` for oklch derivation.

```tsx
<Text priority="secondary" tone="brand">Tinted secondary text</Text>
<Text tone="#0d9488">Custom-tone body copy</Text>
```

Style the light-DOM host, content, control, and links with plain CSS. The `.fancy`
class belongs to this example:

```css
/* Anta's theme controls color-scheme for light-dark(). */
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
