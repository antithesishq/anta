# Tooltip

Use Tooltip for supplementary explanations and the full text of clipped labels.
Place it inside the element it describes. It takes no space in that element's
layout. Keep essential instructions and actions available without a tooltip.

## Examples

Hover Status for a text explanation, focus the underlined button with Tab,
follow the cursor, or enter the interactive bubble to use its link.

```tsx
<div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
  <span style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
    <span>Status</span>
    <Icon shape="info" size={16} style={{ color: 'var(--text-5)' }} />
    <Tooltip placement="top">Last checked 2 minutes ago</Tooltip>
  </span>
  <Button priority="tertiary" underline="dashed" label="Focus me with the keyboard">
    <Tooltip delay={50}>Shows on focus, dismiss with Esc</Tooltip>
  </Button>
  <Button label="Follow the cursor">
    <Tooltip follow>Tracks the pointer, fades as you leave</Tooltip>
  </Button>
  <Button label="Interact">
    <Tooltip interactive placement="top">
      See the <a href="/install/">full guide</a> for details
    </Tooltip>
  </Button>
</div>
```

## Hover and keyboard focus

Hover the button or reach it with Tab to show its explanation after a delay.
Escape dismisses it. Leaving the anchor, moving focus away, or scrolling outside the tooltip also
closes it. On touch screens, hold the anchor for 500ms; a quick tap does not open
it. After release, a touch tooltip remains for 1.5 seconds.

Give the trigger an accessible name independently. Put explanations that should
be available before opening on the trigger with authored ARIA. Here,
`aria-description` supplies the short description in both open and closed states.

```tsx
<Button label="Publish" aria-description="Makes the draft public">
  <Tooltip id="publish-tooltip" delay={50}>Makes the draft public</Tooltip>
</Button>
```

## Placement

Choose `top`, `left`, or `right` to prefer another side. Tooltip flips when
that side has insufficient room and keeps the bubble within the viewport.

```tsx
<Button label="Below"><Tooltip>Below the anchor</Tooltip></Button>
<Button label="Above"><Tooltip placement="top">Above the anchor</Tooltip></Button>
<Button label="Left"><Tooltip placement="left">Left of the anchor</Tooltip></Button>
<Button label="Right"><Tooltip placement="right">Right of the anchor</Tooltip></Button>
```

## Follow the cursor

Use `follow` for explanations attached to a larger pointer target. The bubble
tracks the cursor and fades with distance as the pointer leaves. Moving between
two `follow` anchors skips the next delay while the previous tooltip is open or
within its 300ms grace period. Pinned tooltips keep their configured delay.
Keyboard and touch openings stay anchored to the target.

```tsx
<Button label="First"><Tooltip follow>First explanation</Tooltip></Button>
<Button label="Second"><Tooltip follow>Second explanation</Tooltip></Button>
```

## Interactive content

Pass `interactive` to enter the bubble with the pointer or keyboard and use its
content. It stays pinned even when `follow` is present. Move from the trigger to
the link, or focus the trigger and press Tab. Escape dismisses the bubble.

This option preserves Tooltip's existing tooltip semantics. The ARIA tooltip
pattern describes nonfocusable content; use Menu or Dialog for essential actions
that need an explicit trigger and popup semantics.

```tsx
<Button label="Help" aria-description="Read the installation guide for setup details">
  <Tooltip id="help-tooltip" interactive placement="top">
    Read the <a href="/install/">installation guide</a>.
  </Tooltip>
</Button>
```

### Scrollable content

Interactive tooltips scroll when their content exceeds the bubble’s height.
Use `::part(bubble)` to limit its height, as in this example.

Hover **Scrollable help**, then scroll inside the bubble. It stays open without
scrolling the checklist. Scroll the checklist to dismiss it.

```tsx
<div className="tooltip-scroll-container">
  <div className="tooltip-scroll-body">
    <Button label="Scrollable help">
      <Tooltip interactive className="tooltip-scroll-example">
        <div>
          {Array.from({ length: 12 }, (_, index) => (
            <p>Setup note {index + 1}: Keep your project settings and dependencies up to date.</p>
          ))}
          <a href="/install/">Read the installation guide</a>
        </div>
      </Tooltip>
    </Button>
    <p>Scroll this setup checklist to dismiss the tooltip.</p>
    <ol className="tooltip-scroll-checklist">
      <li>Install the package.</li>
      <li>Import the component bundle.</li>
      <li>Load your theme.</li>
      <li>Add a button and tooltip.</li>
      <li>Check keyboard navigation.</li>
      <li>Try scrolling inside the tooltip.</li>
      <li>Try scrolling this checklist.</li>
      <li>Build your application.</li>
    </ol>
  </div>
</div>
```

