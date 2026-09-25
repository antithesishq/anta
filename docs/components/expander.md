# Expander

A collapsible disclosure: a header that toggles a region of content open
and closed. The `Expander` JSX wrapper renders an `<a-expander>`, whose
shadow DOM is a `<button>` summary plus a collapsible region — so focus,
keyboard activation (Enter / Space), and the
WAI-ARIA disclosure semantics (`aria-expanded`) come from the platform
button. The expand / collapse animation matches the disclosure sections
used across these docs.

The `title` is the always-visible header; the `children` are the
collapsible body.

## Priority

`priority` sets the surface, reusing `Button`/`Text`'s vocabulary.
`primary` is the most pronounced card; `secondary` (the default) is a
subtle filled box; `tertiary` is transparent — just the header row and
its chevron, for an inline disclosure.

```tsx
<Expander title="Primary" priority="primary">…</Expander>
<Expander title="Secondary (default)">…</Expander>      {/* secondary is the default */}
<Expander title="Tertiary" priority="tertiary">…</Expander>
```

## Round

`round` sizes the corners to **half the folded header height** — so a folded
expander reads as a pill, and an open one keeps that *same* corner radius instead
of a bigger stadium. The header is measured (a `ResizeObserver`), so the pill
tracks the header at any `level` or with custom header content. Open the example
to see the corners hold their radius as the body appears.

```tsx
<Expander round title="Details" priority="primary">…</Expander>
```

## Tone

Pick a semantic `tone` to tint the header text and — on the filled
priorities (`secondary` / `primary`) — the surface too. The set matches
`Button` / `Tag`: `neutral` (the default) plus `brand`, `info`,
`success`, `warning`, and `critical`. Color comes from the theme tokens,
so every tone tracks light and dark mode automatically. Every tone is
shown below across all three priorities, so you can compare (rows are
tones, columns are priorities):

**Primary**

**Secondary** (default)

**Tertiary**

```tsx
// every tone × every priority — e.g. brand:
<Expander tone="brand" priority="primary" title="Brand" />
<Expander tone="brand" title="Brand" />                       {/* secondary — the default */}
<Expander tone="brand" priority="tertiary" title="Brand" />
// …repeat for neutral / info / success / warning / critical
```

`tone` also accepts **any literal CSS color** for a one-off tint — the
hue is kept while lightness and chroma are pinned to the named-tone curve
(and re-tuned for dark mode), the same mechanism as `Button` / `Tag`:

```tsx
// shown on the `primary` surface — the custom tone tints the fill;
// drop to "secondary" (the default) for a subtler card, or "tertiary" for text only.
<Expander tone="#ff1493" priority="primary" title="Magenta" />
<Expander tone="rebeccapurple" priority="primary" title="Purple" />
<Expander tone="#0d9488" priority="primary" title="Teal" />
```

## Outdent

By default the chevron sits **inside** the header row. On a transparent
`priority="tertiary"` expander, add `outdent` to hang the chevron in the
left gutter so the **title and body sit flush** with the surrounding
content — the same layout as the section headers in these docs. Under the
hood it zeroes `--expander-gutter`: the title and body lose their inset and
the chevron, positioned in that gutter, auto-hangs to the left. The
transparent border stays (it keeps tertiary content aligned with the filled
priorities), and a small internal correction cancels the border's 1px inset
so the title and body line up exactly with the surrounding content.

```tsx
<Expander priority="tertiary" outdent title="…">…</Expander>
```

`outdent` only takes effect on `tertiary` — on the filled priorities
(`secondary` / `primary`) the container edge has to bound the chevron, so
it's a no-op there. Use it where the expander sits in a content column
with room to its left (a prose measure); in a full-width / edge-to-edge
container the chevron would overhang the edge.

## Indicator

