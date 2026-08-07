# ProgressTabs

A process stepper for switching between ordered phases. Each option provides a
stable `value`, a visible `label`, and a process `status`. Use [`Tabs`](./tabs.md)
instead when the views are peers and do not represent progress through a sequence.

## Status and availability

Every option requires one of four statuses:

- `incomplete` shows an empty ring.
- `loading` shows a smaller ring inside the status ring.
- `completed` shows a check.
- `error` shows a critical-colored ring and ×.

```tsx
const options = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete', disabled: true },
]
```

Selected phases use brand colors on the label and status ring. An error ring
remains critical when its phase is selected. Ring shape and icons distinguish the
process states without relying on color alone.

`status` does not control selection or availability. Set `disabled` when a phase
must not be activated. For example, a future phase can use `status: 'incomplete'`
and `disabled: true`, while an incomplete phase that is ready for input can remain
enabled.

## Panels

Add a [`TabPanel`](./tabs.md#panels) with the same `value` as each option when
`ProgressTabs` should switch the visible content. Panel content remains mounted
while inactive, following the same behavior as `Tabs`.

```tsx
<ProgressTabs defaultValue="setup" label="Deployment progress" options={options}>
  <TabPanel value="build">Build output and artifacts.</TabPanel>
  <TabPanel value="setup">Configure the deployment environment.</TabPanel>
  <TabPanel value="next">Share the deployment and review results.</TabPanel>
</ProgressTabs>
```

Omit `TabPanel` children when a router or another application controller renders
the phase content.

## Controlled and uncontrolled selection

The selected phase is identified by its option `value`.

**Uncontrolled.** Pass `defaultValue` to choose the initial phase. `ProgressTabs`
then updates the selection after interaction. If you omit both `value` and
`defaultValue`, the first option is selected.

```tsx
<ProgressTabs
  defaultValue="setup"
  options={options}
/>
```

**Controlled.** Pass `value` and update it from `onStateChange`. Leave `value`
unchanged to reject a requested change.

```tsx
const [phase, setPhase] = useState('setup')

<ProgressTabs
  value={phase}
  options={options}
  onStateChange={(_event, { next }) => {
    if (next) setPhase(next)
  }}
/>
```

If the selected phase later becomes disabled, it remains selected and focusable.
This preserves its panel content and gives the application control over when to
move away.

## Sequence phases

The application owns status transitions and decides when future phases become
available. Completing a phase does not automatically change its status, enable the
next option, or move the selection.

```tsx
const [phase, setPhase] = useState('setup')
const [setupComplete, setSetupComplete] = useState(false)

const options = [
  { value: 'build', label: 'Build', status: 'completed' },
  {
    value: 'setup',
    label: 'Setup',
    status: setupComplete ? 'completed' : 'loading',
  },
  {
    value: 'next',
    label: 'Next steps',
    status: 'incomplete',
    disabled: !setupComplete,
  },
]

<ProgressTabs
  value={phase}
  options={options}
  onStateChange={(_event, { next }) => next && setPhase(next)}
/>
```

## Previous and Next

Previous and Next render by default. They select the nearest enabled phase, skip
disabled phases, stop at the ends, and never wrap. Previous uses a tertiary brand
button. Next uses a secondary brand button.

Set `showNavigation={false}` when the surrounding interface owns these actions.
Use `renderPreviousButton` and `renderNextButton` to replace either control. Each
callback receives the computed Anta `Button` props, including its action, disabled
state, size, and horizontal direction icon. Spread those props onto the replacement
control before overriding its presentation:

```tsx
<ProgressTabs
  options={options}
  renderPreviousButton={(props) => (
    <Button {...props} priority="secondary" label="Back" />
  )}
  renderNextButton={(props) => (
    <Button {...props} label="Continue" />
  )}
/>
```

## Size

Three sizes match Anta's control scale: `small`, `medium` (default), and `large`.
The status ring is 24px, 28px, or 32px respectively. Labels, icons, and navigation
buttons scale with it.

```tsx
<ProgressTabs size="small" options={options} />
```

## Orientation and overflow

`horizontal` is the default. The phase strip scrolls horizontally when it does
not fit, and connectors remain on one line. Horizontal Previous and Next controls
include direction icons.

`vertical` stacks the phases and places the selected panel and navigation controls
before the following phase. Vertical navigation controls omit direction icons.

```tsx
<ProgressTabs orientation="vertical" options={options}>
  <TabPanel value="build">Build output and artifacts are ready.</TabPanel>
  <TabPanel value="setup">Preparing the deployment environment.</TabPanel>
  <TabPanel value="next">Review the deployment and share the result.</TabPanel>
</ProgressTabs>
```

## Routing

Control `value` from the current route and navigate from `onStateChange`. Omit the
panels because the router renders the phase content:

```tsx
<ProgressTabs
  value={pathname}
  options={[
    { value: '/deploy/build', label: 'Build', status: buildStatus },
    { value: '/deploy/setup', label: 'Setup', status: setupStatus },
    {
      value: '/deploy/next',
      label: 'Next steps',
      status: nextStatus,
      disabled: !setupComplete,
    },
  ]}
  onStateChange={(_event, { next }) => {
    if (next) navigation.navigate(next)
  }}
/>
```

Deriving `value` from the route keeps the selected phase synchronized with deep
links and browser history. Replace `navigation.navigate` with the router API used
by the application.

Pass `label` to give the tablist an accessible name. Each phase is a tab whose
accessible name comes from its visible label. Matching `TabPanel` children expose
their relationship to the selected tab.

Every enabled phase is in the tab order. `Tab` and `Shift`+`Tab` move through
them. Left and Right move and select in horizontal orientation; Up and Down do
the same vertically. `Home` and `End` select the first and last enabled phases.
`Enter` and `Space` activate a focused phase. Disabled phases are skipped.

The status ring, connectors, and icons are decorative. Selection and disabled
state are exposed by the tab pattern. When a process status must be announced
independently, render equivalent status text in the active panel or an
application-owned live region.

## Events

Events use the same selection contract as [`Tabs`](./tabs.md#events):

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(event, { next, prev })` | Before a selection applies | Yes | Next and previous values |
| `onChange(event)` | After a selection applies | No | Native `change` event |
| `onValueChange(event, { value })` | After a selection applies | No | Selected value |

Use `onStateChange` to update a controlled `value` or call
`event.preventDefault()` to reject an uncontrolled change. Pointer, keyboard,
Previous, and Next activation use the same request.

`onFocus` and `onBlur` report focus entering and leaving the phase strip.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | ProgressTabOption[] | — | Ordered process phases. |
| `renderNextButton?` | (props) => ReactNode | — | Replaces the default Next control. Spread the supplied props onto the
returned button to retain its computed action, disabled state, and size. |
| `renderPreviousButton?` | (props) => ReactNode | — | Replaces the default Previous control. Spread the supplied props onto the
returned button to retain its computed action, disabled state, and size. |
| `showNavigation?` | boolean | true | Renders Previous/Next controls after panels horizontally, or within the
selected step's content flow vertically. |

Use `size` and `orientation` for the built-in layouts. Use the navigation render
callbacks when Previous or Next needs different content or emphasis.

`className` and `style` apply to the `a-progress-tabs` root. Four custom properties
adjust its density: `--progress-tabs-ring-size`,
`--progress-tabs-ring-border-width`, `--progress-tabs-item-gap`, and
`--progress-tabs-gap`.

```tsx
<ProgressTabs className="roomy-progress" options={options} />
```

```css
.roomy-progress {
  --progress-tabs-ring-size: 30px;
  --progress-tabs-item-gap: 8px;
  --progress-tabs-gap: 6px;
}
```
