# Text

`Text` is for paragraphs and descriptions under headings.
Text also styles any links inside it.

## Link behavior

Links follow the surrounding text's emphasis and color. In supporting text,
they stay muted. The examples show how links and inline code look at each `priority` and `tone`.

## Tones

```tsx
import '@antadesign/anta/bundle.css'
import { Text } from '@antadesign/anta/bundle'

const priorities = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

export default function Demo() {
  return (
    <>
      {priorities.map(priority => (
        <Text key={priority} tone="brand" priority={priority}>
          The <a href="#link-behavior">link behavior section</a> shows links next to code like <code>npm install</code>.
        </Text>
      ))}
    </>
  )
}
```

## Truncation and expansion

`truncate` limits text to one line with `true` or to a specific line count with a number.
Clipped text shows its full content in a tooltip on hover.

```tsx
import '@antadesign/anta/bundle.css'
import { Text } from '@antadesign/anta/bundle'

const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years and years.'

export default function Demo() {
  return (
    <div style={{ maxWidth: 320, display: 'grid', gap: 12 }}>
      <Text truncate>{longText}</Text>
      <Text truncate={2}>{longText}</Text>
      <Text truncate={3}>{longText}</Text>
    </div>
  )
}
```

`expandable` shows a **Show more** control when the text overflows.
`collapsible` lets readers fold the text again.

```tsx
import '@antadesign/anta/bundle.css'
import { Text } from '@antadesign/anta/bundle'

const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years and years.'

const content = (
  <>
    {longText} <a href="https://anta.design/text/#link-behavior">Link guidance</a>.
  </>
)

export default function Demo() {
  return (
    <div style={{ maxWidth: 320, display: 'grid', gap: 12 }}>
      <Text truncate expandable>{content}</Text>
      <Text truncate={3} expandable>{content}</Text>
      <Text truncate={3} expandable collapsible>{content}</Text>
      <Text truncate={3} expandable collapsible expandableInert>{content}</Text>
    </div>
  )
}
```

`expandableInert` makes the whole folded preview an expansion target. Links become available after expansion.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsible?` | boolean | — | Keeps the control visible after expansion so readers can collapse the text again. Requires `expandable`. |
| `expandable?` | boolean | — | Shows a fade and a **Show more** control when truncated text overflows. Requires `truncate` and replaces the automatic tooltip. |
| `expandableInert?` | boolean | — | Makes the whole clipped preview an expansion target. Links and text selection become available after expansion. Requires `expandable`. |
| `inline?` | boolean | — | Lets Text sit within a line as an inline block. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Controls text emphasis, from `primary` (strongest) to `quaternary`. See [Tones](#tones) for examples. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Sets font size and line height: `small` 13/16 px, `medium` 15/20 px, and `large` 17/24 px. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Selects a text palette. A CSS color defines a custom tone. See [Tones](#tones) for examples. |
| `truncate?` | boolean \| number | — | Adds an ellipsis at the line limit. `true` limits text to one line, a positive integer sets the line count, and `false` or numbers below `1` disable truncation. Clipped text shows a tooltip when expansion is off. A nested `<Tooltip>` replaces it, and an empty tooltip suppresses it. |

## Web Component

`<a-text>` supports priority and tone in plain HTML. The stylesheet handles basic text styling.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Anta Text</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css">
  </head>
  <body>
    <a-text priority="secondary">
      Read the <a href="https://anta.design/colors/">color guidance</a>.
    </a-text>
    <a-text priority="primary" tone="success">Your changes have been saved.</a-text>
  </body>
</html>
```

### Use a tooltip with the web component

A nested `<a-tooltip truncated-only>` shows the full text on hover when the text is clipped.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Text tooltip</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css">
    <script type="module" src="https://esm.sh/@antadesign/anta@0.3.38/bundle?bundle"></script>
  </head>
  <body>
    <a-text truncate="1" style="max-width: 260px; cursor: help">
      A long status message that is clipped until you hover it.
      <a-tooltip truncated-only>
        A long status message that is clipped until you hover it.
      </a-tooltip>
    </a-text>
  </body>
</html>
```

The read-only `isTruncated` property reports whether the text is clipped.

### Expand raw HTML

The expansion control comes before `<a-text-content>` in the markup and in Tab order.
Anta handles expansion and supplies the button labels. An explicit `aria-expanded`
overrides Anta’s value and needs to stay in sync with the button.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Expandable text</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css">
    <script type="module" src="https://esm.sh/@antadesign/anta@0.3.38/bundle?bundle"></script>
  </head>
  <body>
    <a-text truncate="1" expandable collapsible style="max-width: 260px">
      <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
      <a-text-content>The project settings apply to every workspace in the organization. Changes take effect the next time a workspace opens.</a-text-content>
    </a-text>
  </body>
</html>
```

For multiple lines, `--line-clamp` sets the line limit.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Expandable multiline text</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css">
    <script type="module" src="https://esm.sh/@antadesign/anta@0.3.38/bundle?bundle"></script>
    <style>.summary { max-width: 260px; --line-clamp: 3; }</style>
  </head>
  <body>
    <a-text class="summary" truncate="3" expandable collapsible>
      <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
      <a-text-content>The project settings apply to every workspace in the organization. Changes take effect the next time a workspace opens. The project settings apply to every workspace in the organization. Changes take effect the next time a workspace opens.</a-text-content>
    </a-text>
  </body>
</html>
```

### Make folded content inert

`expandable-inert` makes the whole folded preview an expansion target. In plain HTML,
the `textpresentationchange` event reports when to make the folded content inert.
The event also gives late listeners the current state.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Expandable text with an inert preview</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css">
    <script type="module" src="https://esm.sh/@antadesign/anta@0.3.38/bundle?bundle"></script>
  </head>
  <body>
    <a-text id="summary" truncate="1" expandable collapsible expandable-inert style="max-width: 260px">
      <a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button>
      <a-text-content>The project settings apply to every workspace in the organization. Changes take effect the next time a workspace opens. <a href="https://anta.design/text/">Text docs</a>.</a-text-content>
    </a-text>
    <script type="module">
      const text = document.querySelector('#summary')
      const content = text.querySelector('a-text-content')

      text.addEventListener('textpresentationchange', ({ detail }) => {
        content.inert = detail.overflowing && !detail.expanded
      })
    </script>
  </body>
</html>
```

## Styling

Use `priority`, `tone`, and `size` for emphasis, color, and type scale. Shared
[Colors](../colors.md) keep Text consistent with your theme. For a custom color,
pass `tone` or set `--text-tone-source`.

```tsx
import '@antadesign/anta/bundle.css'
import { Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Text priority="secondary" tone="brand">Tinted secondary text</Text>
      <Text tone="#0d9488">Custom-tone body copy</Text>
    </>
  )
}
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
