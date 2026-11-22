# Expander

`Expander` shows and hides content under a header. Use it for FAQs, settings,
and supporting details.

## Priority

<a id="priority-and-tone"></a>

`priority` controls the section's emphasis. Choose `primary` for a stronger
fill, `secondary` for a subtle fill, or `tertiary` for a transparent section.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Primary" priority="primary"><Text>Shipping information with a stronger surface.</Text></Expander>
      <Expander title="Secondary" priority="secondary"><Text>Shipping information with a subtle surface.</Text></Expander>
      <Expander title="Tertiary" priority="tertiary"><Text>Shipping information without a filled surface.</Text></Expander>
    </Box>
  )
}
```

## Tone

`tone` colors the header and filled surface. Use a semantic tone for status
or a CSS color to match your product.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Build information" tone="info"><Text>The build is running its checks.</Text></Expander>
      <Expander title="Build passed" tone="success"><Text>All checks passed. The release is ready.</Text></Expander>
      <Expander title="Action required" tone="warning"><Text>Review the warnings before publishing.</Text></Expander>
      <Expander title="Project updates" tone="rebeccapurple"><Text>Updates in a custom project color.</Text></Expander>
    </Box>
  )
}
```

## Title

<a id="title-and-level"></a>

`title` labels the section. Use `level` to change the size of a text title.
It changes appearance without adding a heading to the document outline.
Title text remains selectable.

Pass a `Title` as `title` when the section needs a real heading. Custom title
content keeps its own typography, as shown in the [actions example](#actions).

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Order details" level={2}><Text>A prominent section title.</Text></Expander>
      <Expander title="Delivery notes" level={6}><Text>A compact section title.</Text></Expander>
    </Box>
  )
}
```

## Actions

Use `actions` for controls that work independently of opening the section.
They stay visible when the section is closed. The **Download** button updates
the count without toggling the section.

```tsx
import { Button, Expander, Icon, Text, Title } from '@antadesign/anta/bundle'
import { useState } from 'react'

export default function ExpanderActionsDemo() {
  const [downloads, setDownloads] = useState(0)
  return (
    <Expander
      title={<Title level={4}>Build artifacts</Title>}
      indicatorPlacement="end"
      indicator={{ closed: <Icon shape="plus" />, open: <Icon shape="minus" /> }}
      actions={<Button size="small" label="Download" onClick={() => setDownloads(count => count + 1)} />}
    >
      <Text>Download requests: {downloads}. The action leaves the disclosure state unchanged.</Text>
    </Expander>
  )
}
```

## Indicators

<a id="indicator"></a>
<a id="actions-and-indicators"></a>

`indicator` changes the disclosure mark. Choose `chevron`, `triangle`, or
`plus`, which becomes a minus when open. Use `indicatorPlacement="end"` to
place it after the title and actions.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Chevron" indicator="chevron"><Text>A chevron marks the open state.</Text></Expander>
      <Expander title="Triangle" indicator="triangle"><Text>A filled arrow marks the open state.</Text></Expander>
      <Expander title="Plus and minus" indicator="plus"><Text>The plus becomes a minus when open.</Text></Expander>
      <Expander title="Indicator at the end" indicatorPlacement="end"><Text>The indicator follows the header actions.</Text></Expander>
    </Box>
  )
}
```

Pass a node for custom artwork, or an object with `closed` and `open` nodes
to switch between two visuals, as in the [actions example](#actions).
Indicators are decorative. Use `actions` for interactive controls.

## Round

<a id="round-and-outdent"></a>

`round` softens the section's corners. Pass a CSS length for a specific radius.
The shape stays the same when the section opens.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Rounded section" round><Text>The corners keep their radius when expanded.</Text></Expander>
      <Expander title="Custom radius" round="8px"><Text>A section with an 8px corner radius.</Text></Expander>
    </Box>
  )
}
```

## Outdent

Use `outdent` with `priority="tertiary"` to align the title and body with
surrounding text. The start indicator hangs in the gutter; an end indicator
stays inside the section.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Text>Order information</Text>
      <Expander title="Delivery updates" priority="tertiary" outdent defaultOpen><Text>Your order is ready to ship.</Text></Expander>
    </Box>
  )
}
```

## Disabled

