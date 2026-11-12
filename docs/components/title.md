# Title

`Title` renders page and section headings with no margins by default.

## Levels

`level` sets the heading’s rank and font size. It defaults to `2`.

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

`tone` selects the text palette, and `priority` selects a shade within it. The default tone is `neutral`.

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

`truncate` limits the title to one line when set to `true`. A positive integer sets the line limit. A clipped title shows its full text in a tooltip on hover.

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

`font` selects `serif`, `sans-serif`, or `monospace`. By default, the theme chooses the typeface for each heading level.

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
| `font?` | 'serif' \| 'sans-serif' \| 'monospace' | — | Selects the typeface. Serif suits page and section headings, sans serif suits headings in cards and panels, and monospace suits identifiers like run IDs. The default comes from the theme and heading level. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 2 | Sets the heading level and its font size. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | primary | Sets the title’s emphasis. See [Colors](../colors.md#text). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Selects a text palette. A CSS color defines a custom tone. See [Tone × priority](#tone--priority). |
| `truncate?` | boolean \| number | — | Adds an ellipsis when the title exceeds the line limit. `true` limits it to one line, and a positive integer sets the line count. `false` and numbers below `1` disable truncation. A clipped title shows its full text in a tooltip. A nested `<Tooltip>` replaces the default tooltip. |

## Web Component

In plain HTML, `role="heading"` identifies `<a-title>` as a heading, and `aria-level` gives it the same rank as `level`. The stylesheet loads from jsDelivr.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anta Title demo</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css" />
  </head>
  <body>
    <a-title level="2" tone="brand" role="heading" aria-level="2">
      Release notes
    </a-title>
  </body>
</html>
```

## Styling

A CSS class can override the heading’s typography.

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
