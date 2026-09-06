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
| `display?` | BoxDisplay | block | Layout model for the host. All other layout, sizing, mask, and shadow properties stay ordinary `className` / `style` CSS on the Box itself. |
| `fade?` | boolean | — | Fades out every edge that currently hides clipped content, and drops the fade from an edge once the reader scrolls to it. |
| `fadeSize?` | number \| string | 24 | Depth of the `fade` gradient. A `number` is pixels; a string is any CSS length. |
| `gap?` | number \| string | — | Gap between children, matching the CSS `gap` property. A `number` is pixels; a string is any CSS length or two-value gap (`'1rem'`, `'8px 16px'`). Applies while the Box is a flex or grid container. |
| `observe?` | 'size' \| 'context' \| 'all' | — | What the Box watches, when a handler is not what turns it on. `'size'` keeps the overflow CSS states (`:state(clipped-x)`, `:state(scrollable-y)`, …) current — reach for it when your own CSS is the only reader. `'context'` and `'all'` are there for symmetry; passing `onMeasureChange` or `onContextChange` already turns the matching half on. |
| `onContextChange?` | (event, detail) => void | — | Fired after Box's browser and local rendering context changes. `detail` contains the changed fields and a full current snapshot. |
| `onMeasureChange?` | (event, detail) => void | — | Fired after Box geometry or its content-overflow state changes. `detail` contains the changed fields and a full current snapshot. |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a `number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit for square corners. |

### BoxMeasurement

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `clientHeight` | number | — |  |
| `clientWidth` | number | — | Padding-box dimensions, matching the browser's `clientWidth` / `clientHeight`. |
| `clippedX` | boolean | — | The exceeded content is visually clipped on this axis. |
| `clippedY` | boolean | — |  |
| `height` | number | — |  |
| `hiddenEndX` | boolean | — |  |
| `hiddenEndY` | boolean | — |  |
| `hiddenStartX` | boolean | — | Clipped content sits past this specific edge, in logical writing-mode terms. A clipped box that has not been scrolled hides content past its end edge only; scroll it to the end and the hidden content moves to the start. These drive the `fade` mask. |
| `hiddenStartY` | boolean | — |  |
| `overflowX` | boolean | — | Content exceeds the padding box on this axis, regardless of CSS overflow. |
| `overflowY` | boolean | — |  |
| `scrollableX` | boolean | — | The exceeded content can be scrolled by the reader on this axis. |
| `scrollableY` | boolean | — |  |
| `scrollHeight` | number | — |  |
| `scrollLeft` | number | — | Current scroll offset, matching `scrollLeft` / `scrollTop`. |
| `scrollTop` | number | — |  |
| `scrollWidth` | number | — | Full scrollable-content dimensions, matching `scrollWidth` / `scrollHeight`. |
| `width` | number | — | Border-box width and height in CSS pixels. |

### BoxContext

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundColor` | string | — | Resolved `background-color`. Needed when the box's content is drawn somewhere else — an offscreen canvas, a worker, an export — where the box's own background is not behind it. |
| `browser` | BoxBrowser | — | Browser family. |
| `browserVersion` | number | — | Browser major version, or `0` when unknown. Minor and patch digits are frozen by every engine, so only the major number is reported. |
| `devicePixelRatio` | number | — | `window.devicePixelRatio`: CSS pixels per device pixel. `1` on a standard display, `2` on most Retina screens, and a fraction under OS or browser zoom. Live — it re-reports on zoom and when the window moves to a monitor with a different density. |
| `focusWithin` | boolean | — | Whether focus is on the box or any of its descendants, read from the native `:focus-within`. For CSS, use that pseudo-class directly; this field is for logic that cannot query the DOM. |
| `font` | BoxFont | — | Resolved text style, ready to hand to a canvas 2D context. |
| `globalMode` | BoxMode | — | Mode on `<html>`, independent of an enclosing local scope. |
| `hover` | boolean | — | Whether ordinary hover interaction is available. |
| `inset` | BoxInset | — | Padding and border widths, for placing content inside the border box. |
| `mobile` | boolean | — | Whether the browser reports a mobile device. |
| `mode` | BoxMode | — | Closest scoped Anta mode. A local `.light` can override a dark document. |
| `os` | BoxOS | — | Operating-system family. |
| `osVersion` | number | — | Operating-system major version, or `0` when the browser withholds it. Browsers freeze this: every engine reports macOS as `10.15.7` and Windows 11 as `10.0`, so only Android and iOS carry a real number. Treat it as a hint, never as a gate. |
| `pointer` | BoxPointer | — | Most precise available primary pointer. |
| `reducedMotion` | boolean | — | Whether the reader asks for reduced motion. |
| `systemAppearance` | BoxMode | — | Browser / operating-system color preference, independent of Anta classes. |

### BoxFont

`context.font`, the resolved text style.

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `color` | string | — | Resolved text color. Canvas: `ctx.fillStyle`. |
| `direction` | string | — | Canvas: `ctx.direction`. |
| `family` | string | — | Resolved family list, quoted as the engine reports it. |
| `featureSettings` | string | — | Canvas 2D consumes neither of these. They are here for text you measure or draw some other way. |
| `kerning` | string | — | Canvas: `ctx.fontKerning`. |
| `letterSpacing` | string | — | A length, never `normal` - `normal` is reported as `0px`, which is what `ctx.letterSpacing` accepts. |
| `lineHeight` | number \| null | — | Line height in CSS pixels, or `null` when it computes to `normal`. Canvas ignores line height in `ctx.font`; this is for laying text out yourself. |
| `shorthand` | string | — | CSS `font` shorthand, assembled here because every engine returns an empty string for the computed shorthand. `stretch` and `variantCaps` are left out of it deliberately: a percentage `font-stretch` makes every engine reject the whole string and fall back to `10px sans-serif`. Apply those through `ctx.fontStretch` / `ctx.fontVariantCaps` after setting `ctx.font`. |
| `size` | number | — | Font size in CSS pixels. |
| `stretch` | string | — | Computed `font-stretch`, a percentage such as `88%`. Canvas: `ctx.fontStretch`. |
| `style` | string | — | `normal`, `italic`, or an `oblique <angle>`. |
| `textRendering` | string | — | Canvas: `ctx.textRendering`, which WebKit does not implement. |
| `variantCaps` | string | — | Canvas: `ctx.fontVariantCaps`. |
| `variationSettings` | string | — |  |
| `weight` | number | — | Numeric weight, 1-1000. |
| `wordSpacing` | string | — | Same normalization as `letterSpacing`. Canvas: `ctx.wordSpacing`. |

### BoxInset

`context.inset`, the distance from the border edge to the content edge.

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `borderBottom` | number | — |  |
| `borderLeft` | number | — |  |
| `borderRight` | number | — |  |
| `borderTop` | number | — |  |
| `paddingBottom` | number | — |  |
| `paddingLeft` | number | — |  |
| `paddingRight` | number | — |  |
| `paddingTop` | number | — |  |

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