Use `disabled` when a section is unavailable. Its header cannot be focused
or toggled. An open section stays open. Header actions remain available;
disable those controls separately when needed.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Box display="grid" gap={8}>
      <Expander title="Disabled, closed" disabled><Text>Collapsed content.</Text></Expander>
      <Expander title="Disabled, open" disabled defaultOpen><Text>Content remains visible.</Text></Expander>
    </Box>
  )
}
```

## Open state

Readers can toggle a section with its header, or focus the header and press
Enter or Space. Use `defaultOpen` to start with the content visible.

Closing keeps the content mounted, preserving form values and local state.
Hidden content is removed from keyboard navigation and the accessibility tree.

### Controlled state

Pass `open` when another control or application state also needs to open the
section. In `onStateChange`, set `open` to `next` to accept the change.
Leave it unchanged to keep the current state.

```tsx
import { Box, Button, Checkbox, Expander, Text } from '@antadesign/anta/bundle'
import { useState } from 'react'

export default function ControlledExample() {
  const [open, setOpen] = useState(false)
  const [accept, setAccept] = useState(true)
  const [requests, setRequests] = useState(0)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Checkbox checked={accept} onStateChange={(_, { next }) => setAccept(next === true)}>Accept state requests</Checkbox>
      <Expander title="Release details" open={open} onStateChange={(_, { next }) => {
        setRequests(count => count + 1)
        if (accept) setOpen(next)
      }}>
        <Text>The content stays mounted when closed.</Text>
      </Expander>
      <Text>State requests: {requests}</Text>
      <Button label="Show details" onClick={() => setOpen(true)} />
    </Box>
  )
}
```

### Prevent closing

When you omit `open`, call `event.preventDefault()` in `onStateChange` to
reject a change. This example stays open while **Keep details open** is selected.

```tsx
import { Box, Checkbox, Expander, Text } from '@antadesign/anta/bundle'
import { useState } from 'react'

export default function CancelableExample() {
  const [keepOpen, setKeepOpen] = useState(true)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Checkbox checked={keepOpen} onStateChange={(_, { next }) => setKeepOpen(next === true)}>Keep details open</Checkbox>
      <Expander title="Unsaved changes" defaultOpen onStateChange={(event, { next }) => {
        if (!next && keepOpen) event.preventDefault()
      }}>
        <Text>Clear the checkbox to allow this section to close.</Text>
      </Expander>
    </Box>
  )
}
```

## Accordion

Share one open item ID when only one section should be open at a time.
Opening another section closes the current one.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'
import { useState } from 'react'

const items = [
  {
    id: 'shipping',
    title: 'Shipping & delivery',
    body: 'Orders ship within two business days. Standard delivery takes another three to five business days. We send a tracking link as soon as your package leaves the warehouse.',
  },
  {
    id: 'returns',
    title: 'Returns',
    body: 'Unworn items can be returned free within 30 days of delivery. Keep the original packaging and start a return from your order details. We issue a refund after inspecting the returned items.',
  },
  {
    id: 'warranty',
    title: 'Warranty',
    body: 'Every product includes a one-year limited warranty covering defects in materials and workmanship. Contact support with your order number and a description of the issue so we can arrange a repair or replacement.',
  },
]

export default function Accordion() {
  const [openId, setOpenId] = useState<string | null>('shipping')
  return (
    <Box display="grid" gap={1}>
      {items.map(item => (
        <Expander key={item.id} title={item.title} open={openId === item.id}
          onStateChange={(_, { next }) => setOpenId(next ? item.id : null)}>
          <Text>{item.body}</Text>
        </Expander>
      ))}
    </Box>
  )
}
```

## Sticky headers

Headers stick to the top as you scroll. The next section pushes the previous
header away. Use your own class names when copying the example.

