# Box

`Box` is a DOM container with layout props, overflow states, browser context
events. For custom wheel, pointer, and touch handling, use [Capture](./capture.md).

## Display

Use `display`, `gap`, and `round` for layout and corners. Numeric lengths use
pixels; strings accept CSS lengths. A bare `round` fully rounds the corners.

```tsx
<Box round={8}><span /></Box>
<Box display="flex" round={8} gap={6}><span /></Box>
<Box display="grid" round={8} gap="0.5rem" style={{ gridTemplateColumns: '1fr 1fr' }}><span /></Box>
```

## Overflow

Box reports overflow, clipping, and scrollability as measurements and CSS
states. Use `observe="size"` to keep CSS states current. `fade` and
`onMeasureChange` also enable measurement; without these, Box adds no size
observers.

`.edge` is a demo class name. Use your own selector.

```tsx
<Box observe="size" round={8} className="edge" style={{ width: 150 }}>Content that fits.</Box>

<Box observe="size" round={8} className="edge" style={{ width: 150, overflow: 'hidden', whiteSpace: 'nowrap' }}>
  A label too long for this box.
</Box>

<Box observe="size" round={8} className="edge" style={{ width: 150, height: 56, overflowY: 'auto' }}>
  One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.
</Box>
```

```css
.edge:state(clipped-x) { border-color: var(--border-3-warning); }
.edge:state(scrollable-y) { border-color: var(--border-3-info); }
```

### Fading a clipped edge

`fade` masks edges with hidden content and removes the mask as scrolling reveals
them. `fadeSize` sets its depth. It measures on connection, even off screen.

```tsx
<Box fade fadeSize={32} round display="flex" gap={6} style={{ overflowX: 'auto' }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
</Box>
```

The mask clips to the padding box. It preserves the Box border, shadows, and
focus ring when no edge is hidden.

To style hidden edges without `fade`, use `observe="size"` and the
`hidden-start-x`, `hidden-end-x`, `hidden-start-y`, or `hidden-end-y` CSS states.

```css
/* <Box observe="size" className="my-box"> */
.my-box:state(hidden-end-x) {
  mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
}
```

### Tooltip on clipped content

`Tooltip truncatedOnly` shows when Box clips content on either axis, including
wrapped children.

```tsx
const TAGS = ['frontend', 'design-system', 'a11y', 'performance']

<Box display="flex" round={8} gap={6} className="tag-box" style={{ height: 34 }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
  <Tooltip truncatedOnly>{TAGS.join(' · ')}</Tooltip>
</Box>
```

```css
.tag-box { flex-wrap: wrap; padding: 6px; overflow: hidden; }
```

## Measurements

`onMeasureChange` reports one frame after observation starts and when the Box or
its content changes. `changed` contains changed fields; `current` is the full
snapshot. Reporting pauses off screen and resumes when Box returns.

```tsx title="measurechange"
<Box
  style={{ maxWidth: 210, overflow: 'hidden', whiteSpace: 'nowrap' }}
  onMeasureChange={(_, { changed, current }) => {
    // changed → { clippedX: true, scrollWidth: 412 }
    if (changed.clippedX) setShowOverflowHint(current.clippedX)
  }}
>
  Long account name
</Box>
```

Resize or scroll the Box to update its measurements.

