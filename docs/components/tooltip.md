# Tooltip

A small floating bubble that describes the element it's placed inside. Render
`<Tooltip>` as a child of the element it annotates — it doesn't affect that
element's layout, and its content can be anything.

It shows on hover (after a short `delay`) and on keyboard focus, and dismisses
on mouse leave, blur, Esc, or when the anchor scrolls away. On touch
devices — where there's no hover and a tap shouldn't surface it — it opens on
**press-and-hold** and lingers briefly after you lift, so it stays readable. By
default the bubble is **pinned** under the anchor; pass `follow` to make it
**track the cursor** (fading out as the cursor moves away), or `interactive` to
make it hoverable and clickable (for content like links).

When the anchor implements **`getAnchorRect(): DOMRect`**, the bubble positions
against that rect instead of the anchor's full box. Anta's `Input` reports its
field box, so a tooltip on an `<Input>` points at the field, not the surrounding
label or hint.

## Examples

```tsx
// Place <Tooltip> inside the element it describes; hover or focus the anchor.
// Pinned under the anchor by default — prefer the top side here (auto-flips
// down when there's no room).
<span style={{ cursor: 'help' }}>
  Status
  <Tooltip placement="top">Last checked 2 minutes ago</Tooltip>
</span>

// A near-instant tooltip on a keyboard-focusable button. Never use delay={0} — use ~50.
<Button priority="tertiary" underline="dashed" label="Focus me with the keyboard">
  <Tooltip delay={50}>Shows on focus, dismiss with Esc</Tooltip>
</Button>

// `follow` tracks the cursor and fades by distance as you move away.
<Button label="Follow the cursor">
  <Tooltip follow>Tracks the pointer, fades as you leave</Tooltip>
</Button>

// Rich content — render anything.
<Button icon="info">
  <Tooltip placement="top">
    <strong>Heads up</strong> — this action can't be undone
  </Tooltip>
</Button>

// Interactive: the bubble becomes hoverable + clickable, so its content
// (links, buttons) works. Always pinned — a bubble that follows the cursor
// can't be entered, so `interactive` ignores `follow`. Move from the anchor
// into the bubble to click; press Esc to dismiss.
<Button label="Interact">
  <Tooltip interactive placement="top">
    See the <a href="/guide">full guide</a> for details
  </Tooltip>
</Button>
```

The underlying `<a-tooltip>` works in plain HTML too, as a child of any element:

```html
<button>
  Publish
  <a-tooltip>Makes the draft public</a-tooltip>
</button>
```

### Adjacent and nested tooltips

Only one tooltip shows at a time. Moving between **adjacent** anchors hands off
cleanly — the outgoing bubble cross-fades out as the next fades in (no blink).
With `follow` tooltips (used below to show it), the outgoing bubble also keeps
trailing the cursor and fades by distance from its anchor (transparent by ~100px
away), so a near hop reads as a smooth cross-fade and a far one is already gone.
With **nested** anchors, the inner (descendant) tooltip wins while you're over
it, and the outer takes back over when you leave. Hover the examples to feel it.

```tsx
// Adjacent — moving from one to the next cross-fades, no blink. `follow` adds
// the cursor-trailing + distance fade so the hand-off is most visible.
<Button label="First"><Tooltip follow>First tooltip</Tooltip></Button>
<Button label="Second"><Tooltip follow>Second tooltip</Tooltip></Button>

// Nested — wrap stray text in a <span> so the tooltip stays a direct child of
// the box (its anchor). The inner tooltip wins while you're over the inner button.
<div tabIndex={0}>
  <span>Outer box</span>
  <Tooltip follow>Outer tooltip</Tooltip>
  <Button label="Inner button"><Tooltip follow>Inner tooltip</Tooltip></Button>
</div>
```

### Show only when truncated

Pass **`truncatedOnly`** and the tooltip appears only when its target's text is
actually ellipsized — a label that fits gets no tooltip. The check is a UI-thread
layout read, re-measured on each hover (so resizing the container flips it live). By
default it measures the nearest Anta ellipsizing label (`a-tab-label` /
`a-button-label`) inside the anchor, then the anchor itself; point it elsewhere with
**`truncatedSelector`**. Hover both — only the clipped one reveals its full text:

```tsx
{/* Only the clipped span shows a tooltip. The anchor IS the clipping box here,
    so no selector is needed; inside a tab or <Button> the default finds the label. */}
<span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
  A long label that gets truncated
  <Tooltip truncatedOnly>A long label that gets truncated</Tooltip>
</span>
```

### Empty tooltips

A tooltip with nothing to show — no element children and no non-whitespace text —
doesn't open, so `<Tooltip>{maybeEmpty}</Tooltip>` never flashes a blank bubble. This
is automatic (no prop) and re-checked on each hover, so a tooltip whose content
arrives later works normally; a bubble whose content is cleared while it's open
closes itself. Content that's a single icon or image (an element, no text) still
shows.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | Tooltip content. Renders anything — text, markup, an icon + text.
 Lives in the light DOM, so it's styleable with your own plain CSS. |
| `delay?` | number | 300 | Show delay in milliseconds after hover / focus. Never use `0` — use
 ~`50` for a near-instant tooltip (0 has caused issues in practice). |
| `follow?` | boolean | — | Follow the cursor instead of pinning under the anchor. The bubble is
 pinned (anchored beneath the target) by default; pass `follow` for the
 cursor-tracking behavior, which fades by distance as the cursor leaves. |
| `interactive?` | boolean | — | Make the bubble hoverable and clickable — enables pointer events and
 keeps it open while the cursor is over it, so its content (links,
 buttons) can be interacted with. Always pinned (an interactive bubble
 can't follow the cursor, even with `follow`). |
| `placement?` | 'top' \| 'bottom' | bottom | Which side of the anchor the bubble prefers. Auto-flips to the other
 side when there isn't room. |
| `round?` | boolean \| number \| string | — | Round the bubble to a 20px radius (matching a round menu). Pass a `number`
 (px) or a CSS length string for a custom radius. |
| `truncatedOnly?` | boolean | — | Only show when the target is actually truncated (its text overflows and is
 ellipsized); a label that fits gets no tooltip. The check is a UI-thread
 layout read, re-measured on each show. By default it measures every Anta
 ellipsizing label part inside the anchor, then the anchor itself —
 override with `truncatedSelector`. |
| `truncatedSelector?` | string | — | CSS selector (resolved within the anchor) for the element or elements
 whose overflow decides whether a `truncatedOnly` tooltip shows. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Place `<a-tooltip>` inside the element it describes.

```html
<a-button role="button" tabindex="0" priority="secondary">
  <a-button-label>Publish</a-button-label>
  <a-tooltip>Make the draft public</a-tooltip>
</a-button>
```

The bubble lives in shadow DOM and is exposed as a single **part** — style the box
(background, frost, shadow, radius, padding, a border) with `::part(bubble)`. Its
*content* is slotted light DOM with a **normalized text baseline** (Anta body
typography), so it ignores the anchor's styling; to restyle the text, put a class on
the content you pass to `<Tooltip>` and target that (a rule on the content wins over
the baseline). Both together — hover the button to see it; the classes are just for
the demo:

```css
/* the bubble box — a shadow part */
a-tooltip.fancy::part(bubble) {
  background: #1a161d;
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  backdrop-filter: none;            /* opt out of the frost */
}
/* the slotted content — a class on what you pass to <Tooltip> */
.tip-rich { color: #fff; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; }
```
