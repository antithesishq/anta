# Steps

Ordered process navigation built on [`Tabs`](./tabs.md). Use `Tabs` when the views
are peers rather than phases in a flow.

## State

Each option needs a unique `value`, a `label`, and a `state`. `state`
supplies the default marker, `value` controls selection, and `disabled`
controls access.

- `incomplete` — empty circle
- `loading` — loader
- `completed` — check
- `error` — critical ×
- `disabled` — incomplete marker by default

```tsx
const options = [
  { value: 'completed', label: 'Completed', state: 'completed' },
  { value: 'loading', label: 'Loading', state: 'loading' },
  { value: 'error', label: 'Error', state: 'error' },
  { value: 'incomplete', label: 'Incomplete', state: 'incomplete' },
]

<Steps fill defaultValue="loading" label="Task state" options={options}>
  <TabPanel value="completed"><Text size="small">This work is complete and ready to use.</Text></TabPanel>
  <TabPanel value="loading"><Text size="small">This work is currently running.</Text></TabPanel>
  <TabPanel value="error"><Text size="small">Resolve this error before continuing.</Text></TabPanel>
  <TabPanel value="incomplete"><Text size="small">This work has not started yet.</Text></TabPanel>
</Steps>
```

An incomplete step can still be selected. Add `disabled` only when it is locked;
disabled steps keep their layout space and use the incomplete marker by default.
Pass `marker` or return a value from `renderMarker` to keep a custom marker. Use
`loading` for work running in the background.

## Priority

`secondary` is the default: selected markers have a subtle fill inside their
outline. `primary` fills the selected marker with its tone and uses a white icon,
like a primary Button. Its 2px resting marker uses `border-3` and its 2px rail
uses `border-3`; a completed, unselected marker keeps the primary fill at 80%
without an outline. Its completed connector moves one step stronger to `border-2`.
`tertiary` removes the marker stroke and makes its marker the icon size plus 2px on
each side.

```tsx
<Steps
  fill
  priority="primary"
  defaultValue="review"
  label="Deployment progress"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'review', label: 'Review', state: 'loading' },
    { value: 'deploy', label: 'Deploy', state: 'incomplete' },
  ]}
/>
```

## Tone

`tone` colors labels, hints, and the selected marker. Labels strengthen on hover
and selection; hints stay at the muted `text-3` tone. In `secondary` and
`tertiary`, the marker icon always matches the label's current color; a secondary
marker's resting stroke uses the matching muted border tone. With
every priority, the connector after a completed step is one border step stronger:
`border-2` from the standard `border-3` rail. Error markers keep a critical
outline and gain a critical fill when selected.

```tsx
const options = [
  { value: 'done', label: 'Done', hint: 'Complete', state: 'completed' },
  { value: 'current', label: 'Current validation in progress', hint: 'Checking security and dependency scans', state: 'loading' },
  { value: 'next', label: 'Next', hint: 'Waiting', state: 'incomplete' },
]

<Steps tone="success" defaultValue="current" options={options} />
```

Labels and hints ellipsize within each step. Hovering or focusing a clipped step
shows its full label and hint in a tooltip.

Options are `neutral` (default), `brand`, `info`, `success`, `warning`, and
`critical`. Omitting `tone`, or passing an empty string, resolves to neutral.

## Markers and hints

Marker precedence is:

1. `renderMarker(...)` result, unless it returns `undefined`
2. `option.marker`
3. Built-in marker from `state`

Return `null` from `renderMarker` for an intentionally empty ring.

A number marker is shown directly; an icon-shape string renders an `Icon`.
`hint` adds secondary text.

```tsx
const options = [
  { value: 'draft', label: 'Draft', hint: 'Saved', state: 'completed', marker: 1 },
  { value: 'approval', label: 'Approval', hint: 'In review', state: 'loading', marker: 'hourglass' },
  { value: 'publish', label: 'Publish', hint: 'Not started', state: 'incomplete', marker: 'send' },
]

<Steps defaultValue="approval" label="Publishing progress" options={options} />
```

Use `renderMarker` when a marker depends on the current step state. Its returned
node wins; return `undefined` to fall back to `marker`, then the state marker.

```tsx
const options = [
  { value: 'draft', label: 'Draft', state: 'completed', marker: 1 },
  { value: 'approval', label: 'Approval', state: 'loading' },
  { value: 'publish', label: 'Publish', state: 'incomplete', marker: 'send' },
]

<Steps
  defaultValue="approval"
  label="Publishing progress"
  options={options}
  renderMarker={(option, { selected }) =>
    option.state === 'loading'
      ? <Icon shape={selected ? 'refresh-ccw-dot' : 'hourglass'} />
      : undefined
  }
/>
```

## Panels

