# Tabs

Use Tabs to switch between related views, such as account and security settings.
Pass an `options` array with a unique `value` and a label for each tab. Add
matching `TabPanel` children to display the selected view, or render that
content yourself.

Options also accept icons, custom content, `className`, `style`, and `data-*`
attributes. See [Panels](#panels) for content layout.

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
The track background and border keep the strip's tone when selection changes.
Named tones also color the sliding indicator. For a custom CSS color on an
individual option, pass `noslide` to color its indicator too.

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

In the Antithesis theme, tabs match text buttons' horizontal padding:
10px per side at `small`, 12px at `medium`, and 14px at `large`.

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

Set an option's `tooltip` to reveal its full label when truncated. Tabs whose
labels fit do not show a tooltip. See
[Show only when truncated](./tooltip.md#show-only-when-truncated).

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

Add a `TabPanel` child with a matching `value` for each option. The selected
panel is visible and uses its tab as its accessible label. Panel content can
include forms, charts, or other components.

Panels are optional. To render the selected content yourself, listen to
`onStateChange` or `onValueChange`.

<a id="jsx-vs-dom"></a>

### Panel layout

`Tabs` renders the strip followed by its panels as siblings, without a wrapper.
`className`, `id`, `style`, and extra props apply to the strip. Keep the strip
and its panels under the same parent so they can coordinate selection and
accessible labels.

The resulting structure is:

```html
<a-tabs role="tablist" aria-label="Settings" default-state="account">
  <a-tab role="tab" value="account" tabindex="0"><a-tab-label>Account</a-tab-label></a-tab>
  <a-tab role="tab" value="security" tabindex="-1"><a-tab-label>Security</a-tab-label></a-tab>
</a-tabs>
<a-tabpanel role="tabpanel" value="account">Account settings</a-tabpanel>
<a-tabpanel role="tabpanel" value="security">Security settings</a-tabpanel>
```

A horizontal strip and its panels stack in normal flow. For a vertical strip
beside its panels, wrap `Tabs` in a flex row. To place content in a separate
layout region, control `value` and render that content yourself.

### Hiding an inactive panel

Inactive panels stay mounted, preserving form values and scroll position.
Choose how they hide with `hideMode`:

- `display` (default) removes the inactive panel from layout, keyboard navigation,
  and the accessibility tree.
- `visibility` keeps its layout space while hiding its content.

```tsx
<TabPanel value="activity" hideMode="visibility"><ActivityChart /></TabPanel>
```

To reset a panel's state when leaving it, control selection and render only the
active panel:

```tsx
const [tab, setTab] = useState('summary')

<Tabs
  label="Report"
  value={tab}
  onStateChange={(_event, { next }) => { if (next !== null) setTab(next) }}
  options={[
    { value: 'summary', label: 'Summary' },
    { value: 'activity', label: 'Activity' },
  ]}
>
  {tab === 'summary' && <TabPanel value="summary"><Summary /></TabPanel>}
  {tab === 'activity' && <TabPanel value="activity"><ActivityChart /></TabPanel>}
</Tabs>
```

For expensive panels, track which values have been opened and mount each panel
on its first visit. Keep it mounted afterward to preserve its state.

The same controlled pattern lets you place the strip and selected content in
separate layout regions. Render the content according to the current `value`.

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
  onStateChange={(_event, { next }) => { if (next !== null) setTab(next) }}
  options={[
    { value: 'overview', label: 'Overview' },
    { value: 'activity', label: 'Activity' },
  ]}
/>
```

<a id="keyboard-accessibility"></a>

## Keyboard and accessibility

The selected tab is in the page's tab order. Once focus enters the strip, the
arrow keys move between enabled tabs (wrapping at the ends), `Home` /
`End` jump to the first / last, and `Space` / `Enter` activate the focused tab;
arrow / `Home` / `End` navigation activates as it moves (selection follows focus).
Disabled tabs are skipped and dropped from the tab order.

Pass `label` to name the tablist for screen readers. Each `TabPanel` uses its
corresponding tab as its accessible label. Set `tabIndex={0}` when a text-only
panel should receive keyboard focus. When the panel starts with a focusable
control, Tab reaches that control directly.

## Routing

To use Tabs for routes, control `value` from the current path and navigate in
`onStateChange`. It reports the requested destination before the route changes.
The router renders the content, so omit `TabPanel` children.

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

Use `onStateChange` to accept or cancel a requested selection. Use `onChange` or
`onValueChange` to respond after selection changes. `onFocus` and `onBlur`
report focus entering and leaving the strip.

```tsx
<Tabs
  label="Report"
  defaultValue="summary"
  onValueChange={(_event, { value }) => saveLastView(value)}
  options={[
    { value: 'summary', label: 'Summary' },
    { value: 'activity', label: 'Activity' },
  ]}
/>
```

## Tabs props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | Optional `<TabPanel value="…">` panels, one per tab value. Each is a self-managing `<a-tabpanel>` that shows itself when its `value` is the active tab. Omit them to use `Tabs` as a bare selectable strip. To place panels in a different layout region, or to unmount an inactive panel, drive selection with a controlled `value` and render the content yourself (see the docs). |
| `defaultValue?` | string | — | Initial active value for the uncontrolled case. After first render `Tabs` owns selection itself. |
| `disabled?` | boolean | — | Disable the whole strip. |
| `fill?` | boolean | false | Makes horizontal tabs share the available inline space equally. |
| `label?` | string | — | Accessible name for the tablist (`aria-label`). |
| `noslide?` | boolean | — | Disable the sliding indicator. By default the selected-tab indicator animates between tabs (a single rectangle, via CSS anchor positioning); `noslide` paints it per tab so it snaps with no movement. (Browsers without anchor positioning get that per-tab paint automatically — `noslide` is the explicit opt-out.) |
| `onBlur?` | (event) => void | — | Focus left the strip entirely — wired to `focusout`. |
| `onChange?` | (event) => void | — | Fired *after* the active tab changes — a native `change` event. |
| `onFocus?` | (event) => void | — | Focus entered the strip (any tab) — wired to `focusin` (focus lands on a tab, not the tablist). |
| `onStateChange?` | (event, detail) => void | — | Fired whenever the active tab changes — event-first. `detail` is `{ next, prev }` (values; `null` = none). Cancelable: `event.preventDefault()` vetoes it (uncontrolled), or in controlled mode answer by updating `value`. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ value }` snapshot as the 2nd argument. |
| `options?` | TabOption[] | — | The tabs, as a data array (the strip's single source). Each entry is a `TabOption` (`value`, `label` or `children`, `icon`, `iconTrailing`, `tone`, `disabled`, `round`, `className`, `style`). `className` and `style` land on that option's individual `<a-tab>`, not on the strip. |
| `orientation?` | 'horizontal' \| 'vertical' | 'horizontal' | Layout + arrow-key axis. Horizontal ellipsizes labels when tabs overflow (scroll is opt-in via CSS); vertical stacks them. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'primary' | Visual priority. `primary` is the raised pill on a recessed track (the segmented-control look); `secondary` keeps that sizing but drops the track, marking the selected tab with a subtle active background fill; `tertiary` is a bottom-underline indicator under the selected tab (no track, no rest line). `tone` colors `secondary` + `tertiary`; `primary` stays neutral. |
| `round?` | boolean \| number \| string | — | Fully-round the tabs, the sliding indicator, and the primary track. Applies strip-wide; a single tab's `round` rounds just that tab. A `number` (px) or CSS length string sets that radius on all three. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size — small 24px · medium 28px · large 32px tall, matching Button's scale (the tab's label leading runs a touch tighter, offset by 1px more block padding per side). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Tone applied to the selected indicator/label, or any literal CSS color for a one-off custom tone (derived in oklch). Named tones track light/dark. |
| `value?` | string | — | Controlled active value — the tab `value` to mark selected (and, when a `<TabPanel value="…">` shares it, the panel to reveal). When set, you own selection: the strip renders exactly what this says, and a user pick only *requests* a change via `onStateChange` — apply it by updating this prop. Leave undefined (and use `defaultValue`) for uncontrolled. |

## Tab option props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | string | — | This tab's identity — pairs it with the `<TabPanel value="…">` of the same value, and the value reported by `onStateChange` / `onChange`. Unique per strip. |
| `children?` | ReactNode | — | Tab content when you need more than a string — used if `label` is omitted. |
| `className?` | string | — | CSS class on the option's rendered row. |
| `disabled?` | boolean | — | Prevent user activation of this tab. A disabled tab can still indicate the current selection. |
| `icon?` | IconShape | — | Leading icon shape, rendered before the label. |
| `iconTrailing?` | IconShape | — | Trailing icon shape, rendered after the label. |
| `label?` | ReactNode | — | Visible label. The string shorthand for the tab's content; for richer content pass `children` instead (`label` wins when both are set). |
| `round?` | boolean | — | Fully-round just this tab's box. `<Tabs round>` rounds the whole strip (tabs + sliding indicator) instead. |
| `style?` | CSSProperties | — | Inline styles on the option's rendered row. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | inherits the strip's `tone | Per-tab tone override, same vocabulary as `<Tabs tone>` — colors this one tab's label + icons (all priorities/modes, named or custom color) and, when it's the active tab, its indicator. The track keeps the strip's tone. For a **custom literal color** the sliding indicator can't adopt it (the shared moving element can't read a descendant's color), so a custom tone colors the label everywhere and the indicator only in `noslide`; the six **named** tones color both in every mode. Overrides the strip's `tone` for this tab. |
| `tooltip?` | ReactNode | — | Tooltip for this tab — a string or any node — shown **only when one of the tab's ellipsizing label parts is truncated** (tabs ellipsize when the strip overflows), so clipped content reveals its full text on hover while a tab that fits shows nothing. Rendered as a `truncatedOnly` `<Tooltip>` anchored to the tab. For an always-visible tooltip or other custom trigger content, use `children` with your own `<Tooltip>` instead. |

## TabPanel props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | string | — | Pairs this panel with the tab (`options` entry) of the same `value`. |
| `hideMode?` | 'display' \| 'visibility' | display | How this panel hides while inactive: `display` (default — removed from layout and the a11y tree) or `visibility` (keeps its layout box, to measure it or avoid reflow). Both stay mounted; to *not render* an inactive panel, render it conditionally off a controlled `value` (see the Tabs docs). |

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Use `state` for controlled selection or `default-state` for the initial
uncontrolled selection. The read-only `.value` property returns the applied
selection. Remove `state` to release control and retain that selection.
User picks update internal state without rewriting authored attributes.
Accept a controlled pick through `statechange` by setting `state` to
`event.detail.next`. An empty string is a valid option value.

Keep the tab strip and panels as siblings under one parent. Panels read the active
value from `<a-tabs>`. Give the selected tab `tabindex="0"` and the others
`tabindex="-1"`; `<a-tabs>` moves focus and selection with the arrow keys, while
your change handler updates those attributes for the next visit to the strip. Add
`tabindex="0"` to a text-only panel only when you want the panel itself in the page
Tab sequence.

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

```js title="Keep the raw DOM tab stop on the selected tab"
const tabs = document.querySelector('a-tabs')

tabs.addEventListener('change', () => {
  for (const tab of tabs.querySelectorAll('a-tab')) {
    tab.tabIndex = tab.getAttribute('value') === tabs.value ? 0 : -1
  }
})
```

## Styling

Reach for the props first: **`tone`**, **`size`**, **`priority`**. The focus ring is
the global `--focus-ring` (see [Colors](../colors.md#focus-ring)).

Use ordinary CSS to style the strip (`a-tabs`), tabs (`a-tab`), labels
(`a-tab-label`), and panels (`a-tabpanel`). The strip's `::before` paints the
moving indicator. Unlayered consumer rules override Anta's defaults. Use
properties such as `border-radius`, `padding`, and `background`.
Replace the example classes with your own selectors.

**Roomier track.** The strip hugs its tabs by default (0 padding), so it's exactly a
same-size button tall. For a gap around the selected pill (the classic "well" look), add
`padding` and add the same amount to the tabs' radius, `--tab-radius`, so the outer corner
stays concentric with the tabs in every theme and size. The strip grows 2×the padding taller.

```css
a-tabs.roomy-1 { padding: 1px; border-radius: calc(var(--tab-radius) + 1px); }
a-tabs.roomy-3 { padding: 3px; border-radius: calc(var(--tab-radius) + 3px); }
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

Pass `noslide` to make the selected-tab highlight change without sliding.
The highlight also changes without sliding when the browser lacks CSS anchor
positioning support.

```tsx
<Tabs noslide defaultValue="a">…</Tabs>
```

**Rounded corners.** The built-in **`round`** prop rounds the track, every tab, and the
sliding pill together. `true` makes them full pills; a number (px) or CSS length sets one
custom radius for all three:

```tsx
<Tabs round defaultValue="a" label="Sections">…</Tabs>      {/* pill track + tabs + indicator */}
<Tabs round={8} defaultValue="a" label="Sections">…</Tabs>  {/* 8px on all three */}
```
