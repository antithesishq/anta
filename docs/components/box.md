# Box

`Box` is a DOM container with layout props, overflow states, browser context
events, and opt-in input capture.

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
CSS states, such as `clippedX` → `:state(clipped-x)`, not host attributes.

## Context

`onContextChange` reports theme, focus, and browser context as
`{ changed, current }`. See the [context fields](#boxcontext). For CSS, use
`:focus-within`, mode classes, and media queries instead.

Switch themes, resize, or zoom to update the preview. The `.light` Box keeps its
local `mode`; `globalMode` follows the document. Browser and OS versions may be
frozen, so use `pointer`, `hover`, or feature tests to choose behavior.

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

```tsx title="contextchange"
<Box onContextChange={(_, { changed, current }) => {
  if (changed.mode) updatePreviewTheme(current.mode)
  if (changed.focusWithin) announceFocus(current.focusWithin)
}}>
  <span>Preview content</span>
</Box>
```

## Capture wheel, pointer and touch

Use `wheelCapture`, `pointerCapture`, or `pan` to handle custom scrolling,
zooming, or dragging. Each is opt-in; handlers alone enable nothing. Plain Boxes
add no input state or listeners, and capture does not enable observation.

Box cancels accepted native input on the browser thread, then sends plain data
to your handler. Your component performs the action. To cross a worker boundary,
send `detail`, not the `CustomEvent`. Handler return values cannot change
cancellation.

### Wheel ownership

Set `wheelCapture` to `true` for all directions, or update allowed directions
from your component's bounds. Declined input reaches the enclosing editor or
scroll container. The dominant axis decides ownership; both deltas are delivered.

```tsx title="Custom table wheel"
<Box
  wheelCapture={{ up: offset > 0, down: offset < maxOffset }}
  wheelActivation="settled-or-focus"
  wheelSettle={{ delay: 200 }}
  tabIndex={0}
  onWheelInput={(_, detail) => handleTableWheel(detail)}
>
  {tableContent}
</Box>
```

The default `"settled"` activation waits for the pointer to rest inside Box
(150ms, 5px tolerance). It stays active until the pointer leaves.
`wheelSettle.resetOnMove` requires settling again after movement beyond tolerance.
Scrolling a Box under a stationary pointer does not activate it.

Use `"hover"` for immediate activation, `"focus"` for `:focus-within`, or
`"settled-or-focus"` for either condition. Wheel input must still target Box.
Box never takes focus automatically; provide `tabIndex` or a focusable child.

Modified input stays native by default, including Ctrl/pinch zoom. Use
`wheelModifier="ctrl"` to capture Ctrl-wheel, or `"any"` for all modifiers.
Named modifiers allow other keys too.

The innermost eligible Box handles wheel input on its host. Canceled and
non-cancelable events are ignored; Box cannot undo an ancestor's capture-phase
handler.

`detail.wheelEvent` preserves native event data, signs, and `deltaMode` units
(0: pixels, 1: lines, 2: pages). Box does not infer OS scrolling preferences.
`localX` and `localY` are CSS pixels from Box's viewport rectangle's top-left,
without undoing transforms. Native `offsetX` and `offsetY` refer to the original
target, which may be a child.

### Pointer sessions

`pointerCapture` tracks one primary mouse, pen, or touch pointer, including
movement outside Box. Use `threshold` to delay capture until dragging starts:

```tsx title="Mouse or pen selection"
<Box
  pointerCapture={{ pointerTypes: ['mouse', 'pen'], threshold: 3 }}
  onPointerInput={(_, detail) => updateSelection(detail)}
>
  {plotContent}
</Box>
```

`onPointerInput` reports `start`, `move`, `end`, and `cancel`. `deltaX/Y` are
incremental movement; `movementX/Y` are totals from the press, positive
right/down. Negate totals when adapting RemoteVirtualDOM MouseCapture's
start-minus-current convention.

Presses below threshold emit nothing. Captured gestures suppress the following
pointer-generated click. Cancellation reports `cancelReason` on pointer
cancellation, lost capture, disabling, removal, or window blur/hiding.
Lifecycle cancellation sets `pointerEvent: null`.

Pointer and pan capture skip nested controls, links, and editable content.
`pointerCapture.includeInteractive` includes them. Use `data-box-input-ignore`
to exclude a subtree from all capture, including wheel. It does not remove
ancestor `touch-action` restrictions.

### Touch panning and inertia

`pan` enables custom touch scrolling without inertia. Set `pointerTypes` to
include mouse dragging. It can share capture with `pointerCapture`:

```tsx title="Custom touch scrolling"
<Box
  pan={{
    axis: 'y',
    directions: { up: offset > 0, down: offset < maxOffset },
    inertia: true,
  }}
  onPanInput={(_, { deltaY }) => {
    setOffset(value => Math.max(0, Math.min(maxOffset, value + deltaY)))
  }}
>
  {tableContent}
</Box>
```

Pan deltas oppose finger movement. Apply deltas from every phase, including
`release`. Inertia samples have `pointerEvent: null`. Motion stops on new input,
disabled directions, or cancellation.

Box sets CSS `touch-action` before contact. Single-axis pan leaves the other
axis and pinch zoom to the browser. Both-axis pan or touch pointer capture owns
the whole gesture; mouse-only capture leaves touch unchanged. Unlike wheel,
an active touch gesture cannot return to native scrolling at a bound. Update
directions to stop custom motion and control the next gesture.

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
| `onPanInput?` | (event, detail) => void | — | Custom pan motion and its lifecycle. Inertial samples have no native pointer event. |
| `onPointerInput?` | (event, detail) => void | — | Start, movement, end, and cancellation of an opted-in pointer session. |
| `onWheelInput?` | (event, detail) => void | — | Accepted wheel input, with a serialized original event, Box-relative
geometry, focus state, and activation reason. Cancellation is already complete. |
| `pan?` | boolean \| BoxPan | — | Emit custom pan motion. `true` enables touch panning on both axes without
momentum. Options select devices, axes, bounds directions, and optional inertia.
Sets CSS touch-action through attributes before the gesture starts. |
| `pointerCapture?` | boolean \| BoxPointerCapture | — | Capture a primary pointer until release or cancellation. An options object
filters devices/buttons and configures activation. Nested interactive controls
are excluded unless explicitly included. A listener alone enables nothing. |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
`number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit
for square corners. |
| `wheelActivation?` | BoxWheelActivation | settled | Pointer or focus condition required before wheel input can be captured.
Focus applies only to input targeted within this Box. |
| `wheelCapture?` | BoxInputDirections | — | Capture wheel input in the enabled directions and emit `onWheelInput`.
`true` accepts all directions. Omit or pass `false` to leave wheel input alone.
All-false direction bounds preserve pointer settling while declining input.
A listener alone never enables capture. |
| `wheelModifier?` | BoxInputModifier | none | Required modifier for wheel capture. `none` preserves browser Ctrl/pinch zoom. |
| `wheelSettle?` | BoxWheelSettle | { delay: 150, tolerance: 5, resetOnMove: false } | Dwell delay, movement tolerance, and whether movement resets eligibility. |

### BoxMeasurement

### BoxContext

### BoxFont

`context.font`, the resolved text style.

### BoxInset

`context.inset`, the distance from the border edge to the content edge.

### BoxWheelSettle

### BoxPointerCapture

### BoxPan

### BoxPanInertia

### BoxWheelInput

### BoxPointerInput

### BoxPanInput

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
Configure capture with attributes and listen for lowercase event names. Bare
capture attributes match passing `true` in JSX. Remove an attribute to disable
capture.

```html title="Browser-thread input"
<a-box wheel-capture="up down" wheel-activation="settled-or-focus"
       wheel-delay="150" wheel-tolerance="5"
       pan="y" pan-directions="up down" pan-inertia id="table-surface">
  Custom table content
</a-box>
<script type="module">
  const surface = document.querySelector('#table-surface')
  surface.addEventListener('wheelinput', ({ detail }) => handleWheel(detail))
  surface.addEventListener('paninput', ({ detail }) => handlePan(detail))
</script>
```

## Styling

Your `className` and `style` override `display`, `gap`, and `round` through the
`anta.components` CSS layer.

Without typed CSS `attr()` support, raw `gap`, `round`, and `fade-size` length
attributes need matching custom properties. The JSX wrapper sets these for you:

```html
<a-box gap round fade
       style="--box-gap: 8px; --box-round: 12px; --box-fade-size: 32px">Content</a-box>
```