```tsx
import { Box, Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <div className="sticky-expander-preview" role="region" aria-label="Sticky expander headers" tabIndex={0}>
      <Box className="sticky-expanders" display="grid" gap={1}>
        <Expander title="Shipping and delivery" defaultOpen>
          <Text>
            <p>Orders ship within two business days. Standard delivery takes another three to five business days. We send a tracking link as soon as your package leaves the warehouse.</p>
            <p>Choose express delivery at checkout if you need your order sooner. Available delivery methods and estimated arrival dates depend on your address and appear before you confirm the order.</p>
            <p>If your tracking information stops updating, contact support with your order number. We can check the shipment with the carrier and help you find the next step.</p>
          </Text>
        </Expander>
        <Expander title="Returns" defaultOpen>
          <Text>
            <p>Unworn items can be returned free within 30 days of delivery. Keep the original packaging and start a return from your order details. We issue a refund after inspecting the returned items.</p>
            <p>Pack the items securely and attach the prepaid shipping label. Keep your drop-off receipt until the return reaches us so you can follow its progress with the carrier.</p>
            <p>Refunds go to the original payment method. Your bank may take a few business days to post the credit after we send the confirmation email.</p>
          </Text>
        </Expander>
        <Expander title="Warranty" defaultOpen>
          <Text>
            <p>Every product includes a one-year limited warranty covering defects in materials and workmanship. Contact support with your order number and a description of the issue so we can arrange a repair or replacement.</p>
            <p>Include a few clear photos showing the product and the affected area. These help us understand the problem and decide whether the item needs to be sent in for inspection.</p>
            <p>We explain the available options before you send anything back. If a replacement is needed, we confirm the delivery address and share tracking information when it ships.</p>
          </Text>
        </Expander>
      </Box>
    </div>
  )
}
```

```css
.sticky-expander-preview {
  block-size: 20rem;
  overflow: auto;
}
.sticky-expanders {
  max-inline-size: calc(32rem + 48px);
  margin-inline: auto;
  padding: 24px;
}
.sticky-expanders > a-expander::part(header) {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  background: inherit;
}
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | ReactNode | — | Summary (header) content. A string is rendered with the `level` type scale; pass a node (e.g. a `<Title>`) for full control or real heading semantics in the document outline. |
| `actions?` | ReactNode | — | Header actions rendered outside the toggle trigger. With an end indicator, actions sit between the title and indicator. |
| `defaultOpen?` | boolean | — | Initial open state for the uncontrolled case. |
| `disabled?` | boolean | — | Disables the header: not clickable or focusable, hover affordance off, text dimmed. The open state freezes as-is — disabling an open expander keeps it open. `actions` stay live; disable them separately if needed. |
| `indicator?` | ReactNode | 'chevron' | Built-in disclosure mark, a decorative node, or separate closed/open visuals. Other primitive values leave the indicator empty. Custom nodes are passive; use `actions` for controls. |
| `indicatorPlacement?` | 'start' \| 'end' | 'start' | Place the disclosure mark before the title or after the actions. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 5 | Heading type scale applied to a string `title` (mirrors `<Title>`'s levels). Visual only — for outline semantics, pass a `<Title>` as the title. |
| `onStateChange?` | (event, detail) => void | — | Fired before the open state changes. `event` is the cancelable `statechange` — call `event.preventDefault()` to veto an *uncontrolled* toggle (e.g. confirm before closing). `detail.next` is the requested open state, `detail.prev` the current one (booleans). In controlled mode, apply `detail.next` to `open` to accept, or do nothing to reject. |
| `open?` | boolean | — | Controlled open state. When provided, the consumer owns open/close. Selecting the summary requests a change through `onStateChange`; omit `open` for uncontrolled use. |
| `outdent?` | boolean | — | Align the title and body with surrounding content on a tertiary expander. With the default start indicator, the mark hangs in the gutter; an end indicator stays inside its edge. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'secondary' | Surface emphasis. `secondary` (the default) is a subtle fill; `primary` is a more pronounced card; `tertiary` is transparent (the bare disclosure). |
| `round?` | boolean \| number \| string | — | Use a `1rem` corner radius in both folded and expanded states, independent of title level or header height. Pass a number (px) or CSS length string for a custom radius. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone. Named tones re-point the text and (on filled priorities) the surface to the matching palette; a custom color keeps its hue while lightness/chroma are pinned. `'neutral'` (the default) is the same as omitting it. |

## Web Component

Use `<a-expander>` in HTML. Load `@antadesign/anta/elements/a-expander` for
styles and behavior, and the Button entry when using header actions. The
full bundle includes both. See [Install and configure](../install-config.md) for setup.

```html
<a-expander default-state="open">
  <a-expander-summary level="4">Build artifacts</a-expander-summary>
  <a-expander-actions>
    <a-button role="button" tabindex="0" size="small">
      <a-button-label>Download</a-button-label>
    </a-button>
  </a-expander-actions>
  <a-expander-indicator shape="chevron" aria-hidden="true" inert></a-expander-indicator>
  <a-expander-details>The title and indicator toggle this section. Download is an independent action.</a-expander-details>
