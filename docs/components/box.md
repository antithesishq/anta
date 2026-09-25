# Box

`Box` is a DOM container with layout props, overflow states, and browser context
events. For custom wheel, pointer, and touch handling, use [Capture](./capture.md).

## Display

Use `display`, `gap`, `padding`, `margin`, and `round` for layout and corners. Numeric lengths use
pixels; strings accept CSS lengths. `padding` and `margin` also accept CSS
shorthand, such as `padding="8px 16px"` or `margin="0 auto"`. Omission adds no
spacing styles. A bare `round` fully rounds the corners.

Box uses `position: relative` by default. Absolutely positioned descendants
use it as their containing block. Set `position: static` on the Box if they
should use another positioned ancestor.

```tsx
<Box round={8} padding={10}><span /></Box>
<Box display="flex" round={8} gap={6} padding={10}><span /></Box>
<Box display="grid" round={8} gap="0.5rem" padding="8px 16px" style={{ gridTemplateColumns: '1fr 1fr' }}><span /></Box>
```

## Overflow

Box reports overflow, clipping, and scrollability as measurements and CSS
states. Use `observe="overflow"` to keep overflow, clipping, and scrollability
states current as content changes. `observe="edges"` also tracks which
edges hide content while scrolling. `fade` enables both automatically.

`.edge` is a demo class name. Use your own selector.

```tsx
<Box observe="overflow" round={8} className="edge" style={{ width: 150 }}>Content that fits.</Box>

<Box observe="overflow" round={8} className="edge" style={{ width: 150, overflow: 'hidden', whiteSpace: 'nowrap' }}>
  A label too long for this box.
</Box>

<Box observe="overflow" round={8} className="edge" style={{ width: 150, height: 56, overflowY: 'auto' }}>
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
const TAGS = ['frontend', 'design-system', 'a11y', 'performance']

<Box fade fadeSize={32} round display="flex" gap={6} className="fade-demo" style={{ width: 190, overflowX: 'auto' }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
</Box>

<Box fade fadeSize={32} round={8} className="fade-demo" style={{ width: 190, height: 56, overflowY: 'auto' }}>
  One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten. Eleven. Twelve.
</Box>
```

```css
.fade-demo { flex-wrap: nowrap; padding: 10px; border: 1px solid var(--border-4); }
.fade-demo a-tag { flex: 0 0 auto; }
```

The mask clips to the padding box. It preserves the Box border, shadows, and
focus ring when no edge is hidden.

To style hidden edges without `fade`, use `observe="edges"` and the
`hidden-start-x`, `hidden-end-x`, `hidden-start-y`, or `hidden-end-y` CSS states.

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

By default, `onMeasureChange` reports one frame after observation starts, then when
the border-box `width` or `height` changes. `changed` contains fields
changed since the last event; `current` is the full snapshot. Reporting pauses
off screen and resumes with a fresh snapshot when Box returns.

`observe` accepts one of the eight selections below, or a typed array combining
them. `observe={['size', 'edges']}` and `observe={['edges', 'size']}` select the
same triggers. Repeated selections have no effect. Changing the selected
measurement fields requests a fresh snapshot. TypeScript checks each value;
use an array to combine selections in JSX.

The selections below progress from resize and context signals to continuous
scroll tracking. Intensity describes typical observation work and event frequency,
not a fixed performance rating. Content churn and the work in your handler also
affect the cost.

| Selection | Event triggers | Frontend work and intensity |
| --- | --- | --- |
| `width` | Border-box `width`. | Low during ordinary use: observes the host; no content or scroll observers. Can report each frame during resizing. |
| `height` | Border-box `height`. | Same work as `width`, with height as the event trigger. |
| `size` | Either border-box `width` or `height`. | Same observers as a single dimension; observes the element itself. |
| `context` | Theme, resolved font, insets, background, focus, and browser/device context through `onContextChange`. | Usually infrequent: shared theme/media listeners and local style/focus reads; no scroll listener. |
| `overflow` | `clientWidth`, `clientHeight`, `scrollWidth`, `scrollHeight`, `overflowX/Y`, `clippedX/Y`, and `scrollableX/Y`. | Content-dependent: adds content mutations and child resizes; no scroll listener. Does not report individual child dimensions. |
| `edges` | `hiddenStartX`, `hiddenEndX`, `hiddenStartY`, and `hiddenEndY`. | Measures content/layout changes and scrolling, at most once per frame. Emits only when an edge flag changes, so moving through the middle stays silent. |
| `scroll` | `scrollLeft` or `scrollTop`. | High during scrolling: measures content/layout and scroll changes and can emit every frame. |
| `all` | Every measurement field and rendering context. | Enables all observers and can emit every frame. |