`indicatorPlacement="end"` puts the disclosure mark after the header actions.
The mark stays inside the summary button, so selecting it toggles the section.
Actions remain separate controls. The default `start` placement keeps the
right-pointing chevron that turns down when open. At the end, it points down
when closed and up when open.

Choose `indicator="triangle"` for a filled arrow or `indicator="plus"` for a
plus that becomes a minus. The default is `chevron`. The built-in motion follows
the reduced-motion preference.

```tsx
<Expander title="Download report" indicatorPlacement="end"
  actions={<Button size="small" label="Download" />}>
  …
</Expander>
<Expander title="Plus and minus" indicator="plus" indicatorPlacement="end">…</Expander>
```

Pass a decorative node as `indicator` to replace the built-in mark. One node
rotates with the section. To switch between two visuals, pass `closed` and
`open` nodes. Neither form adds a focus stop or an accessible name: the title
names the summary button, and its `aria-expanded` reports the state. Put
interactive controls in `actions`.

```tsx
<Expander title="Custom mark" indicatorPlacement="end"
  indicator={<Icon shape="chevron-down" />}>…</Expander>
<Expander title="Two marks" indicatorPlacement="end"
  indicator={{ closed: <Icon shape="plus" />, open: <Icon shape="minus" /> }}>…</Expander>
```

On a tertiary end-placement expander, `outdent` still aligns the title and body
with surrounding content. The indicator stays inside the end edge.

## Title and level

`title` takes a string or any node. For a string, `level` (1–6) applies
the matching heading **type scale** — the same scale as `<Title>` —
without changing the document outline. Only the type scale changes: the
title's left alignment is constant across every level (the chevron + a
fixed 4px edge inset), so swapping `level` never shifts the header
horizontally.

```tsx
<Expander title="Level 1" level={1}>…</Expander>
<Expander title="Level 2" level={2}>…</Expander>
<Expander title="Level 3" level={3}>…</Expander>
<Expander title="Level 4" level={4}>…</Expander>
<Expander title="Level 5 (default)">…</Expander>      {/* level 5 is the default */}
<Expander title="Level 6" level={6}><Text size="small">…</Text></Expander>  {/* pair the smallest level with small body text */}
```

When you need real heading **semantics** — so the title lands in a
page's table of contents (and assistive tech announces it as a heading) —
pass a `<Title>` (or an application `<h2>`–`<h6>`) as the `title` instead of a
string. The heading's `level` sets its type scale, so set it on the heading,
not on `<Expander>`. A slotted heading keeps its block margins, so reset them
in the header:

```tsx
{/* A Title supplies its type scale and heading semantics. Set the level on
   the Title, not on Expander. (The preview uses element composition
   because these docs render statically; the title-prop form is identical.) */}
<Expander title={<Title level={2}>Title level 2 example</Title>}>…</Expander>
<Expander title={<Title level={4}>Title level 4 example</Title>}>…</Expander>
<Expander title={<Title level={6}>Title level 6 example</Title>}>…</Expander>

{/* a slotted heading keeps its block-rhythm margins — zero them in the header */}
<style>{`
  a-expander a-title { margin: 0; }
`}</style>
```

## Controls in the title

A control placed **inside** the `title` — a copy button next to the
heading text, an inline link, an inline `Input` — copies or activates
without toggling the section. The header refuses to toggle when the click
landed on any Anta control (`Button` / `ButtonCopy`, `Checkbox`, `Radio`,
`Input`, `Select`, `InputDate`, `Calendar`, a `Menu` item, a `Tab`) or a
native control (`button` / `a[href]` / `input` / `select` / `textarea` /
`label` / editable), so a `ButtonCopy` beside the title works with no
extra wiring:

```tsx
{/* A ButtonCopy in the title copies without toggling — no stopPropagation needed. */}
<Expander title={<>Debug timeline <ButtonCopy copy={moment} icon="copy" size="small" priority="tertiary" /></>}>
  …
</Expander>
```