Add a [`TabPanel`](./tabs.md#panels) with the same `value` as its option. Panels stay
mounted while inactive. Omit them when a router renders the content.

## Selection

Use `defaultValue` for uncontrolled selection. Use `value` and `onStateChange`
when the application owns it.

```tsx
const options = [
  { value: 'build', label: 'Build', state: 'completed' },
  { value: 'setup', label: 'Setup', state: 'loading' },
  { value: 'next', label: 'Next steps', state: 'incomplete' },
]
const [phase, setPhase] = useState('setup')

<Steps
  value={phase}
  options={options}
  onStateChange={(_event, { next }) => next && setPhase(next)}
/>
```

The application also owns state changes and decides when to enable future
steps. `Steps` does not advance or complete them automatically.

### Flow actions

Place Back and Continue beside `Steps` so validation and side effects stay in the
application.

```tsx
const options = [
  { value: 'build', label: 'Build', state: 'completed' },
  { value: 'setup', label: 'Setup', state: 'loading' },
  { value: 'next', label: 'Next steps', state: 'incomplete' },
]
const [phase, setPhase] = useState('setup')
const index = options.findIndex((option) => option.value === phase)

<Steps
  value={phase}
  options={options}
  onStateChange={(_event, { next }) => next && setPhase(next)}
/>
<Button label="Back" disabled={index === 0} onClick={() => setPhase(options[index - 1].value)} />
<Button label="Continue" disabled={index === options.length - 1} onClick={() => setPhase(options[index + 1].value)} />
```

## Size

`small`, `medium` (default), and `large` use 24px, 28px, and 32px markers.

```tsx
<Steps
  size="small"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete' },
  ]}
/>
```

## Orientation

Horizontal steps scroll when needed. Vertical steps place the active panel before
the next step.

```tsx
<Steps
  orientation="vertical"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete' },
  ]}
>
  <TabPanel value="build"><Text size="small">Build output is ready.</Text></TabPanel>
  <TabPanel value="setup"><Text size="small">Preparing the environment.</Text></TabPanel>
  <TabPanel value="next"><Text size="small">Review the result.</Text></TabPanel>
</Steps>
```

Pass `label` to name the tablist. Arrow keys follow the orientation; `Home` and
`End` move to the edges; `Enter` and `Space` activate a focused step. Disabled
steps are skipped.

Markers and connectors are decorative. Put important state text in the active
panel or an application-owned live region.

## Events

Events match [`Tabs`](./tabs.md#events).

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(event, { next, prev })` | Before selection | Yes | Next and previous values |
| `onChange(event)` | After selection | No | Native `change` event |
| `onValueChange(event, { value })` | After selection | No | Selected value |

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | StepOption[] | — | Ordered process phases. |
| `priority?` | StepPriority | secondary | Visual emphasis. Primary uses a solid selected marker and a stronger completed connector; secondary is the outlined default; tertiary is compact and borderless. |
| `renderMarker?` | (option, state) => ReactNode | — | Builds a custom marker from a step and its current state. A returned node
replaces `marker` and the built-in state marker; return `undefined` to use
those fallbacks, or `null` for an empty ring. |
| `tone?` | StepTone \| "" | neutral | Tone for Steps. Omit it or pass an empty string for neutral. An error step always uses critical. |

For framework-free use, compose the same light DOM that `Steps` emits.
`a-steps` and its `a-step-*` children are structural elements styled by the
shipped Steps stylesheet. The [Tabs Web Component](./tabs.md#web-component) inside
owns selection and panel behavior; markers and states stay in your markup.

```js
import '@antadesign/anta/elements'
import '@antadesign/anta/components/Steps.css'
```

```html
<div>
  <a-steps>
    <a-tabs role="tablist" aria-label="Setup progress" priority="secondary" default-state="setup" data-steps fill noslide>
      <a-tab role="tab" value="build" tabindex="0">
        <a-step-marker aria-hidden="true"><a-icon shape="check"></a-icon></a-step-marker>
        <a-step-desc><a-tab-label>Build</a-tab-label><a-step-hint>Complete</a-step-hint></a-step-desc>
      </a-tab>
      <a-step-connector></a-step-connector>
      <a-tab role="tab" value="setup" tabindex="-1">
        <a-step-marker aria-hidden="true"><a-loader></a-loader></a-step-marker>
        <a-step-desc><a-tab-label>Setup</a-tab-label><a-step-hint>In progress</a-step-hint></a-step-desc>
      </a-tab>
      <a-step-connector></a-step-connector>
      <a-tab role="tab" value="review" tabindex="-1">
        <a-step-marker aria-hidden="true"><a-icon shape="circle-large"></a-icon></a-step-marker>
        <a-step-desc><a-tab-label>Review</a-tab-label><a-step-hint>Waiting</a-step-hint></a-step-desc>
      </a-tab>
    </a-tabs>
    <a-tabpanel role="tabpanel" value="build">Build output is ready.</a-tabpanel>
    <a-tabpanel role="tabpanel" value="setup">Prepare the environment.</a-tabpanel>
    <a-tabpanel role="tabpanel" value="review">Review the result.</a-tabpanel>
  </a-steps>
</div>
```

Use `priority`, `size`, `orientation`, and `tone` first. Each option also accepts `className`,
`style`, and `data-*` attributes. The marker and connector are light DOM.

**Dotted connector.** For horizontal steps, replace the connector's solid
background with a dotted border:

```css
.dotted-steps a-tab:not(:last-child)::before,
.dotted-steps a-step-connector {
  height: 0;
  background: none;
  border-block-start: 2px dotted var(--border-2-brand);
}
```

`className` on `Steps` applies to `a-steps`. `.dotted-steps` is only the demo
scope; use your own selector when applying the rule.

**Fill the container.** Pass `fill` to spread horizontal steps across their
container. The connectors take the remaining space, placing the middle step in
the middle and the last step at the far edge.

```tsx
<Steps
  fill
  defaultValue="review"
  label="Deployment progress"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'review', label: 'Review', state: 'loading' },
    { value: 'deploy', label: 'Deploy', state: 'incomplete' },
  ]}
/>
```
