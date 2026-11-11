# Title

Use `Title` for headings and set their rank with `level`. For native headings, use
`<h1>`–`<h6>` with Anta’s CSS reset.

## Levels

Set `level` to match the heading’s place in the page hierarchy.

```tsx title="Demo.tsx" excerpt
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

## Typeface

Set `font` to `serif`, `sans-serif`, or `monospace`. Omit it to use the theme’s default.

```tsx title="Demo.tsx" excerpt
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

## Truncation

Use `truncate` for one line or pass a number to limit the lines. Hover over a clipped title to read the full text.

```tsx title="Demo.tsx" excerpt
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

## Level reference

| level | font-size | line-height |
|------:|----------:|------------:|
| 1     | 28px      | 32px        |
| 2     | 24px      | 28px        |
| 3     | 20px      | 24px        |
| 4     | 17px      | 22px        |
| 5     | 15px      | 20px        |
| 6     | 13px      | 16px        |

## Tone × priority

Set `tone` for color and `priority` for emphasis. Omit `tone` for neutral text.

```tsx title="Demo.tsx" excerpt
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
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, max-content)',
        gap: '8px 20px',
        alignItems: 'baseline',
      }}>
        {tones.map(([label, tone]) => (
          <div key={label} style={{ display: 'contents' }}>
            <strong>{label}</strong>
            {priorities.map(([name, priority]) => (
              <Title key={priority} level={3} tone={tone} priority={priority}>
                {name}
              </Title>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `font?` | 'serif' \| 'sans-serif' \| 'monospace' | — | Typeface. Serif names the page and its parts; sans serif names objects on the page, such as cards, panels, and metrics; monospace names technical identifiers, such as run IDs, hashes, and file paths. Omit it to let the theme choose by level: the Antithesis theme sets levels 1–3 in serif and 4–6 in sans serif, and other themes use sans serif throughout. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 2 | Heading level, 1–6. Sets the type scale and the `aria-level` exposed to assistive technology (h1 is typically reserved for the page title). |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | primary | Visual priority. Maps to text-1..text-4 (`primary` = text-1). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is kept while lightness/chroma are pinned per priority in oklch. |
| `truncate?` | boolean \| number | — | Truncate with a trailing ellipsis. `true` (or `1`) clamps to a single line; any integer ≥ 2 clamps to that many lines; `0` or a negative value means no truncation. A clipped JSX `Title` shows its text content in a tooltip by default. Nest a `<Tooltip>` to provide your own tooltip instead. |

## Web Component

In plain HTML, set `role="heading"` and match `aria-level` to `level`. This example uses Vite to load the stylesheet.

```html title="index.html" excerpt
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

```tsx title="Demo.tsx" excerpt
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