The decision is read from the click's composed path synchronously in the
element, so it holds even where event handlers run off the UI thread (a
consumer's `stopPropagation()` can arrive too late to beat the toggle) —
the same contract as `Menu`'s close-on-outside-click.

A **disabled** control is inert, so its click toggles the section like the
title text does — the exclusion applies only to live controls. For a
control the detection can't recognize (a non-interactive custom widget
with its own handler), mark it `data-expander-ignore` to opt it out of the
toggle:

```tsx
<Expander title={<>Report <MyWidget data-expander-ignore /></>}>…</Expander>
```

## Actions

Pass `actions` to render extra controls — buttons, tags — after the title.
They sit **outside** the toggle trigger as its header siblings. Clicking them
never toggles the expander; they're separately focusable and announced as
their own controls.
(Don't put interactive elements *inside* a custom `title` instead —
nesting controls in a button is an accessibility anti-pattern.)

```tsx
<Expander title="Build artifacts" actions={<Button size="small" label="Download" />}>
  …
</Expander>
```

The header never wraps: actions keep their intrinsic size and the
title ellipsizes first, so keep actions compact (a small button or
two, a tag). Pass several controls as a fragment — they form a row
with a 2px gap:

```tsx
<Expander
  title="A very long expandable section title that shows how the actions would push content to ellipsize when space runs out"
  actions={<><Button size="small" label="Expand" /><Button size="small" label="Share" /><Button size="small" label="Download" /></>}
>
  …
</Expander>
```

Actions stay visible in the folded state — the header represents the
section whether it's open or not (the same convention as GitHub's file
headers). If an action only makes sense while open, drive the expander
in controlled mode and swap the `actions` node on toggle.

## Disabled

`disabled` freezes the expander: the header is no longer clickable or
focusable, the hover affordance is off, and the text dims. The open
state stays as-is — disabling an open expander keeps it open. Header
`actions` stay live; disable them separately if needed.

```tsx
<Expander title="Disabled, closed" disabled>…</Expander>
<Expander title="Disabled, open" disabled defaultOpen>…</Expander>
```

## Open state

For uncontrolled use, pass `defaultOpen` for the initial state. The element
then updates its open state after interaction. For controlled use, pass `open`
and handle `onStateChange`. The expander follows the `open` prop and reports a
requested change. Update application state with `detail.next` to accept it, or
leave the state unchanged to reject it.

`onStateChange` is event-first: `(event, { next, prev })`, where `next`/`prev`
are booleans (the requested / previous open state). `statechange` fires
**before** the element applies anything and is **cancelable**, so even
uncontrolled you can veto a toggle synchronously with `event.preventDefault()`
(e.g. a section that confirms before closing) — no need to lift state.

```tsx
// uncontrolled
<Expander title="Details" defaultOpen>…</Expander>

// uncontrolled, with a veto
<Expander title="Details" onStateChange={(e, { next }) => {
  if (!next && unsaved) e.preventDefault()   // refuse to close
}}>…</Expander>

// controlled
const [open, setOpen] = useState(false)
<Expander title="Details" open={open} onStateChange={(e, { next }) => setOpen(next)}>…</Expander>
```

## Controlled vs Uncontrolled

Open state follows Anta's shared **state contract**. In uncontrolled use, the
element updates open state. In controlled use, the application supplies it. The
`<Expander>` wrapper uses booleans; the `<a-expander>` element uses a `state`
string. The wrapper maps between them:

| | `<Expander>` (JSX) | `<a-expander>` (element) |
|---|---|---|
| **Uncontrolled** | `defaultOpen` | `default-state="open" \| "closed"` |
| **Controlled** | `open` + `onStateChange` | `state="open" \| "closed"` + `statechange` |
| **Change event** | `onStateChange(event, { next, prev })` — `next` / `prev` are **booleans** | `statechange`, a `CustomEvent<{ next, prev }>` — `'open'` / `'closed'` |

