# Title

Use `Title` for page and section headings. It has no margins by default.

## Levels

Set `level` to match the heading’s place in the page hierarchy.

```tsx
import '@antadesign/anta/bundle.css'
import { Title } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Title level={1}>Level 1: Workspace settings</Title>
      <Title level={2}>Level 2: Recent activity</Title>
      <Title level={3}>Level 3: Security alerts</Title>
      <Title level={4}>Level 4: Sign-in policy</Title>
      <Title level={5}>Level 5: Session timeout</Title>
      <Title level={6}>Level 6: Updated five minutes ago</Title>
    </div>
  )
}
```

## Tone × priority

Set `tone` for color and `priority` for emphasis. Omit `tone` for neutral text.

```tsx
import '@antadesign/anta/bundle.css'
import { Title } from '@antadesign/anta/bundle'

const tones = [
  ['Neutral', undefined],
  ['Brand', 'brand'],
  ['Success', 'success'],
  ['Critical', 'critical'],
  ['Warning', 'warning'],
  ['Info', 'info'],
] as const

const priorities = [
  ['Primary', 'primary'],
  ['Secondary', 'secondary'],
  ['Tertiary', 'tertiary'],
  ['Quaternary', 'quaternary'],
] as const

export default function Demo() {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '12px 16px',
        minWidth: '28rem',
        alignItems: 'baseline',
      }}>
        {tones.map(([label, tone]) => (
          <div key={label} style={{ display: 'contents' }}>
            {priorities.map(([name, priority]) => (
              <Title key={priority} level={3} tone={tone} priority={priority}>
                {label}{' '}<br />{name}
              </Title>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Inline content

Icons and inline elements flow with the title text. Icons are visually aligned with the lettering.

```tsx
import '@antadesign/anta/bundle.css'
import { Icon, Title } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Title level={3}>
      <Icon shape="book-open" /> Saved items{' '}
      <span style={{ color: 'var(--text-1-brand)' }}>(3)</span>
    </Title>
  )
}
```

## Truncation

Use `truncate` for one line or pass a number to limit the lines. A clipped title shows its full text in a tooltip on hover.

```tsx
import '@antadesign/anta/bundle.css'
import { Title } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 320 }}>
      <Title truncate>
        A long workspace heading that stays on one line in a compact layout
      </Title>
      <Title truncate={2}>
        A long workspace heading that wraps onto a second line before it gets cut off
      </Title>
    </div>
  )
}
```

## Typeface

Set `font` to `serif`, `sans-serif`, or `monospace`. Omit it to use the theme’s default.

```tsx
import '@antadesign/anta/bundle.css'
import { Title } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Title level={2}>Recent runs</Title>
      <Title level={2} font="sans-serif">Run 4821: 12 failures</Title>
      <Title level={2} font="monospace">checkout-service/run_4821</Title>
    </div>
  )
}
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `font?` | 'serif' \| 'sans-serif' \| 'monospace' | — | Use `serif` for page and section headings, `sans-serif` for headings in cards and panels, or `monospace` for identifiers like run IDs. Omit `font` to use the theme's default for the heading level. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 2 | Sets the heading level and its font size. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | primary | Sets the title’s emphasis. See [Colors](../colors.md#text). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Selects a text palette. Pass a CSS color to create a custom tone. See [Tone × priority](#tone--priority). |
| `truncate?` | boolean \| number | — | Adds an ellipsis when the title exceeds the line limit. Use `true` for one line or a positive integer for the line count. Use `false` or `0` to disable truncation. Clipped titles show their full text in a tooltip. Nest a `<Tooltip>` to customize it. |

## Web Component

In plain HTML, set `role="heading"` and match `aria-level` to `level`. This example uses Vite to load the stylesheet.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anta Title demo</title>
    <script type="module">
      import '@antadesign/anta/bundle.css'
    </script>
  </head>
  <body>
    <a-title level="2" tone="brand" role="heading" aria-level="2">
      Release notes
    </a-title>
  </body>
</html>
```

## Styling

Use your own CSS class to override the heading’s typography.

```tsx
import '@antadesign/anta/bundle.css'
import { Title } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Title className="release-heading" level={3}>Release notes</Title>
      <style>{`
        a-title.release-heading {
          font-size: 18px;
          line-height: 24px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
      `}</style>
    </>
  )
}
```

## Example

```tsx
import { Title } from '@antadesign/anta'

<Title>Section heading</Title>
```