See the [measurement fields](#boxmeasurement). Overflow fields map to kebab-case
CSS states, such as `clippedX` → `:state(clipped-x)`.

## Context

`onContextChange` reports theme, focus, and browser context as
`{ changed, current }`. See the [context fields](#boxcontext). For CSS, use
`:focus-within`, mode classes, and media queries instead.

Switch themes, resize, or zoom to update the preview. The `.light` Box keeps its
local `mode`; `globalMode` follows the document. Browser and OS versions may be
frozen, so use `pointer`, `hover`, or feature tests to choose behavior.

The scoped readout stores the current context:

```tsx title="contextchange"
import { useState } from 'react'
import { Box, Tag, type BoxContext } from '@antadesign/anta'

function ScopedContext() {
  const [context, setContext] = useState<BoxContext | null>(null)

  return (
    <div className="light">
      <Box display="flex" gap={6} onContextChange={(_, { current }) => setContext(current)}>
        <Tag size="small" label="mode" value={context?.mode ?? '…'} />
        <Tag size="small" label="globalMode" value={context?.globalMode ?? '…'} />
      </Box>
    </div>
  )
}
```

<a id="canvas"></a>

### Canvas-related styles

Use `context.font`, `context.inset`, and `devicePixelRatio` to align canvas text
with the DOM. Insets include border and padding; measurement widths alone
cannot derive them.

Set `ctx.font` first: Chromium and Firefox reset some font settings when
it changes. Box assembles `font.shorthand` because `getComputedStyle(element).font`
can be empty. Apply `stretch` and `variantCaps` separately; percentage stretch
is invalid in the shorthand.

```tsx title="canvas"
<Box
  onContextChange={(_, { current }) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const { font, devicePixelRatio: dpr } = current
    canvas.width = 300 * dpr
    canvas.height = 80 * dpr
    ctx.scale(dpr, dpr)

    ctx.font = font.shorthand
    ctx.fontStretch = font.stretch
    ctx.fontVariantCaps = font.variantCaps
    ctx.fontKerning = font.kerning
    ctx.textRendering = font.textRendering
    ctx.letterSpacing = font.letterSpacing
    ctx.wordSpacing = font.wordSpacing
    ctx.direction = font.direction
    ctx.fillStyle = font.color

    const x = current.inset.borderLeft + current.inset.paddingLeft
    const y = current.inset.borderTop + current.inset.paddingTop
    ctx.fillText('Matches the DOM', x, y + (font.lineHeight ?? font.size))
  }}
>
  <canvas ref={canvasRef} />
</Box>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `display?` | BoxDisplay | block | Layout model for the host. All other layout, sizing, mask, and shadow
properties stay ordinary `className` / `style` CSS on the Box itself. |
| `fade?` | boolean | — | Fades out every edge that currently hides clipped content, and drops the
fade from an edge once the reader scrolls to it. |
| `fadeSize?` | number \| string | 24 | Depth of the `fade` gradient. A `number` is pixels; a string is any CSS
length. |
| `gap?` | number \| string | — | Gap between children, matching the CSS `gap` property. A `number` is
pixels; a string is any CSS length or two-value gap (`'1rem'`,
`'8px 16px'`). Applies while the Box is a flex or grid container. |
| `observe?` | 'size' \| 'context' \| 'all' | — | What the Box watches, when a handler is not what turns it on. `'size'`
keeps the overflow CSS states (`:state(clipped-x)`, `:state(scrollable-y)`,
…) current — reach for it when your own CSS is the only reader. `'context'`
and `'all'` are there for symmetry; passing `onMeasureChange` or
`onContextChange` already turns the matching half on. |
| `onContextChange?` | (event, detail) => void | — | Fired after Box's browser and local rendering context changes. `detail`
contains the changed fields and a full current snapshot. |
| `onMeasureChange?` | (event, detail) => void | — | Fired after Box geometry or its content-overflow state changes. `detail`
contains the changed fields and a full current snapshot. |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
`number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit
for square corners. |

### BoxMeasurement

### BoxContext

### BoxFont

`context.font`, the resolved text style.

### BoxInset

`context.inset`, the distance from the border edge to the content edge.

## Web component

Use `<a-box>` without JSX. Events are non-bubbling `CustomEvent`s with the same
`detail`. Set `observe="size"`, `"context"`, or `"all"` explicitly; adding a
listener does not enable observation. A bare `observe` means `"all"`.

```html title="a-box"
<a-box display="grid" gap="8px" round="12px" observe="all" id="summary"
       style="overflow: auto; max-height: 16rem">
  <p>Summary content</p>
</a-box>

<script type="module">
  import '@antadesign/anta/elements/a-box'

  const box = document.querySelector('#summary')
  box.addEventListener('measurechange', ({ detail }) => {
    console.log(detail.changed, detail.current.scrollableY)
  })
  box.addEventListener('contextchange', ({ detail }) => {
    console.log(detail.changed, detail.current.mode)
  })
</script>
```

`box.measurement`, `box.context`, and `box.isTruncated` read values synchronously.

## Styling

Your `className` and `style` override `display`, `gap`, and `round` through the
`anta.components` CSS layer.

Without typed CSS `attr()` support, raw `gap`, `round`, and `fade-size` length
attributes need matching custom properties. The JSX wrapper sets these for you:

```html
<a-box gap round fade
       style="--box-gap: 8px; --box-round: 12px; --box-fade-size: 32px">Content</a-box>
```