Selections are independent. `scroll` selects offset triggers; it does not include
`size`, `overflow`, `edges`, or `context`. Every measurement event still
contains fresh values for every measurement field, including client/content
dimensions and hidden edges. Combine triggers when you also need events caused
by those other changes. With `observe="size"`, content-only changes cause no
event; the next size event includes the current content measurements.

For a scroll-edge indicator, use `edges`: it reads during scrolling but
avoids a callback for each offset change. `scroll` and `all` can cause the most
frequent application updates, especially when the handler sets state or sends
each snapshot to a worker. Prefer `fade` when CSS alone needs the edge state.

When no measurement is selected, `onMeasureChange` adds `size`;
`onContextChange` adds `context`.
Passing both handlers observes size and context without enabling scroll events.
Without handlers or `fade`, omitting `observe` keeps Box idle.

Set `throttle` to a minimum interval in milliseconds. The first report has no
added delay; subsequent reports include a trailing update with the latest values.
Omit it or pass `0` for frame-based reporting. Negative or non-finite values use
`0`. The interval applies to `onMeasureChange`; context events are not throttled.
Throttling limits event delivery; it does not reduce observer reads.
`edges`, `scroll`, and `fade` continue measuring during scrolling so their
CSS states remain current.

`Tooltip truncatedOnly` reads Box's clipping on demand. It works without
`observe` or `onMeasureChange` and does not enable continuous observation.

Pass `includeRectsFor` to add matching descendants to each measurement snapshot.
`current.rects` contains their border boxes in document order, with `top`,
`left`, `right`, and `bottom` measured from the Box's top-left border edge, plus
each match's `width` and `height`.

The selector does not start observation or add event triggers. Box reads the
rects when an existing `observe` selection reports a change. `current.rects`
always contains the latest array; `changed.rects` appears only when that array
differs from the previous report. For a fresh read at any time, use
`box.measurement.rects`.

```tsx
<Box includeRectsFor=".marker" onMeasureChange={(_, { current }) => {
  console.log(current.rects)
}}>
  <span className="marker">Measured content</span>
</Box>
```

This readout observes `['size', 'overflow', 'edges', 'scroll']` with `throttle={100}`.
It includes the first content row in `rects`. Resize or scroll the Box to update
the values.

```tsx title="measurechange"
const [measurement, setMeasurement] = useState<BoxMeasurement | null>(null)

<Box
  round={8}
  className="measure-probe-box"
  observe={['size', 'overflow', 'edges', 'scroll']}
  includeRectsFor=".measure-probe-target"
  throttle={100}
  onMeasureChange={(_, { current }) => setMeasurement(current)}
>
  <Text size="small" priority="tertiary">Resize or scroll this Box.</Text>
  <div className="measure-probe-wide measure-probe-target">wide content, so both axes overflow</div>
  <div className="measure-probe-wide">and a second line, so the vertical axis does too</div>
  <div className="measure-probe-wide">and a third</div>
</Box>

<div className="measure-probe-readout">
  {Object.entries(measurement ?? {}).map(([field, value]) => field === 'rects' && Array.isArray(value)
    ? <div key={field} className="measure-probe-rects">
        <Tag size="small" label="rects" value={`${value.length} match${value.length === 1 ? '' : 'es'}`} />
        <pre><code>{JSON.stringify(value, null, 2)}</code></pre>
      </div>
    : <Tag key={field} size="small" label={field} value={String(value)} />
  )}
</div>
```

```css
.measure-probe-box {
  resize: both;
  overflow: auto;
  inline-size: 320px;
  block-size: 132px;
  min-inline-size: 120px;
  min-block-size: 64px;
  padding: 10px;
  border: 1px solid var(--border-4);
}
.measure-probe-wide { inline-size: 520px; padding-block: 6px; }
.measure-probe-readout { display: flex; flex-wrap: wrap; gap: 6px; }
.measure-probe-rects { flex-basis: 100%; min-width: 0; }
.measure-probe-rects pre { margin: 4px 0 0; padding: 8px; border: 1px solid var(--border-4); border-radius: 4px; background: var(--bg-2); white-space: pre-wrap; overflow-wrap: anywhere; }
```