</a-expander>
```

### Regions

Place these elements directly inside `<a-expander>`.

| Element | Purpose |
| --- | --- |
| `a-expander-summary` | A text title. Its `level` sets the visual scale. |
| `a-expander-title` | Custom title content, such as a heading. It keeps its own typography. |
| `a-expander-actions` | Controls that remain separate from the toggle button. |
| `a-expander-indicator` | Decorative artwork. Place it before the title or after the actions. |
| `a-expander-details` | The content revealed when the section opens. |

The component supplies the native toggle button, keyboard interaction, expanded
state, and collapsed content's accessibility. Links and enabled controls in
the title work independently. Mark an unrecognized title widget
`data-expander-ignore` to keep it from toggling the section.

Omit unused regions. Empty actions are hidden; whitespace counts as content.

### State and events

`default-state="open"` starts the section open. Use `state="open"` or
`state="closed"` to control it. Reconnecting the element keeps its applied state.

The cancelable `statechange` event reports `detail.next` and `detail.prev` as
`"open"` or `"closed"`. It does not bubble. Call `preventDefault()` to reject
an uncontrolled change. For controlled use, update `state` to accept it.

### Custom indicators

Set `shape` to `chevron`, `triangle`, or `plus`. Omit the indicator region for
no artwork. A single custom indicator rotates with the section's state.
For separate visuals, use two indicator regions with `data-when="closed"`
and `data-when="open"`. Give indicator artwork `aria-hidden="true"` and `inert`.

### Native details

Use `<details data-anta>` for Expander styling with native disclosure behavior.
It uses the `open` attribute and native `toggle` events. Set `level` on `details`
to change the summary's visual scale.

```html
<details data-anta priority="secondary">
  <summary>Shipping and delivery</summary>
  <p>Orders ship within two business days.</p>
</details>
```

### Custom values and CSP

Custom `tone` and `round` values in JSX use inline styles. When your CSP blocks
style attributes, use classes and external CSS. For raw custom tones, set
`--expander-tone-source` in CSS for browsers without typed color attributes.
See [Content Security Policy](../install-config.md#content-security-policy) for setup.

### Updating older markup

Replace slot attributes with the direct regions above. Move raw `level` to
`a-expander-summary`, and choose indicator placement through the region's order.
Existing shadow part selectors remain supported.

## Styling

Use `priority`, `tone`, `round`, and `outdent` for the built-in variants.
`--expander-tone-source` supplies a custom color, and `--expander-gutter`
adjusts the title and body inset. Style authored regions directly and use
`::part()` for the header, toggle button, actions, indicator, and content.
Unlayered CSS overrides the component's defaults without `!important`.

Hide the indicator and reduce the space before the title and content.

```tsx
import { Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Expander className="hide-chevron" title="A section without the built-in indicator" defaultOpen><Text>The title and keyboard interaction remain available.</Text></Expander>
  )
}
```

```css
a-expander.hide-chevron > a-expander-indicator { display: none; }
a-expander.hide-chevron { --expander-gutter: 12px; }
```

Give the header more height and a background on hover.

```tsx
import { Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Expander className="header-tint" title="Hover or focus the header" priority="tertiary"><Text>The button keeps native keyboard behavior.</Text></Expander>
  )
}
```

```css
a-expander.header-tint::part(summary) { min-height: 40px; }
a-expander.header-tint::part(summary):enabled:hover { background: var(--bg-3); }
```

Change the indicator color when the section is open.

```tsx
import { Expander, Text } from '@antadesign/anta/bundle'

export default function Demo() {
  return (
    <Expander className="state-indicator" title="Open to highlight the indicator" indicatorPlacement="end"><Text>The indicator follows the applied state.</Text></Expander>
  )
}
```

```css
a-expander.state-indicator > a-expander-indicator { color: var(--text-4); }
a-expander.state-indicator:state(open) > a-expander-indicator { color: var(--text-1); }
```

## Example

```tsx
import { Expander, Text } from '@antadesign/anta'

function Demo() {
  return (
    <Expander title="What is automated testing?" defaultOpen>
      <Text>Automated testing runs checks against your software and reports failures you can investigate and reproduce.</Text>
    </Expander>
  )
}
```