`statechange` is **cancelable** and fires *before* the element applies the
change. Uncontrolled, call `event.preventDefault()` to veto a toggle (e.g.
confirm before closing). Controlled, the element never self-applies — apply
`detail.next` to `open` to accept, or do nothing to reject.

### Accordion

An accordion is the controlled pattern applied to a stack of expanders that share one
open value: hold the open item's id in state, point each `open` at it, and on
`onStateChange` set that id (or `null`) — so opening one folds the rest. Wrapping them
in a `.accordion` lets you square the inner corners and overlap the borders by 1px, so
the stack reads as one panel.

```tsx
const ITEMS = [
  { id: 'shipping', title: 'Shipping & delivery', body: '…' },
  { id: 'returns',  title: 'Returns',             body: '…' },
  { id: 'warranty', title: 'Warranty',            body: '…' },
]

function Accordion() {
  const [openId, setOpenId] = useState('shipping')  // null = all closed
  return (
    <div className="accordion">
      {ITEMS.map((item) => (
        <Expander
          key={item.id}
          title={item.title}
          open={openId === item.id}
          onStateChange={(_e, { next }) => setOpenId(next ? item.id : null)}
        >
          <Text>{item.body}</Text>
        </Expander>
      ))}
    </div>
  )
}
```

```css
.accordion { display: flex; flex-direction: column; }

/* Overlap adjacent borders so they share one 1px line. */
.accordion a-expander:not(:first-child) { margin-top: -1px; }

/* Square the inner corners so the stack reads as one panel. */
.accordion a-expander:first-child { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.accordion a-expander:last-child  { border-top-left-radius: 0; border-top-right-radius: 0; }
.accordion a-expander:not(:first-child):not(:last-child) { border-radius: 0; }
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | ReactNode | — | Summary (header) content. A string is rendered with the `level` type scale; pass a node (e.g. a `<Title>`) for full control or real heading semantics in the document outline. |
| `actions?` | ReactNode | — | Header actions rendered outside the toggle trigger. With an end indicator, actions sit between the title and indicator. |
| `defaultOpen?` | boolean | — | Initial open state for the uncontrolled case. |
| `disabled?` | boolean | — | Disables the header: not clickable or focusable, hover affordance off, text dimmed. The open state freezes as-is — disabling an open expander keeps it open. `actions` stay live; disable them separately if needed. |
| `indicator?` | ReactNode | 'chevron' | Built-in disclosure mark, a decorative node, or separate closed/open visuals. Custom nodes are passive; use `actions` for controls. |
| `indicatorPlacement?` | 'start' \| 'end' | 'start' | Place the disclosure mark before the title or after the actions. |
| `level?` | 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 5 | Heading type scale applied to a string `title` (mirrors `<Title>`'s levels). Visual only — for outline semantics, pass a `<Title>` as the title. |
| `onStateChange?` | (event, detail) => void | — | Fired before the open state changes. `event` is the cancelable `statechange` — call `event.preventDefault()` to veto an *uncontrolled* toggle (e.g. confirm before closing). `detail.next` is the requested open state, `detail.prev` the current one (booleans). In controlled mode, apply `detail.next` to `open` to accept, or do nothing to reject. |
| `open?` | boolean | — | Controlled open state. When provided, the consumer owns open/close. Selecting the summary requests a change through `onStateChange`; omit `open` for uncontrolled use. |
| `outdent?` | boolean | — | Align the title and body with surrounding content on a tertiary expander. With the default start indicator, the mark hangs in the gutter; an end indicator stays inside its edge. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'secondary' | Surface emphasis. `secondary` (the default) is a subtle fill; `primary` is a more pronounced card; `tertiary` is transparent (the bare disclosure). |
| `round?` | boolean \| number \| string | — | Round corners sized to half the folded (header) height: a pill when folded, and — when expanded — the same corner radius rather than a bigger stadium. The element measures the header, so it tracks custom header content. Pass a `number` (px) or CSS length string for a *fixed* radius that overrides the measurement (and skips it) in both states. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone. Named tones re-point the text and (on filled priorities) the surface to the matching palette; a custom color keeps its hue while lightness/chroma are pinned. `'neutral'` (the default) is the same as omitting it. |

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Slots hold the title, actions, and an optional custom indicator. The details
element contains the collapsible body.

```html
<a-expander default-state="open">
  <a-expander-summary slot="title">Build artifacts</a-expander-summary>
  <a-button slot="actions" role="button" tabindex="0" size="small">
    <a-button-label>Share</a-button-label>
  </a-button>
  <a-expander-details>Everything without a slot attribute is the body.</a-expander-details>