See the [measurement fields](#boxmeasurement). Overflow fields map to kebab-case
CSS states, such as `clippedX` → `:state(clipped-x)`.

## Context

`onContextChange` reports theme, focus, and browser context as
`{ changed, current }`. See the [context fields](#boxcontext). For CSS, use
`:focus-within`, mode classes, and media queries instead.

Switch themes, resize, or zoom to update the preview. The `.light` Box keeps its
local `mode`; `globalMode` follows the document. Browser and OS versions may be
frozen, so use `pointer`, `hover`, or feature tests to choose behavior.

```tsx title="contextchange"
import { useState } from 'react'
import { Box, Tag, Text, type BoxContext } from '@antadesign/anta'

function ScopedContext() {
  const [context, setContext] = useState<BoxContext | null>(null)

  return (
    <div className="light">
      <Box display="flex" round={8} gap={6} className="context-probe-box"
           onContextChange={(_, { current }) => setContext(current)}>
        <Text size="small" priority="tertiary">inside a .light scope</Text>
        <Tag size="small" tone="brand" label="mode" value={context?.mode ?? '…'} />
        <Tag size="small" label="globalMode" value={context?.globalMode ?? '…'} />
      </Box>
    </div>
  )
}
```

```css
.context-probe-box {
  flex-wrap: wrap;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--border-4);
  background: var(--bg-1);
  color: var(--text-1);
}
```

<a id="canvas"></a>

### Canvas-related styles

Use `context.font` and `devicePixelRatio` to match canvas text to the DOM.
The first line is DOM text; the second is drawn on canvas. Switch themes or
zoom to update both. `context.inset` also reports border and padding when you
need to align drawing coordinates with the Box's content edge.

Set `ctx.font` before spacing and direction. Box assembles `font.shorthand`
because `getComputedStyle(element).font` can be empty. Stretch and variant caps
remain separate fields; percentage stretch is invalid in the shorthand.

```tsx title="canvas"
const canvasRef = useRef<HTMLCanvasElement>(null)

<Box className="canvas-probe"
  onContextChange={(_, { current }) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { font, devicePixelRatio: dpr } = current
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    ctx.scale(dpr, dpr)

    ctx.font = font.shorthand
    ctx.letterSpacing = font.letterSpacing
    ctx.wordSpacing = font.wordSpacing
    ctx.direction = font.direction === 'rtl' ? 'rtl' : 'ltr'
    ctx.fillStyle = font.color

    ctx.fillText('Matches the DOM', 0, font.lineHeight ?? font.size)
  }}
>
  <span>Matches the DOM</span>
  <canvas ref={canvasRef} aria-label="Canvas text using the Box font and color" />
</Box>
```

```css
.canvas-probe { width: 100%; font-size: 20px; line-height: 32px; color: var(--text-1); }
.canvas-probe canvas { display: block; width: 100%; height: 48px; }
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `display?` | 'block' \| 'inline-block' \| 'flex' \| 'inline-flex' \| 'grid' \| 'inline-grid' | block | Layout model for the host. Sizing, alignment, mask, and shadow properties stay ordinary `className` / `style` CSS on the Box itself. |
| `fade?` | boolean | — | Fades out every edge that currently hides clipped content, and drops the fade from an edge once the reader scrolls to it. |
| `fadeSize?` | number \| string | 24 | Depth of the `fade` gradient. A `number` is pixels; a string is any CSS length. |
| `gap?` | number \| string | — | Gap between children, matching the CSS `gap` property. A `number` is pixels; a string is any CSS length or two-value gap (`'1rem'`, `'8px 16px'`). Applies while the Box is a flex or grid container. |
| `includeRectsFor?` | string | — | CSS selector for descendants whose border boxes are included in `measurement.rects` when Box measures. Coordinates are relative to this Box's top-left border edge; matches are in document order. |
| `margin?` | number \| string | — | Outer spacing, matching CSS `margin`. Numbers are pixels; strings accept CSS shorthand, `auto`, negative lengths, and custom properties. Omission adds no style. |
| `observe?` | 'width' \| 'height' \| 'size' \| 'context' \| 'overflow' \| 'edges' \| 'scroll' \| 'all' \| readonly BoxObservation[] | — | One selection or an array of selections, in any order. `'size'` watches width and height; `'context'` watches rendering context; `'overflow'` watches content dimensions and clipping. `'edges'` reports which edges hide content; `'scroll'` reports offsets, potentially every frame; `'all'` selects everything. Selections are independent: use `['size', 'edges']` to combine them. A measurement handler implies `'size'` when no measurement is selected; a context handler adds `'context'`. Size skips content and scroll observers; overflow adds content observation; hidden edges and scroll add scroll reads. Without handlers or `fade`, omission stays idle. |
| `onContextChange?` | (event, detail) => void | — | Fired after Box's browser and local rendering context changes. `detail` contains the changed fields and a full current snapshot. |
| `onMeasureChange?` | (event, detail) => void | — | Fired when a selected measurement field changes. `detail.changed` contains fields changed since the previous event; `detail.current` includes the full snapshot with matching rects. Rect changes alone do not trigger an event. |
| `padding?` | number \| string | — | Inner spacing, matching CSS `padding`. Numbers are pixels; strings accept CSS shorthand, percentages, and custom properties. Omission adds no style. |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a `number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit for square corners. |
| `throttle?` | number | 0 | Minimum interval between measurement events, in milliseconds. The first report has no added delay; a trailing report delivers the latest values. Active observers and CSS clipping states are not throttled. |

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
| `rects` | BoxRect[] | — | Matches for `includeRectsFor`, in document order. Empty when omitted. |
| `scrollableX` | boolean | — | The exceeded content can be scrolled by the reader on this axis. |
| `scrollableY` | boolean | — |  |
| `scrollHeight` | number | — |  |
| `scrollLeft` | number | — | Current scroll offset, matching `scrollLeft` / `scrollTop`. |
| `scrollTop` | number | — |  |
| `scrollWidth` | number | — | Full scrollable-content dimensions, matching `scrollWidth` / `scrollHeight`. |
| `width` | number | — | Border-box width and height in CSS pixels. |

### BoxRect

Coordinates and dimensions of a matched descendant's border box.

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `bottom` | number | — |  |
| `height` | number | — |  |
| `left` | number | — |  |
| `right` | number | — |  |
| `top` | number | — |  |
| `width` | number | — |  |

### BoxContext

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundColor` | string | — | Resolved `background-color`. Needed when the box's content is drawn somewhere else — an offscreen canvas, a worker, an export — where the box's own background is not behind it. |
| `browser` | 'chrome' \| 'edge' \| 'firefox' \| 'opera' \| 'safari' \| 'unknown' | — | Browser family. |
| `browserVersion` | number | — | Browser major version, or `0` when unknown. Minor and patch digits are frozen by every engine, so only the major number is reported. |
| `devicePixelRatio` | number | — | `window.devicePixelRatio`: CSS pixels per device pixel. `1` on a standard display, `2` on most Retina screens, and a fraction under OS or browser zoom. Live — it re-reports on zoom and when the window moves to a monitor with a different density. |
| `focusWithin` | boolean | — | Whether focus is on the box or any of its descendants, read from the native `:focus-within`. For CSS, use that pseudo-class directly; this field is for logic that cannot query the DOM. |
| `font` | BoxFont | — | Resolved text style, ready to hand to a canvas 2D context. |
| `globalMode` | 'light' \| 'dark' | — | Mode on `<html>`, independent of an enclosing local scope. |
| `hover` | boolean | — | Whether ordinary hover interaction is available. |
| `inset` | BoxInset | — | Padding and border widths, for placing content inside the border box. |
| `mobile` | boolean | — | Whether the browser reports a mobile device. |
| `mode` | 'light' \| 'dark' | — | Closest scoped Anta mode. A local `.light` can override a dark document. |
| `os` | 'android' \| 'ios' \| 'linux' \| 'macos' \| 'windows' \| 'unknown' | — | Operating-system family. |
| `osVersion` | number | — | Operating-system major version, or `0` when the browser withholds it. Browsers freeze this: every engine reports macOS as `10.15.7` and Windows 11 as `10.0`, so only Android and iOS carry a real number. Treat it as a hint, never as a gate. |
| `pointer` | 'fine' \| 'coarse' \| 'none' | — | Most precise available primary pointer. |
| `reducedMotion` | boolean | — | Whether the reader asks for reduced motion. |
| `systemAppearance` | 'light' \| 'dark' | — | Browser / operating-system color preference, independent of Anta classes. |

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
`detail`. Set `observe` explicitly; adding a listener does not enable
observation. Combine the eight selections with spaces, such as
`observe="size edges"` or `observe="size scroll"`, in any order. Repeated tokens
have no effect; unknown tokens are ignored. A bare `observe` means `"all"`.
`throttle="100"` limits measurement events to a 100 ms interval.

```html title="a-box"
<a-box display="grid" gap="8px" round="12px" observe="all"
       style="--box-gap: 8px; --box-round: 12px; padding: 12px; border: 1px solid var(--border-4)">
  <span>Summary content</span>
  <span>Observation enabled</span>
</a-box>
```

Import `@antadesign/anta/elements/a-box` to register the element. Listen for
`measurechange` and `contextchange` with `addEventListener`. Set
`include-rects-for=".marker"` to add matching descendant rects to each
measurement without changing the observation triggers.
`box.measurement`, `box.context`, and `box.isTruncated` read values synchronously.

## Styling

Your `className` and `style` override `display`, `gap`, `padding`, `margin`, and
`round` through the
`anta.components` CSS layer.

Without typed CSS `attr()` support, raw `gap`, `padding`, `margin`, `round`,
and `fade-size` attributes need matching custom properties. The JSX wrapper
sets these for you. Raw HTML lengths need units, such as `padding="16px"`:

```html
<a-box display="flex" gap padding margin round fade class="raw-box"
       style="--box-gap: 8px; --box-padding: 12px; --box-margin: 0 auto; --box-round: 12px; --box-fade-size: 32px">
  <span>Layout</span><span>Context</span><span>Measurements</span>
</a-box>
```

```css
.raw-box { width: 190px; overflow: auto; border: 1px solid var(--border-4); }
.raw-box span { flex: 0 0 auto; }
```
