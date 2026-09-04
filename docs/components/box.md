# Box

`Box` is a regular DOM container (like `<div>`) with helpful features and
callbacks.

## Display

For convenience, `display` and `gap` mirror the CSS properties of the same
names. `gap` takes a number of pixels or any CSS length string.

```tsx
<Box round={8}>…</Box>
<Box display="flex" round={8} gap={6}>…</Box>
<Box display="grid" round={8} gap="0.5rem" style={{ gridTemplateColumns: '1fr 1fr' }}>…</Box>
```

`round` takes the same value types. Pass it bare for fully-round corners, and
omit it for square ones.

`display`, `gap`, and `round` resolve to stylesheet rules in the
`anta.components` layer, so your own `className` or `style` outranks all three.
A layout prop never blocks your CSS.

## Overflow

Box reports three separate facts: content exceeds the box (`overflowX` /
`overflowY`), CSS hides the excess (`clippedX` / `clippedY`), and the reader can
scroll it (`scrollableX` / `scrollableY`). Each one is a CSS state on the box, so
a box styles itself with no JSX state and no measurement ref.

A Box measures only when something asks for the result: `fade`, an
`onMeasureChange` handler, or `observe="size"`. Reach for `observe="size"` when
your own CSS is the only reader, as it is here. A Box with none of the three runs no observers at
all, and measurement pauses while a Box sits off screen. `fade` is the one that
measures the moment it connects, because its mask is painted from those states;
`observe="size"` and a handler wait until the Box is known to be on screen.

The switch is an attribute, not the presence of a listener. `observe` takes
`"size"`, `"context"`, or `"all"`; a bare `observe` reads as `"all"`. `Box`
merges the prop with the halves your handlers imply, so this is invisible in
JSX. Writing `<a-box>` by hand, set it yourself — `addEventListener` alone
reports nothing:

```html
<a-box observe="size">…</a-box>
<a-box observe="all">…</a-box>
```

An attribute rather than a listener tally because a tally cannot see listeners
attached before the element upgrades (the client-side `import` pattern), cannot
see `once` or `AbortSignal` removals, and churns on every React 19 render, since
React removes and re-adds an `on*` prop whenever its identity changes.

`.edge` below is a demo class name; use your own selector.

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

`fade` masks every edge that currently hides content, and drops the mask from an
edge as soon as the reader scrolls to it. Scroll either box: the fade moves to
the edge that still has content behind it, then clears at the end. `fadeSize`
sets the gradient depth.

```tsx
<Box fade fadeSize={32} round display="flex" gap={6} style={{ overflowX: 'auto' }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
</Box>
```

The mask clips to the padding box, so a border on the Box stays crisp while its
content fades.

Four states drive the mask, one per edge: `hidden-start-x`, `hidden-end-x`,
`hidden-start-y`, and `hidden-end-y`. Read them in JSX as `hiddenStartX` and its
siblings, or style them yourself instead of using `fade`. Styling them by hand
means adding `observe="size"`, since `fade` is what would otherwise turn measurement on.

```css
/* <Box observe="size" className="my-box"> */
.my-box:state(hidden-end-x) {
  mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
}
```

### Tooltip on clipped content

`Tooltip truncatedOnly` reads Box's `isTruncated` getter, which is true while the
Box clips on either axis. It covers wrapped children as well as one clipped line:
the first box hides tags past its height, so the tooltip shows the whole set. The
second box fits and stays silent.

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

`measurechange` fires once a frame after the handler attaches, then after the box
or its content changes. `changed` holds only the fields that moved; `current` is
the complete snapshot. The event pauses while the Box is off screen and resumes
with a fresh reading when it scrolls back.

```tsx title="measurechange"
<Box
  style={{ maxWidth: 210, overflow: 'hidden', whiteSpace: 'nowrap' }}
  onMeasureChange={(event, { changed, current }) => {
    // changed → { clippedX: true, scrollWidth: 412 }
    if (changed.clippedX) setShowOverflowHint(current.clippedX)
  }}
>
  Long label…
</Box>
```

