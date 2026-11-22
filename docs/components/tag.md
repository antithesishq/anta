# Tag

`Tag` displays short statuses, counts, and metadata. Use a label on its own or
pair it with a value, such as a build result or version number.

## Priority

`priority` controls emphasis. Use `primary` for a solid fill, `secondary` for a
subtle fill, or `tertiary` for an outline.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag priority="primary" tone="brand" label="Primary" />
      <Tag tone="brand" label="Secondary" />
      <Tag priority="tertiary" tone="brand" label="Tertiary" />
    </>
  )
}
```

## Tone

`tone` selects a color for the tag. Use a semantic tone to communicate status
alongside a readable label.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag label="Draft" />
      <Tag tone="brand" label="Featured" />
      <Tag tone="info" label="Running" />
      <Tag tone="success" label="Passed" />
      <Tag tone="warning" label="Pending" />
      <Tag tone="critical" label="Failed" />
    </>
  )
}
```

Pass a CSS color to match a category or product color. Tags adapt their colors
to the surrounding light or dark scheme.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag tone="#ff1493" label="Design" />
      <Tag tone="rebeccapurple" label="Engineering" />
      <Tag tone="#0d9488" label="Operations" />
    </>
  )
}
```

The default secondary fill is translucent, so its appearance follows the
surface behind it.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 24, background: 'light-dark(#efeeeb, #252421)' }}>
      <Tag label="Draft" />
      <Tag tone="success" label="Passed" />
      <Tag tone="#0d9488" label="Operations" />
    </div>
  )
}
```

## Size

Match `size` to the surrounding content: use `small` for compact metadata in
dense tables or lists, `medium` for status labels beside body text, and `large`
beside headings or larger controls.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag tone="info" size="small" label="Small" />
      <Tag tone="info" label="Medium" />
      <Tag tone="info" size="large" label="Large" />
    </>
  )
}
```

## Icon, label, and value

Use `label` for a short status. Add `value` for a key-value pair; the label
appears before the value in a heavier weight. `icon` adds a leading icon, and
`iconTrailing` adds a trailing icon.

Constrain the width to truncate long content. The value yields space first,
keeping the label and icons visible for as long as they fit.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag tone="success" icon="circle-check" label="Build" value="Passed" />
      <Tag tone="info" icon="hourglass" label="Running" value="20m 16s" />
      <Tag icon="history" label="Commit" value="4f90d13" />
      <Tag tone="warning" label="Retries" value="3" iconTrailing="refresh" />
      <Tag tone="info" icon="hourglass" label="Deployment" value="Production rollout in us-east-1" style={{ maxWidth: 220 }} />
    </>
  )
}
```

## Segments

Pass child elements for a tag with several segments. A divider separates each
segment after the first. A `label` and `value` pair has no divider.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag>
        <span>v2.1.0</span>
        <span>Stable</span>
        <span>x64</span>
      </Tag>
      <Tag tone="info">
        <span>GET</span>
        <span>200</span>
        <span>142 ms</span>
      </Tag>
      <Tag tone="critical" icon="warning-triangle">
        <span>Exit 137</span>
        <span>Out of memory</span>
      </Tag>
    </>
  )
}
```

## Case

Tags preserve the case of their content by default. Use `allcaps` for short
uppercase labels. Leave it off for names and identifiers whose case matters.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag icon="external-link" label="GitHub" value="v1.6.9" />
      <Tag allcaps label="Running" />
    </>
  )
}
```

## Interactive tags

`Tag` displays content. Wrap it in an anchor when it links to a destination;
the anchor provides keyboard focus and activation.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <a href="/tag/#size">
      <Tag tone="info" icon="external-link" label="Tag sizes" />
    </a>
  )
}
```

Place a `Button` inside a tag when users need to act on it, such as removing
an applied filter. Handle the button's `onClick` to update application state
and control whether the tag is rendered.

```tsx
import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Button, Tag } from '@antadesign/anta'

export default function Demo() {
  const [visible, setVisible] = useState(true)
  const controls = useRef<HTMLDivElement>(null)
  const previousVisible = useRef(visible)

  useLayoutEffect(() => {
    if (previousVisible.current !== visible) {
      controls.current?.querySelector<HTMLElement>('a-button')?.focus()
      previousVisible.current = visible
    }
  }, [visible])

  return (
    <div ref={controls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {visible && (
        <Tag tone="info" label="Frontend">
          <Button
            priority="tertiary"
            tone="info"
            size="small"
            icon="x"
            aria-label="Remove Frontend"
            onClick={() => setVisible(false)}
          />
        </Tag>
      )}
      {!visible && (
        <Button size="small" label="Reset example" onClick={() => setVisible(true)} />
      )}
    </div>
  )
}
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `allcaps?` | boolean | — | Displays the content in uppercase. The original text remains unchanged. |
| `icon?` | IconShape | — | Adds a decorative icon before the text. |
| `iconTrailing?` | IconShape | — | Adds a decorative icon after the text. |
| `label?` | string | — | Displays a short status or a key before `value`. A label paired with a value uses a heavier weight; a label on its own uses the default weight. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | secondary | Sets the emphasis: solid fill, subtle fill, or outline. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Sets the tag's dimensions. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Selects a semantic color. A CSS color defines a custom tone. |
| `value?` | string | — | Displays the tag's value, such as a count, version, or duration. When space is limited, the value truncates before the label. |

## Web Component

Use `<a-tag>` in plain HTML. Load the stylesheet to display it; no registration
script is needed. Use `<a-tag-value>` for the main text and `<a-tag-label>`
for a key before a value.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anta Tag demo</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@antadesign/anta@0.3.38/dist/bundle.css" />
  </head>
  <body>
    <a-tag tone="success">
      <a-tag-label>Build</a-tag-label>
      <a-tag-value>Passed</a-tag-value>
    </a-tag>
  </body>
</html>
```

## Styling

Use `tone`, `priority`, and `size` for the built-in variants. A CSS class can
change the tag's background, shape, spacing, and typography.

```tsx
import { Tag } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <>
      <Tag className="release-tag" label="Release" value="Stable" />
      <style>{`
        a-tag.release-tag {
          background: linear-gradient(135deg, #1f6e5f, #845ec2);
          color: #fff;
          border-radius: 4px;
          padding: 4px 12px;
          font-size: 13px;
          line-height: 18px;
        }
        a-tag.release-tag a-tag-label { letter-spacing: 0.05em; }
      `}</style>
    </>
  )
}
```

## Example

```tsx
import { Tag } from '@antadesign/anta'

export default function Demo() {
  return <Tag tone="info" icon="hourglass" label="Running" value="20m 16s" />
}
```