</a-expander>
```

Use the `indicator` and `indicator-placement` attributes for built-in marks.
For custom artwork, assign one element to `slot="indicator"`. Assign two
elements with `data-when="closed"` and `data-when="open"` when the artwork
changes between states. Indicator content is decorative and cannot receive focus
or pointer events.

```html
<a-expander indicator="triangle" indicator-placement="end">…</a-expander>

<a-expander indicator-placement="end">
  <a-expander-summary slot="title">Custom mark</a-expander-summary>
  <a-icon slot="indicator" shape="chevron-down" aria-hidden="true" inert></a-icon>
  <a-expander-details>Content</a-expander-details>
</a-expander>

<a-expander indicator-placement="end">
  <a-expander-summary slot="title">Two marks</a-expander-summary>
  <a-icon slot="indicator" data-when="closed" shape="plus" aria-hidden="true" inert></a-icon>
  <a-icon slot="indicator" data-when="open" shape="minus" aria-hidden="true" inert></a-icon>
  <a-expander-details>Content</a-expander-details>
</a-expander>
```

### Native HTML details

For a simple disclosure, add `data-anta` to native `<details>`. It keeps the
browser's opening, keyboard, and accessibility behavior while taking on the
neutral tertiary Expander treatment. Add `priority="secondary"` or `"primary"`
for a filled surface. `round`, `tone`, tertiary `outdent`, and `level="1"`–`"6"`
use the matching Expander visual treatments. `level` changes visual type only;
use a heading inside the summary when you need heading semantics.

```html
<details data-anta priority="secondary" tone="info" round level="3" open>
  <summary>Build artifacts</summary>
  <div>Everything inside &lt;details&gt; is the collapsible body.</div>
