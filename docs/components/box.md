# Box

`Box` is a DOM container that adds layout props, overflow states, and browser
context events.

## Display

`display` and `gap` set the matching CSS properties. A numeric `gap` uses
pixels. A string accepts any CSS length.

```tsx
<Box round={8}><span /></Box>
<Box display="flex" round={8} gap={6}><span /></Box>
<Box display="grid" round={8} gap="0.5rem" style={{ gridTemplateColumns: '1fr 1fr' }}><span /></Box>
```

`round` accepts the same values. Pass `round` for fully rounded corners. Omit
it for square corners.

`display`, `gap`, and `round` use the `anta.components` layer. Your
`className` and `style` override them.

## Overflow

Box reports when content exceeds its bounds (`overflowX` and `overflowY`), when
CSS clips it (`clippedX` and `clippedY`), and when it can scroll (`scrollableX`
and `scrollableY`). It exposes each measurement as a CSS state, so CSS can react
without JSX state or a measurement ref.

A Box measures for `fade`, `onMeasureChange`, or `observe="size"`. Use
`observe="size"` when CSS reads its states. A Box with none of these attaches no
observers. Measurement pauses off screen, except `fade`, which measures on
connection so it can paint its mask.

`observe` accepts `"size"`, `"context"`, or `"all"`. A bare `observe` means
`"all"`. The JSX `Box` derives the needed value from its handlers. When you use
`a-box` directly, set it yourself; `addEventListener` does not start reporting:

```html
<a-box observe="size">Content</a-box>
<a-box observe="all">Content</a-box>
```

The attribute works with listeners added before upgrade, removed with `once` or
`AbortSignal`, and replaced during React renders.

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

`fade` masks each edge that hides content. Scrolling moves the mask to the edge
that still hides content and removes it at the end. `fadeSize` sets its depth.

```tsx
<Box fade fadeSize={32} round display="flex" gap={6} style={{ overflowX: 'auto' }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
</Box>
```

The mask clips to the padding box. It preserves the Box border, shadows, and
focus ring when no edge is hidden.

The four edge states are `hidden-start-x`, `hidden-end-x`, `hidden-start-y`, and
`hidden-end-y`. Use `hiddenStartX` and its siblings in JSX. To style the states
without `fade`, add `observe="size"`.

```css
/* <Box observe="size" className="my-box"> */
.my-box:state(hidden-end-x) {
  mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
}
```

### Tooltip on clipped content

`Tooltip truncatedOnly` uses Box's `isTruncated` getter. It shows when the Box
clips on either axis, including wrapped children.

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

`measurechange` fires one frame after observation starts and after the Box or its
content changes. `changed` contains the moved fields, and `current` is the full
snapshot. The event pauses off screen and reports again when the Box returns.

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

The preview updates as you resize or scroll the Box. Tags mark `true` values.

[`BoxMeasurement`](#boxmeasurement) lists every field. Box maps each overflow
field to a kebab-case CSS state, such as `overflow-x`, `clipped-y`,
`scrollable-x`, and `hidden-end-y`. These states are not host attributes. They
remain current only while `fade`, `observe="size"`, or `onMeasureChange` enables
measurement.

## Context

`contextchange` uses the same `{ changed, current }` shape. Boxes share one
context observer per window, which stops when the last context reader
disconnects.

[`BoxContext`](#boxcontext) lists every field. `contextchange` sets no CSS
states. Use `:focus-within`, mode classes, and media queries when CSS is the
reader.

Every value in the following preview is live. Switch the site theme, resize the
window, zoom the page, or use a touch device. Treat `osVersion` and
`browserVersion` as hints because browsers freeze parts of these values. Use
`pointer`, `hover`, or a feature test to gate behavior. The second Box is in a
`.light` scope, so its `mode` remains `light` on a dark page while `globalMode`
follows the document.

`context.font` is the Box's resolved text style, `context.inset` measures from
the border edge to the content edge, and `devicePixelRatio` provides the canvas
scale. Use them to align canvas text with the DOM.

`measurement` cannot derive the inset: `width` is the border box, and
`clientWidth` is the padding box.

Set `ctx.font` from `font.shorthand` first. Chromium and Firefox reset
`fontStretch`, `fontVariantCaps`, `fontKerning`, and `textRendering` when
`ctx.font` changes. `stretch` and `variantCaps` stay out of the shorthand because
a percentage `font-stretch` invalidates it.

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

`getComputedStyle(element).font` is empty in Chromium, Firefox, and WebKit, so
Box assembles the shorthand.

```tsx title="contextchange"
<Box onContextChange={(_, { changed, current }) => {
  if (changed.mode) updatePreviewTheme(current.mode)
  if (changed.focusWithin) announceFocus(current.focusWithin)
}}>
  <span>Preview content</span>
</Box>
```

### Props

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

The `measurechange` payload, as `changed` (only what moved) and `current` (the
whole snapshot).

### BoxContext

The `contextchange` payload, in the same two shapes.

### BoxFont

`context.font`, the resolved text style.

### BoxInset

`context.inset`, the distance from the border edge to the content edge.

Use `<a-box>` when you assemble DOM without a JSX wrapper. Both events are
ordinary, non-bubbling `CustomEvent`s carrying the same detail object.

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

`gap`, `round`, and `fade-size` read their length through typed `attr()`, which
today only Chrome supports. The matching custom properties in the host's inline
style work everywhere and take precedence, so that is what the JSX wrapper sets:

```html
<a-box gap round fade
       style="--box-gap: 8px; --box-round: 12px; --box-fade-size: 32px">Content</a-box>
```

`box.measurement`, `box.context`, and `box.isTruncated` read the same values
synchronously.
