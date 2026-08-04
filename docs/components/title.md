# Title

A margin-free heading with six `level`s. `level` sets the type scale and the
`aria-level` exposed to assistive technology. `priority` runs from `primary`
through `quaternary` (`--text-1` through `--text-4`); `tone` accepts `neutral`
(the default), a named tone, or a literal CSS color.

Use a raw `<h1>`–`<h6>` for document-outline or SEO semantics. Anta's reset
gives those headings the same type scale and document margins. Use `<Title>` in
component layouts when you need tone, priority, or parent-controlled spacing.

> **`<Title>` has no margins.** Space it with the parent’s `gap` or padding. For
> a one-off, add `marginBlock` to the title itself.

## Levels

The parent supplies the `16px` gap between these titles.

  Level 1: Workspace settings
  Level 2: Recent activity
  Level 3: Security alerts
  Level 4: Sign-in policy
  Level 5: Session timeout
  Level 6: Updated five minutes ago

## Inline content

Pass icons and inline elements as children. Icons are optically aligned with
the title text.

```tsx
<Title level={3}>
  <Icon shape="book-open" /> Saved items{' '}
  <span style={{ color: 'var(--text-1-brand)' }}>(3)</span>
</Title>
```

Use a span for a small inline accent. Don't nest `<Text>` or `<a-text>` inside a
title: they are block containers, while heading content should remain inline.

## Level reference

| level | font-size | line-height |
|------:|----------:|------------:|
| 1     | 28px      | 32px        |
| 2     | 24px      | 28px        |
| 3     | 20px      | 24px        |
| 4     | 17px      | 20px        |
| 5     | 15px      | 20px        |
| 6     | 13px      | 16px        |

## Tone × priority

The four priorities are shown across every named tone at `level={3}`. Omit
`tone` for the neutral scale. The grid scrolls horizontally on narrow screens.


    Neutral primary
    Secondary
    Tertiary
    Quaternary

    Brand primary
    Secondary
    Tertiary
    Quaternary

    Success primary
    Secondary
    Tertiary
    Quaternary

    Critical primary
    Secondary
    Tertiary
    Quaternary

    Warning primary
    Secondary
    Tertiary
    Quaternary

    Info primary
    Secondary
    Tertiary
    Quaternary


## Accessibility

`<Title>` renders an `<a-title>` tag with `role="heading"` and
`aria-level={level}`. It is not a real `<h*>`. Use a raw heading when the HTML
document outline or SEO needs heading elements; the reset applies the same type
scale.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 2 | Heading level, 1-6. Drives font-size, line-height, and vertical
 rhythm. Also surfaced to assistive tech via `aria-level`
 (h1 is typically reserved for the page title). |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | primary | Visual priority. Maps to text-1..text-4 (`primary` = text-1). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a
 named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS
 color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is
 kept while lightness/chroma are pinned per priority in oklch. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Set the heading role and level when writing `<a-title>` directly.

```html
<a-title level="2" tone="brand" role="heading" aria-level="2">
  Release notes
</a-title>
```

`priority` selects a neutral text level. Named `tone`s use the matching global
text tokens. A literal `tone` is stored in `--title-tone-source` and resolved
into the four priority levels.

```tsx
<Title priority="secondary">Supporting heading</Title>
<Title tone="#0d9488">Custom-tone heading</Title>
```

`<a-title>` is light DOM, so local type treatment is ordinary CSS. The class is
only for this example.

```css
a-title.release-heading {
  font-size: 18px;
  line-height: 24px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

## Example

```tsx
import { Title } from '@antadesign/anta'

<Title>Section heading</Title>
```