[`BoxMeasurement`](#boxmeasurement) lists every field. Each one has a matching
CSS state, named in kebab case: `overflow-x`, `clipped-y`, `scrollable-x`,
`hidden-end-y`, and so on. They are the only states Box sets, because overflow is
the one thing CSS has no way to ask about. None of them appear as host
attributes, and they stay current only while the Box measures: give it `fade`,
`observe="size"`, or an `onMeasureChange` handler.

`fade` masks an edge only while that edge hides something. A mask clips to the
border box, so an always-on one would swallow an outset `box-shadow` or a focus
ring on a Box that is hiding nothing.

## Context

`contextchange` uses the same `{ changed, current }` shape. One cache per window
serves every Box, so media queries and the user-agent read run once. The cache
attaches its listeners for the first Box with a handler and drops them with the
last, so a page that never reads context observes nothing.

[`BoxContext`](#boxcontext) lists every field. This event sets no CSS state,
because each field already has a native CSS equivalent: `:focus-within` for
focus, the `.dark` ancestor class for mode, and the `prefers-color-scheme`,
`pointer`, `hover`, `prefers-reduced-motion`, and `resolution` media queries for
the rest.

### Drawing to a canvas

`context.font` carries the Box's resolved text style, `context.inset` the
distance from its border edge to its content edge, and `devicePixelRatio` the
scale. One `contextchange` gives you everything a canvas needs to draw text that
matches the DOM around it.

The inset is the one thing `measurement` cannot give you: `width` is the border
box and `clientWidth` is the padding box, so neither the padding nor the border
thickness can be recovered from them.

Assign `shorthand` **first**. Chromium and Firefox reset `fontStretch`,
`fontVariantCaps`, `fontKerning` and `textRendering` when `ctx.font` is set, so
anything applied before it is lost. `stretch` and `variantCaps` stay out of the
shorthand on purpose: computed `font-stretch` is a percentage, and a percentage
in the shorthand makes every engine reject the whole string and fall back to
`10px sans-serif`.

```tsx title="canvas"
<Box
  onContextChange={(_, { current }) => {
    const ctx = canvas.getContext('2d')
    const { font, devicePixelRatio: dpr } = current

    canvas.width = 300 * dpr
    canvas.height = 80 * dpr
    ctx.scale(dpr, dpr)

    ctx.font = font.shorthand        // first: it resets the four below
    ctx.fontStretch = font.stretch
    ctx.fontVariantCaps = font.variantCaps
    ctx.letterSpacing = font.letterSpacing
    ctx.direction = font.direction
    ctx.fillStyle = font.color

    // Start where the DOM's own content starts.
    const x = current.inset.borderLeft + current.inset.paddingLeft
    const y = current.inset.borderTop + current.inset.paddingTop
    ctx.fillText('Matches the DOM', x, y + (font.lineHeight ?? font.size))
  }}
>
  <canvas ref={…} />
</Box>
```

`getComputedStyle(el).font` is an empty string in Chromium, Firefox and WebKit
alike, which is why Box assembles the shorthand itself.

Every value below is live. Switch the site theme, resize the window, zoom the
page, or open it on a touch device. `osVersion` and `browserVersion` are major
numbers, because every engine freezes the rest: macOS always reports `10.15.7`
and Windows 11 reports `10.0`, so only Android and iOS carry a real number. Read
them as hints, and gate behavior on `pointer`, `hover`, or a feature test. The second Box sits in a `.light` scope, so its `mode`
stays `light` on a dark page while `globalMode` follows the document.

```tsx title="contextchange"
<Box onContextChange={(event, { changed, current }) => {
  if (changed.mode) updatePreviewTheme(current.mode)
  if (changed.focusWithin) announceFocus(current.focusWithin)
}}>
  …
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
<a-box display="grid" gap="8px" round="12px" id="summary"
       style="overflow: auto; max-height: 16rem">
  <p>Content…</p>
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
       style="--box-gap: 8px; --box-round: 12px; --box-fade-size: 32px">…</a-box>
```

`box.measurement`, `box.context`, and `box.isTruncated` read the same values
synchronously.
