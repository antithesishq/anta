# Text

Use Text for body copy, descriptions, and supporting information. Set `priority`
to emphasize important content or soften secondary details, and use `tone` to
add color. Text also styles any links inside it.

## Link behavior

Links follow the surrounding text's emphasis and color. In supporting text,
they stay muted; hover makes them easier to identify. The examples show how
links look at each priority and tone.

## Demo

## Truncation and expansion

Use `truncate` to keep long text compact. Pass a number to choose how many lines
to show. Readers can hover over shortened text to read the full content in a tooltip.

```tsx
{/* Single line */}
<Text truncate>{longSentence}</Text>

{/* Multi-line: pass the line count */}
<Text truncate={2}>{longSentence}</Text>
<Text truncate={3}>{longSentence}</Text>
```

Add `expandable` to let readers reveal long text when they need it. The **Show more**
icon button appears only when the text does not fit. Add `collapsible` to let them fold it again.

```tsx
{/* One-way: the chevron is hidden once expanded */}
<Text truncate expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
<Text truncate={3} expandable>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>

{/* Two-way: the reader can collapse it back */}
<Text truncate={3} expandable collapsible>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>

{/* Make the folded preview a single expansion target */}
<Text truncate={3} expandable collapsible expandableInert>{longSentence} <a href="/text/#link-behavior">Link guidance</a>.</Text>
```

Use `expandableInert` when readers should expand the text before following its
links. Selecting anywhere in the folded preview expands it; its links become
available after expansion.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsible?` | boolean | — | Allow refolding after expansion. The control stays visible, rotates its chevron, and switches between "Show more" and "Show less". Requires `expandable`. The expanded collapse target spans the full width over 16px of bottom padding; removing that padding with custom CSS allows it to overlap content. |
| `expandable?` | boolean | — | Show a fade and expansion control when truncated text overflows. Select the control or focus it and press Enter or Space to reveal all content. Expansion is one-way: the control hides once expanded. Add `collapsible` to allow refolding. Requires `truncate`; disables the automatic tooltip. The control comes first in Tab order. By default, folded text stays selectable and its links remain focusable and clickable. Single-line text fades at the inline end with an inline-end target; multiline text fades over its last line with a full-width target. Folded content clips without scrolling or extra padding, and expansion preserves its width. |
| `expandableInert?` | boolean | — | Make the entire folded, overflowing preview an expand target. JSX applies `inert` to its content, blocking focus, clicks, and text selection and removing it from the accessibility tree until expanded. Fitting text stays interactive, as does server-rendered content before browser measurement. Requires `expandable`. |
| `inline?` | boolean | — | Render as inline-block instead of the default block element. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Text emphasis, from `primary` (`--text-1`, strongest) to `quaternary` (`--text-4`). `secondary` uses `--text-2`; `tertiary` uses `--text-3`. Neutral primary/secondary links use `--link-color` and `--link-color-hover`. Tertiary/quaternary links inherit the text color, with `--text-2` and `--text-3` respectively on hover. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Font size / line height in pixels: `small` = 13/16, `medium` = 15/20, `large` = 17/24. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` uses `--text-{N}`; named tones use `--text-{N}-{tone}`. A CSS color such as `rebeccapurple` keeps its hue, with lightness and chroma set per priority in oklch. With named tones, links inherit the text color and hover uses the next-stronger tone level; at `primary`, hover changes only the underline. |
| `truncate?` | boolean \| number | — | Clamp with a trailing ellipsis: `true` or `1` selects one line, integers ≥ 2 select that many lines, and `0` or negative values disable truncation. Clipped, non-expandable Text shows its content in an automatic tooltip. Nest `<Tooltip>` to replace it or an empty tooltip to suppress it. Uses CSS `-webkit-line-clamp` in `display: -webkit-box`, with `min-width: 0` for flex and grid layouts. |

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

Expansion and accessible button labels work automatically. Your attributes and
children stay unchanged. Explicit button ARIA overrides the defaults;
synchronize any authored `aria-expanded` yourself.

Migrate flat expandable raw markup to these two children. JSX supplies them for
you; plain Text needs no content wrapper.

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

Use `priority`, `tone`, and `size` for emphasis, color, and type scale. Shared
[Colors](../colors.md) keep Text consistent with your theme. For a custom color,
pass `tone` or set `--text-tone-source`.

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