</details>
```

## Styling

Reach for the props first: **`tone`** sets the color (any CSS color for a custom
tone — it derives the surface in oklch), **`priority`** the fill, **`level`** the
heading. Two knobs are worth keeping: **`--expander-tone-source`** (the color a
custom `tone` derives from — set it to drive the palette from your own variable) and
**`--expander-gutter`** (the shared title and body inset; it also positions the
start indicator). It is 24px at the start, 12px at the end, and `0` with tertiary
`outdent`.

```tsx
<Expander tone="#e0457b" title="Custom" />
```

For everything else, `<a-expander>` exposes shadow **parts** — `::part(summary)` (the
header button), `::part(indicator)` (the decorative mark), `::part(content)` (the
body), and `::part(actions)` (the actions row) — and the light-DOM
`<a-expander-summary>` / `<a-expander-details>` children, which you style directly.

Each example keeps its CSS in a `<style>` **inside** its own preview, targeting a demo
class on that preview's expander (e.g. `.hide-chevron`) — so the rule you read is
literally in the preview's DOM, next to the element it styles, never a page-wide
stylesheet. The folded recipe under each preview is that same CSS; in your app, swap the
demo class for your own selector.

**Hide the indicator.** A disclosure needs a visible affordance. If the title
provides one, hide the indicator part and tighten the unused gutter:

```css
a-expander.hide-chevron::part(indicator) { display: none; }
a-expander.hide-chevron { --expander-gutter: 12px; }               /* tighten the inset (default 24px) */
```

**Change the indicator.** Use the built-in `triangle` or `plus` preset, or
provide a custom node through `indicator` / `slot="indicator"`:

```tsx
<Expander title="Triangle indicator" indicator="triangle" priority="tertiary">…</Expander>
```

**Tint the whole header** on hover / press by styling the summary part (the header
`<button>`):

```css
a-expander.hover-tint::part(summary):hover  { background: var(--bg-3); }
a-expander.hover-tint::part(summary):active { background: var(--bg-2); }
```

**Highlight the title on hover.** The title inherits its `color` from `::part(summary)`,
so recolor the part on hover and the title (and the `currentColor` chevron) follow — a
custom title node that sets its own `color` opts out. Here we also drop the tertiary
hover underline on the light-DOM `a-expander-summary`:

```css
a-expander.title-highlight::part(summary):hover { color: #e5484d; }       /* title color on hover */
a-expander.title-highlight a-expander-summary { text-decoration: none; }  /* drop the hover underline */
```

**React to open / closed state** with the **`:state(open)`** custom state — your CSS can
respond to it in controlled and uncontrolled mode alike, no JS. Two worked examples.

*A custom code block* — pointed at the code-block surface tokens so it reads like the
foldable code blocks on this site: a darker header bar over a lighter content surface, a
`border-5` frame, and a tertiary-button copy that fades in once open.

```tsx
{/* An Expander pointed at the code-block surface tokens so it reads like the
    foldable code blocks on this site: a darker header bar over a lighter
    content surface, a border-5 frame, and a tertiary-button copy that fades
    in once open. */}
<Expander
  title="Example.tsx"
  actions={<Button priority="tertiary"><Icon shape="copy" /></Button>}
  className="code-like"
  defaultOpen
>
  <pre>{`import { Button } from '@antadesign/anta'

export function SaveButton() {
  return <Button priority="primary">Save</Button>
}`}</pre>
</Expander>

<style>{`
  a-expander.code-like {
    background: var(--bg-pane);         /* header — a bit darker than the content */
    border-color: var(--border-5);     /* the code-block frame outline */
    color: var(--text-2);              /* title + code */

    /* With custom corner radius don't reach for overflow:hidden (it would clip
       the focus ring); instead give the host the radius and match it on the
       parts: ::part(summary) the top corners, the body the bottom corners. */
    border-radius: 0;
  }
  a-expander.code-like::part(summary):hover { color: var(--text-1); }  /* title brightens on hover */
  a-expander.code-like::part(summary) { min-height: 36px; }
  a-expander.code-like::part(actions) { gap: 6px; }        /* roomier action row */
  a-expander.code-like a-expander-summary {
    font-size: 14px;                       /* the title, a touch bigger */
    letter-spacing: 0.02em;
  }
  a-expander.code-like::part(content) { background: var(--bg-canvas); }  /* content — lighter than the header */
  a-expander.code-like a-expander-details {
    padding: 12px 16px 14px;               /* roomier top padding above the code */
    font-family: var(--monospace);
    font-size: 13px;
    font-weight: 440;
    line-height: 20px;
  }
  a-expander.code-like a-expander-details pre { margin: 0; font: inherit; }
  a-expander.code-like [slot="actions"] { opacity: 0; transition: opacity 150ms ease; }  /* copy appears once open */
  a-expander.code-like:state(open) [slot="actions"] { opacity: 1; }
`}</style>
```

*Style the indicator by state* with `:state(open)` and `::part(indicator)`. The
example changes its color without changing the built-in glyph or motion:

```tsx
<Expander title="Build log" indicatorPlacement="end" className="indicator" defaultOpen>…</Expander>
<style>{`
  a-expander.indicator::part(indicator) { color: var(--text-4); }
  a-expander.indicator:state(open)::part(indicator) { color: var(--text-1); }
`}</style>
```
