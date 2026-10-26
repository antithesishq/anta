# Title

Use Title for page, section, and component headings. Choose a heading level,
then adjust its emphasis with `priority` and `tone`.

Title has no margins. Use the parent's `gap` or padding to space it within a
layout. For native HTML heading elements, use `<h1>`–`<h6>` with Anta's reset.

## Levels

Choose `level` to match the heading hierarchy. It sets the type scale and the
heading level announced by screen readers. This example uses a parent `gap`
to space the titles.

## Typeface

Use `serif` for page and section titles, `sans-serif` for cards, panels, and
metrics, and `monospace` for identifiers such as run IDs and file paths.

Omit `font` to use the theme's choice. The Antithesis theme uses serif for
levels 1–3 and sans serif for levels 4–6. Other themes use sans serif throughout.
Changing `font` preserves the heading's size and line height.

```tsx
<Title level={2}>Recent runs</Title>
<Title level={2} font="sans-serif">Run 4821: 12 failures</Title>
<Title level={2} font="monospace">checkout-service/run_4821</Title>
```

Each typeface covers all six levels.

```tsx
<Title level={1} font="serif">Serif 1</Title>
<Title level={1} font="sans-serif">Sans serif 1</Title>
<Title level={1} font="monospace">Monospace 1</Title>
```

A string `header` on a [Card](./card.md) renders a sans-serif title at every card
size.

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

## Truncation

Pass `truncate` for a single-line ellipsis or a positive number to clamp to that
many lines. When the title is clipped, JSX `Title` shows its full text in a
tooltip. A nested `<Tooltip>` overrides that automatic tooltip.

```tsx
<Title truncate style={{ maxWidth: '320px' }}>
  A long workspace heading that stays on one line in a compact layout
</Title>
```

Use a number for multi-line titles.

```tsx
<Title truncate={2}>A long heading clamped after its second line</Title>
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

Use `priority` to choose emphasis, from `primary` through `quaternary`.
Use `tone` for a named color or a custom CSS color. Omit it for neutral text.
The examples compare every named tone at `level={3}`.


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

Title exposes `role="heading"` and an `aria-level` matching `level`. Choose
levels that follow the page's heading hierarchy. When your integration requires
native HTML headings, use `<h1>`–`<h6>` with Anta's reset for the same type scale
and document margins.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `font?` | 'serif' \| 'sans-serif' \| 'monospace' | — | Typeface. Serif names the page and its parts; sans serif names objects on the page, such as cards, panels, and metrics; monospace names technical identifiers, such as run IDs, hashes, and file paths. Omit it to let the theme choose by level: the Antithesis theme sets levels 1–3 in serif and 4–6 in sans serif, and other themes use sans serif throughout. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 2 | Heading level, 1–6. Sets the type scale and the `aria-level` exposed to assistive technology (h1 is typically reserved for the page title). |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | primary | Visual priority. Maps to text-1..text-4 (`primary` = text-1). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is kept while lightness/chroma are pinned per priority in oklch. |
| `truncate?` | boolean \| number | — | Truncate with a trailing ellipsis. `true` (or `1`) clamps to a single line; any integer ≥ 2 clamps to that many lines; `0` or a negative value means no truncation. A clipped JSX `Title` shows its text content in a tooltip by default. Nest a `<Tooltip>` to provide your own tooltip instead. |

## Web Component

Use `<a-title>` directly outside JSX. Set both `role="heading"` and
`aria-level` to describe its place in the heading hierarchy.

```html
<a-title level="2" tone="brand" role="heading" aria-level="2">
  Release notes
</a-title>
```

## Styling

Start with `priority` and `tone` for emphasis and color:

```tsx
<Title priority="secondary">Supporting heading</Title>
<Title tone="#0d9488">Custom-tone heading</Title>
```

Target `a-title` with ordinary CSS to adjust its typography. The
`.release-heading` class scopes this example. Replace it with your own selector.

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