```css
.tooltip-scroll-container {
  width: 100%;
  height: 220px;
  overflow: auto;
  border: 1px solid var(--border-2);
  border-radius: 8px;
}
.tooltip-scroll-body {
  padding: 32px;
}
.tooltip-scroll-checklist li {
  padding-block: 12px;
  border-top: 1px solid var(--border-2);
}
.tooltip-scroll-example::part(bubble) {
  max-width: 300px;
  max-height: 180px;
}
```

### Contain events

Pass `containEvents` to stop pointer, mouse, touch, click, context-menu, and wheel
events from bubbling to parent handlers. Scrolling and links keep their native
behavior. Keyboard and focus events still propagate. Ancestor capture listeners
can still cancel interactions.

Hover **Event containment help** and scroll inside the bubble or select its link.
Clear **Contain tooltip events** to let the parent count clicks and cancel
scrolling. Scrolling over the parent always increases its wheel counter.

```tsx
import { Tooltip, Button, Checkbox, Text } from '@antadesign/anta'
import { useEffect, useRef, useState } from 'preact/hooks'
import styles from './TooltipContainEventsPreview.module.css'

function Demo() {
  const parent = useRef<HTMLDivElement>(null)
  const [contain, setContain] = useState(true)
  const [wheels, setWheels] = useState(0)
  const [clicks, setClicks] = useState(0)

  useEffect(() => {
    const element = parent.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setWheels(count => count + 1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className={styles.demo}>
      <Checkbox checked={contain} onStateChange={(_, { next }) => setContain(next === true)}>
        Contain tooltip events
      </Checkbox>
      <div ref={parent} className={styles.parent} onClick={() => setClicks(count => count + 1)}>
        <Button label="Event containment help">
          <Tooltip interactive containEvents={contain} className={styles.tooltip}>
            <div>
              <a href="#tooltip-end">Jump to the final note</a>
              {Array.from({ length: 12 }, (_, index) => (
                <p>{'Note ' + (index + 1) + ': Scroll inside this bubble to compare event containment.'}</p>
              ))}
              <p id="tooltip-end">You reached the final note.</p>
            </div>
          </Tooltip>
        </Button>
        <p>This parent cancels wheel events and counts clicks.</p>
        <Text>Parent wheel events: {wheels}</Text>
        <Text>Parent clicks: {clicks}</Text>
      </div>
    </div>
  )
}
```

```css
.demo {
  display: grid;
  gap: 16px;
  width: 100%;
}
.parent {
  padding: 24px;
  border: 1px solid var(--border-2);
  border-radius: 8px;
}
.parent a-text {
  display: block;
}
.tooltip::part(bubble) {
  max-width: 280px;
  max-height: 180px;
}
```

## Show only when truncated

Use `truncatedOnly` when the explanation repeats a label. A label that fits does
not open a bubble. Hover both labels to compare a clipped target with one that
fits.

```tsx
<div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
  <span style={{ display: 'inline-block', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>
    A long label that gets truncated
    <Tooltip truncatedOnly>A long label that gets truncated</Tooltip>
  </span>
  <span style={{ display: 'inline-block', cursor: 'help' }}>
    Short label
    <Tooltip truncatedOnly>Short label</Tooltip>
  </span>
</div>
```

Text with `truncate` already creates an automatic tooltip for clipped,
non-expandable content.

```tsx
<Text truncate style={{ maxWidth: '160px' }}>
  A long release title that does not fit in this space
</Text>
<Text truncate>Short title</Text>
```

Nest your own Tooltip inside Text to replace its automatic explanation. An empty
explicit Tooltip suppresses the automatic one.

```tsx
<Text truncate style={{ maxWidth: '160px' }}>
  A long release title with a custom explanation
  <Tooltip>This release includes keyboard navigation improvements.</Tooltip>
</Text>
```

## Adjacent and nested tooltips

One tooltip is open per document. A tooltip on a nested anchor takes precedence
while that anchor is active. Returning to the outer anchor makes its explanation
available again.

```tsx
<div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
  <div style={{ display: 'flex', gap: '12px' }}>
    <Button label="First"><Tooltip follow>First tooltip</Tooltip></Button>
    <Button label="Second"><Tooltip follow>Second tooltip</Tooltip></Button>
  </div>
  <div tabIndex={0} aria-label="Outer box" style={{ padding: '20px', border: '1px dashed var(--border-4)', borderRadius: '6px', cursor: 'help' }}>
    <span>Outer box</span>
    <Tooltip follow>Outer tooltip</Tooltip>
    <div style={{ marginTop: '12px' }}>
      <Button label="Inner button"><Tooltip follow>Inner tooltip</Tooltip></Button>
    </div>
  </div>
</div>
```

## Content and shape

Content can include text, icons, and markup. An empty or whitespace-only tooltip
does not open. Clearing an open tooltip's content closes it; subsequent content
is available on the next interaction. Use `round` for a softer shape.

