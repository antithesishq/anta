# Tabs

A tablist for switching between views. The strip is data-driven: pass an
`options` array (like [RadioGroup](./radio.md)), each entry a unique `value` plus a
`label` (or `children`) and optional `icon` / `iconTrailing`. That alone is a
selectable strip that emits the chosen value; add matching `<TabPanel>` children
(see [Panels](#panels)) to show and hide the content too.

Each option can also set `className`, `style`, and `data-*` attributes on its
individual `<a-tab>`.

## Priority

```tsx
<Tabs priority="primary"   defaultValue="a">…</Tabs>  {/* default */}
<Tabs priority="secondary" defaultValue="a">…</Tabs>
<Tabs priority="tertiary"  defaultValue="a">…</Tabs>
```

`priority` sets the selected-tab indicator:

- **`primary`** (default): a pill on a track.
- **`secondary`**: a filled tab, no track.
- **`tertiary`**: an underline.

## Tone

Six named tones: `neutral` (default), `brand`, `info`, `success`, `warning`,
`critical`. Any CSS color works for a one-off custom tone. The tone runs through the
strip's labels, indicator, and track at every priority. Rows are tones (the last is a
custom color); columns are priorities.

**Primary**

**Secondary**

**Tertiary**

```tsx
<Tabs tone="brand" priority="secondary" defaultValue="a">…</Tabs>
<Tabs tone="#e0457b" priority="tertiary" defaultValue="a">…</Tabs>  {/* any CSS color */}
```

**Per-tab tone.** A `tone` on an individual option overrides the strip's tone for that one
tab: it colors the label and icons in every mode, and the indicator when it's the active tab.
A named tone colors the sliding indicator too; a custom literal color tones the label
everywhere but the indicator only under `noslide` (the single shared sliding element can't
read a descendant's color).

```tsx
<Tabs
  defaultValue="overview"
  label="Review queue"
  options={[
    { value: 'overview', label: 'Overview' },
    { value: 'approved', label: 'Approved', icon: 'circle-check', tone: 'success' },
    { value: 'flagged', label: 'Flagged', tone: 'warning' },
    { value: 'rejected', label: 'Rejected', tone: 'critical' },
  ]}
/>
```

## Size

```tsx
<Tabs size="small" defaultValue="a">…</Tabs>
```

Three sizes reuse [Button](./button.md)'s type scale, so a strip lines up with
same-size buttons and inputs: `small`, `medium` (default), `large`. Icons scale
with the tab.

## Orientation

`horizontal` (default) lays the tabs in a row; `vertical` stacks them into a column.
The arrow keys follow the axis: `←`/`→` when horizontal, `↑`/`↓` when vertical. To
put panels **beside** a vertical strip, wrap `<Tabs>` in your own flex row (the strip
and panels are siblings; see [Panels](#panels)). Vertical works at every priority:

**Primary**

**Secondary**

**Tertiary**

```tsx
<Tabs
  orientation="vertical"
  priority="tertiary"
  defaultValue="general"
  options={[
    { value: 'general', label: 'General' },
    { value: 'members', label: 'Members' },
    { value: 'integrations', label: 'Integrations' },
  ]}
/>
```

## Icons and content

A tab option takes a leading **`icon`** and a trailing **`iconTrailing`**; here the
trailing dot flags an unsaved file. For more than text, give the option **`children`**
instead of `label`, like a [Tag](./tag.md) counter.

```tsx
<Tabs
  defaultValue="app"
  label="Open files"
  options={[
    { value: 'app', icon: 'braces', children: <>app.tsx <Tag size="small" value="2" /></> },
    { value: 'readme', label: 'README.md', icon: 'file' },
    { value: 'styles', icon: 'file', iconTrailing: 'circle-small-solid', children: 'styles.css' },
  ]}
/>
```

## Overflow

When the tabs don't fit, their labels truncate with an ellipsis; the strip never
widens the page. To scroll or wrap labels instead, see [Styling](#styling).

Set an option's **`tooltip`** and a clipped tab reveals its full label on hover; tabs
that fit show nothing. It renders as a `truncatedOnly` [Tooltip](./tooltip.md#show-only-when-truncated)
anchored to the tab, so it shows only when the label ellipsizes. Hover the truncated
tabs above to see it.

```tsx
<Tabs
  defaultValue="overview"
  label="Sections"
  options={sections.map(({ value, label }) => ({
    value,
    label,
    tooltip: label,
  }))}
/>
```

## Panels

```tsx
{/* The strip and panels are flat siblings — you arrange them. A flex column gaps
    them; the strip centers itself (a <Tabs> `style` lands on <a-tabs>). */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <Tabs
    defaultValue="account"
    label="Settings"
    style={{ alignSelf: 'center' }}
    options={[
      { value: 'account', label: 'Account', icon: 'home' },
      { value: 'security', label: 'Security' },
      { value: 'billing', label: 'Billing' },
    ]}
  >
    <TabPanel value="account"><AccountForm /></TabPanel>
    <TabPanel value="security"><SecurityForm /></TabPanel>
    <TabPanel value="billing"><BillingForm /></TabPanel>
  </Tabs>
</div>
```

Add a `<TabPanel value="…">` child for each option; each panel shows itself when
its value is active. The panel names its tab as its accessible label
(`aria-labelledby`, off-DOM). Panel content is arbitrary React, so it renders normally.

Panels are **optional**. Without panels, `Tabs` renders the strip. Listen to
`onStateChange` / `onValueChange` and render the content yourself.

### JSX vs DOM

The strip renders from the `options` array; each `<TabPanel>` renders a
self-managing `<a-tabpanel>`. `Tabs` **never reads or toggles the panels**: there's
no child introspection, so it renders the same in static SSR and works with any
renderer. There is **no wrapper element**: the JSX becomes the strip followed by the
panels as flat **siblings**, and `className` / `id` / `style` / `...rest` land on the
strip. Arranging them is up to you (see below):

```html
<a-tabs role="tablist">
  <a-tab role="tab" value="account" tabindex="0"><a-tab-label>Account</a-tab-label></a-tab>
  …
</a-tabs>
<a-tabpanel role="tabpanel" value="account">…</a-tabpanel>   <!-- active: shown -->
<a-tabpanel role="tabpanel" value="security">…</a-tabpanel>  <!-- inactive: display:none -->
```

A horizontal strip stacks above its panels in normal flow with no extra markup; for a
vertical strip beside its panels, wrap `<Tabs>` in your own flex row. The panels find
the strip as a sibling under the same parent (`a-tabpanel` → `:scope > a-tabs`), so
keep them together; to split them into separate layout regions, drive a
controlled `value` and render the panels yourself.

Each `<a-tabpanel>` sits **beside** `<a-tabs>` (its sibling, never inside it, so a
panel never lands in the primary track). It reads the active value from `<a-tabs>`
and shows/hides **itself** via its own off-DOM `:state(active)`; nothing writes
`hidden` / `inert` on it. The panel↔tab link is off-DOM too
(`internals.ariaLabelledByElements`), so no `id` wiring is needed. No web component
writes the light DOM, only your JSX does, which keeps a worker-thread reactive engine
in sync.

### Hiding an inactive panel

A `<TabPanel>` stays mounted while inactive (its DOM, form values, and scroll
survive tab switches); `hideMode` picks how it hides:

- **`display`** (default): `display:none`; leaves the tab order + a11y tree.
- **`visibility`**: `visibility:hidden`, keeping its layout box (to avoid reflow
  or to measure a hidden panel).

```tsx
<TabPanel value="b" hideMode="visibility"><Chart /></TabPanel>
```

To **not render** an inactive panel at all (unmount it to reset its state or defer an
expensive subtree, or mount it lazily on first open), drive selection with a
controlled `value` and render the panels yourself. `Tabs` passes panels straight
through, so you decide what's mounted:

```tsx
const [tab, setTab] = useState('a')

// Unmount inactive — only the open panel exists:
<Tabs value={tab} onStateChange={(_e, { next }) => next && setTab(next)} options={…}>
  {tab === 'a' && <TabPanel value="a"><Expensive /></TabPanel>}
  {tab === 'b' && <TabPanel value="b"><Form /></TabPanel>}
</Tabs>

// Lazy — mount on first open, keep after (track a "seen" set in state):
{seen.has('b') && <TabPanel value="b"><Heavy /></TabPanel>}
```

The same controlled pattern places the strip and panels in **different layout
regions**: render `<Tabs options={…} value onStateChange>` in one place and your
content wherever you like, switching on the value yourself.

## Controlled vs. uncontrolled

The active tab is identified by one option's **value string**. Tabs marks the
matching tab selected and shows the corresponding `<TabPanel value="…">`, when
one exists. Choose either uncontrolled or controlled state:

**Uncontrolled.** Pass `defaultValue` (an option's `value`). Tabs then updates
the active tab after interaction:

```tsx
<Tabs
  defaultValue="overview"
  options={[
    { value: 'overview', label: 'Overview' },
    { value: 'activity', label: 'Activity' },
  ]}
/>
```

**Controlled.** Pass `value` (an option's `value`) and `onStateChange`.
`onStateChange` fires before the change applies. Set `value` to the new tab to
accept it, or leave it unchanged to reject it.

```tsx
const [tab, setTab] = useState('overview')

<Tabs
  value={tab}
  onStateChange={(e, { next }) => setTab(next)}
  options={[
    { value: 'overview', label: 'Overview' },
    { value: 'activity', label: 'Activity' },
  ]}
/>
```

## Keyboard & accessibility

Every enabled tab is in the tab order; `Tab` / `Shift`+`Tab` step through them.
The arrow keys also move between enabled tabs (wrapping at the ends), `Home` /
`End` jump to the first / last, and `Space` / `Enter` activate the focused tab;
arrow / `Home` / `End` navigation activates as it moves (selection follows focus).
Disabled tabs are skipped and dropped from the tab order.

Pass `label` for the tablist's accessible name. Each `<TabPanel>` names its tab as
its accessible label (`aria-labelledby`), set off-DOM so nothing writes the panel's
attributes.

## Routing

`Tabs` reports the picked value and leaves navigation to the app, so a strip can
switch routes as readily as panels. Treat each `value` as a path: control `value`
from the current location and navigate in `onStateChange` (the pick fires *on click*;
`onValueChange` waits for `value` to change, which for a route happens only after
you've already navigated). Skip the `<TabPanel>`s, since the router renders the view.

```tsx
<Tabs
  value={pathname}
  onStateChange={(_e, { next }) => next && navigation.navigate(next)}
  options={[
    { value: '/settings/profile', label: 'Profile' },
    { value: '/settings/billing', label: 'Billing' },
  ]}
/>
```

Swap `navigation.navigate` for whatever the app uses (`router.push`, Astro's
`navigate`, `location.assign`). Controlling `value` from the route keeps the right
tab active through back/forward and deep links. To guard a switch (unsaved edits),
veto it in `onStateChange` with `event.preventDefault()`.

## Events

Three callbacks, in firing order:

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(e, { next, prev })` | **before** a pick applies | ✅ | next / prev value |
| `onChange(e)` | **after** selection applies | — | native `change` event |
| `onValueChange(e, { value })` | **after** selection applies | — | `{ value }` |

Use **`onStateChange`** when you control `value`: it fires on the user's pick before
anything applies, so it's your chance to set the new `value`. Applying it (or the
element self-applying, uncontrolled) then fires **`onChange`** / **`onValueChange`**,
so those suit an uncontrolled strip reacting to its own pick. **`onFocus`** /
**`onBlur`** report focus entering and leaving the strip (wired to `focusin` /
`focusout`, since focus lands on a tab).

```tsx
// Uncontrolled: the strip owns selection, so onValueChange fires on each pick.
<Tabs defaultValue="a" onValueChange={(_e, { value }) => route(value)}>…</Tabs>
```

## Tabs props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | Optional `<TabPanel value="…">` panels, one per tab value. Each is a
 self-managing `<a-tabpanel>` that shows itself when its `value` is the active
 tab. Omit them to use `Tabs` as a bare selectable strip. To place panels in a
 different layout region, or to unmount an inactive panel, drive selection with
 a controlled `value` and render the content yourself (see the docs). |
| `defaultValue?` | string | — | Initial active value for the uncontrolled case. After first render `Tabs`
 owns selection itself. |
| `disabled?` | boolean | — | Disable the whole strip. |
| `fill?` | boolean | false | Makes horizontal tabs share the available inline space equally. |
| `label?` | string | — | Accessible name for the tablist (`aria-label`). |
| `noslide?` | boolean | — | Disable the sliding indicator. By default the selected-tab indicator animates
 between tabs (a single rectangle, via CSS anchor positioning); `noslide` paints it
 per tab so it snaps with no movement. (Browsers without anchor positioning get that
 per-tab paint automatically — `noslide` is the explicit opt-out.) |
| `onBlur?` | (event) => void | — | Focus left the strip entirely — wired to `focusout`. |
| `onChange?` | (event) => void | — | Fired *after* the active tab changes — a native `change` event. |
| `onFocus?` | (event) => void | — | Focus entered the strip (any tab) — wired to `focusin` (focus lands on a tab,
 not the tablist). |
| `onStateChange?` | (event, detail) => void | — | Fired whenever the active tab changes — event-first. `detail` is
 `{ next, prev }` (values; `null` = none). Cancelable: `event.preventDefault()`
 vetoes it (uncontrolled), or in controlled mode answer by updating `value`. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ value }` snapshot as the 2nd argument. |
| `options?` | TabOption[] | — | The tabs, as a data array (the strip's single source). Each entry is a
 `TabOption` (`value`, `label` or `children`, `icon`, `iconTrailing`, `tone`,
 `disabled`, `round`, `className`, `style`). `className` and `style` land on
 that option's individual `<a-tab>`, not on the strip. |
| `orientation?` | 'horizontal' \| 'vertical' | 'horizontal' | Layout + arrow-key axis. Horizontal ellipsizes labels when tabs overflow (scroll
 is opt-in via CSS); vertical stacks them. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'primary' | Visual priority. `primary` is the raised pill on a recessed track (the
 segmented-control look); `secondary` keeps that sizing but drops the track, marking
 the selected tab with a subtle active background fill; `tertiary` is a bottom-underline
 indicator under the selected tab (no track, no rest line). `tone` colors `secondary` +
 `tertiary`; `primary` stays neutral. |
| `round?` | boolean \| number \| string | — | Fully-round the tabs and the sliding indicator (and the primary track
 well). Applies strip-wide; a single tab's `round` rounds just that tab. A
 `number` (px) or CSS length string sets a custom radius on the top-level
 track well only — the tab pills + indicator stay fully round. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size — small 24px · medium 28px · large 32px tall, matching Button's scale (the tab's
 label leading runs a touch tighter, offset by 1px more block padding per side). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Tone applied to the selected indicator/label, or any literal CSS color for a
 one-off custom tone (derived in oklch). Named tones track light/dark. |
| `value?` | string | — | Controlled active value — the tab `value` to mark selected (and, when a
 `<TabPanel value="…">` shares it, the panel to reveal). When set, you own
 selection: the strip renders exactly what this says, and a user pick only
 *requests* a change via `onStateChange` — apply it by updating this prop.
 Leave undefined (and use `defaultValue`) for uncontrolled. |

## Tab option props

## TabPanel props

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Keep the tab strip and panels as siblings under one parent. Panels read the active
value from `<a-tabs>`.

Add `fill` to make horizontal tabs share the available width equally.

```html
<div>
  <a-tabs role="tablist" default-state="account" fill>
    <a-tab role="tab" value="account" tabindex="0"><a-tab-label>Account</a-tab-label></a-tab>
    <a-tab role="tab" value="security" tabindex="-1"><a-tab-label>Security</a-tab-label></a-tab>
  </a-tabs>
  <a-tabpanel role="tabpanel" value="account">Account settings</a-tabpanel>
  <a-tabpanel role="tabpanel" value="security">Security settings</a-tabpanel>
</div>
```

## Styling

Reach for the props first: **`tone`**, **`size`**, **`priority`**. The focus ring is
the global `--focus-ring` (see [Colors](../colors.md#focus-ring)).

For anything else the strip is light-DOM: `<a-tabs>` the tablist, each `<a-tab>` a
tab (its text wrapped in `<a-tab-label>`), `<a-tabpanel>` a panel, and the moving
indicator is `<a-tabs>`'s `::before`. Target them with ordinary CSS (an un-layered rule
beats `@layer anta` without `!important`) and reach for real properties
(`border-radius`, `padding`, `background`, …), **not** the internal `--*` output tokens.
The demo classes (`.square-tabs`, `.glow-tabs`, …) are hooks. Replace them with selectors you own.

**Roomier track.** The strip hugs its tabs by default (0 padding), so it's exactly a
same-size button tall. For a gap around the selected pill (the classic "well" look), add
`padding` and bump `border-radius` by the same amount, so the outer corner stays concentric
with the tabs' 4px. The strip grows 2×the padding taller.

```css
a-tabs.roomy-1 { padding: 1px; border-radius: 5px; }   /* 4 + 1 */
a-tabs.roomy-3 { padding: 3px; border-radius: 7px; }   /* 4 + 3 */
```

**Squarer primary.** Square corners, heavier labels, and a roomier `4px` track with no
border or ring on the strip (`box-shadow: none` drops the default track ring) — just a 1px
square ring on the raised pill. The track is `<a-tabs>`, the sliding pill its `::before`:

```css
a-tabs.square-tabs         { border-radius: 0; padding: 4px; box-shadow: none; }  /* no track border / ring */
.square-tabs a-tab         { border-radius: 0; font-weight: 600; }
a-tabs.square-tabs::before { border-radius: 0; box-shadow: 0 0 0 1px light-dark(#cfcfd6, #46464e); }  /* 1px square pill ring */
```

**Tertiary glowing underline.** Recolor the sliding underline and add a radial highlight
rising from it. The slider is a full-cover box whose `border-bottom` is the line, so a
`background` gradient on it fills the tab behind the label. Because it's one element, the
glow **slides with the line** between tabs, with no `noslide` and no separate per-tab
background.

```css
/* The class is on the <a-tabs> element itself, so target a-tabs.glow-tabs (not a descendant).
   The tertiary slider is a full-cover box with a border-bottom line — recolor the border and
   fill it with a gradient; both slide together. Where CSS anchor positioning isn't supported
   there's no slider — tertiary falls back to the per-tab ::after underline (a plain line). */
a-tabs.glow-tabs::before {
  border-bottom-color: light-dark(#8067ff, #907aff);   /* recolor the sliding line */
  background:                                          /* highlight rising from the line, slides with it */
    radial-gradient(80% 100% at 50% 100%,
      color-mix(in oklch, light-dark(#8067ff, #907aff) 30%, transparent), transparent 70%);
}
```

**Scroll instead of ellipsizing.** Keep full labels and let the strip scroll
horizontally: pin each tab to its content width (`flex: none`) and make the strip
scrollable.

```css
.scroll-tabs a-tabs { overflow-x: auto; scrollbar-width: thin; }
.scroll-tabs a-tab  { flex: none; }
```

**Equal-width tabs.** By default tabs are sized to their labels (and compress only
when the strip overflows). Pass `fill` for a segmented-control look where every tab
shares the strip width:

```tsx
<Tabs
  fill
  defaultValue="all"
  label="Filter"
  options={[
    { value: 'all', label: 'All' },
    { value: 'assigned', label: 'Assigned to me' },
    { value: 'recent', label: 'Recent' },
    { value: 'archived', label: 'Archived' },
  ]}
/>
```

**Wrap labels.** Let long labels wrap so the tabs grow taller instead of truncating:

```css
.wrap-tabs a-tab,
.wrap-tabs a-tab-label { white-space: normal; text-overflow: clip; overflow: visible; text-align: center; }
```

**Disable the slide.** By default the selected-tab indicator slides between tabs (a
single rectangle, via CSS anchor positioning). Pass `noslide` to paint it on each tab
instead, so the highlight snaps with no movement. It's also the automatic fallback
where anchor positioning isn't supported.

```tsx
<Tabs noslide defaultValue="a">…</Tabs>
```

**Fully-rounded pill.** The built-in **`round`** prop rounds the track, every tab, **and**
the sliding pill to `999px` in one flag, no CSS needed (it drives `--tab-radius`, which feeds
the tabs, the moving indicator, and the primary track well):

```tsx
<Tabs round defaultValue="a" label="Sections">…</Tabs>   {/* pill track + tabs + indicator */}
```