```tsx
<Button label="Release status">
  <Tooltip round><strong>Healthy</strong> · Checked two minutes ago</Tooltip>
</Button>
<Button icon="info" aria-label="Action details">
  <Tooltip placement="top"><strong>Heads up</strong> · This action cannot be undone</Tooltip>
</Button>
<Button label="No explanation"><Tooltip>{''}</Tooltip></Button>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | Supplementary text or markup. Content stays in light DOM for application CSS. |
| `containEvents?` | boolean | — | Stop pointer, mouse, touch, click, context-menu, and wheel events from bubbling out of an interactive bubble. Preserves native behavior. Ancestor capture listeners run first and can still cancel interactions. |
| `delay?` | number | 300 | Wait in milliseconds after hover or keyboard focus. Use `50` for a short delay. |
| `follow?` | boolean | — | Follow the cursor instead of pinning under the anchor. The bubble is pinned (anchored beneath the target) by default; pass `follow` for the cursor-tracking behavior, which fades by distance as the cursor leaves. |
| `interactive?` | boolean | — | Keep content available while the pointer or keyboard focus is inside it. Enables pointer events and pins the bubble even with `follow`. Essential actions belong in a Menu or Dialog with an explicit trigger. |
| `placement?` | 'top' \| 'bottom' \| 'left' \| 'right' | bottom | Which side of the anchor the bubble prefers. Auto-flips to the other side when there isn't room. |
| `round?` | boolean \| number \| string | — | Round the bubble to a 20px radius (matching a round menu). Pass a `number` (px) or a CSS length string for a custom radius. |
| `truncatedOnly?` | boolean | — | Only show when the target is actually truncated (its text overflows and is ellipsized); a label that fits gets no tooltip. The check is a UI-thread layout read, re-measured on each show. By default it measures every Anta ellipsizing label part inside the anchor, then the anchor itself — override with `truncatedSelector`. |
| `truncatedSelector?` | string | — | CSS selector (resolved within the anchor) for the element or elements whose overflow decides whether a `truncatedOnly` tooltip shows. |

`truncatedOnly` measures the anchor's reported truncation or its `a-tab-label`,
`a-button-label`, and `a-step-hint` regions. `truncatedSelector` selects a different
measurement target. Single-line targets use horizontal overflow; multi-line
targets can also report vertical clipping. Measurements are refreshed when opening.

A custom numeric or length `round` prop emits an inline CSS variable. If your CSP
blocks style attributes, use external `::part(bubble)` CSS for a custom radius.

## Web Component

Place `a-tooltip` directly inside its anchor. The author owns markup, styles,
accessible names, and descriptions. Tooltip does not add attributes
to its anchor or rewrite the supplied content.

```html
<a-button role="button" tabindex="0" aria-label="Publish" aria-description="Makes the draft public">
  <a-button-label>Publish</a-button-label>
  <a-tooltip id="raw-publish-tooltip">Makes the draft public</a-tooltip>
</a-button>
```

Referencing the Tooltip host with `aria-describedby` does not provide a reliable
description while its internal popover is hidden. Use an authored
`aria-description`, or reference separate application-owned descriptive content
that remains available to assistive technology.

Raw attributes include `delay`, `placement`, `round`, `follow`, `interactive`, `contain-events`,
`truncated-only`, and `truncated-selector`. Boolean attributes use presence.
An anchor can implement `getAnchorRect(): DOMRect` to advertise a smaller
positioning region; Input reports its field instead of its label and hint.

Default styles load from the external component stylesheet. Under CSP, allow
that same-origin stylesheet and the browser entry. Runtime positioning updates
only Tooltip's owned shadow elements. Input and Menu also load their defaults
from external CSS. Custom values serialized into HTML style attributes remain
subject to the [CSP guidance](../install-config.md#content-security-policy).

Reduced motion disables both fades. Older supported browsers can omit parts of
the native popover transition while retaining the content and interaction.

## Styling

Style the visible surface with `::part(bubble)`. Supplied content remains in light
DOM, so application selectors can style its text. `::part(container)` reaches
the outer popover and its opening/closing transition. Keep its positioning and
pointer behavior intact when changing appearance.

The classes below identify this demonstration; use your own selectors.

```css
a-tooltip.custom-tooltip::part(bubble) {
  background: #1a161d;
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: 0 4px 18px color-mix(in oklch, black 35%, transparent);
  backdrop-filter: none;
}
.custom-tooltip-text {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
```

## Example

```tsx
import { Tooltip, Button } from '@antadesign/anta'

function Demo() {
  return (
    <div className="container">
      <Button label="Hover me">
        <Tooltip delay={300}>Edit my props or code</Tooltip>
      </Button>
    </div>
  )
}
```
