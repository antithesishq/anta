# Steps

Ordered process navigation built on [`Tabs`](./tabs.md). Use `Tabs` when the views
are peers rather than phases in a flow.

## Statuses

Each option needs a unique `value`, a `label`, and a `status`. `status`
supplies the default marker, `value` controls selection, and `disabled`
controls access.

- `incomplete` — empty circle
- `loading` — loader
- `completed` — check
- `error` — critical ×
- `disabled` — incomplete marker by default

```tsx
const options = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete' },
]

<Steps defaultValue="loading" label="Task status" options={options}>
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

### Markers and hints

Marker precedence is:

1. `renderMarker(...)` result, unless it returns `undefined`
2. `option.marker`
3. Built-in marker from `status`

Return `null` from `renderMarker` for an intentionally empty ring.

A number marker is shown directly; an icon-shape string renders an `Icon`.
`hint` adds secondary text.

```tsx
const options = [
  { value: 'draft', label: 'Draft', hint: 'Saved', status: 'completed', marker: 1 },
  { value: 'approval', label: 'Approval', hint: 'In review', status: 'loading', marker: 'hourglass' },
  { value: 'publish', label: 'Publish', hint: 'Not started', status: 'incomplete', marker: 'send' },
]

<Steps defaultValue="approval" label="Publishing progress" options={options} />
```

Use `renderMarker` when a marker depends on the current step state. Its returned
node wins; return `undefined` to fall back to `marker`, then the status marker.

```tsx
const options = [
  { value: 'draft', label: 'Draft', status: 'completed', marker: 1 },
  { value: 'approval', label: 'Approval', status: 'loading' },
  { value: 'publish', label: 'Publish', status: 'incomplete', marker: 'send' },
]

<Steps
  defaultValue="approval"
  label="Publishing progress"
  options={options}
  renderMarker={(option, { selected }) =>
    option.status === 'loading'
      ? <Icon shape={selected ? 'refresh-ccw-dot' : 'hourglass'} />
      : undefined
  }
/>
```

## Tones

`tone` colors labels, hints, and the selected marker. Labels strengthen on hover
and selection; hints stay at the muted `text-3` tone. Resting markers and
connectors stay neutral; error markers keep a critical outline and gain a
critical fill when selected.

```tsx
const options = [
  { value: 'done', label: 'Done', hint: 'Complete', status: 'completed' },
  { value: 'current', label: 'Current validation in progress', hint: 'Checking security and dependency scans', status: 'loading' },
  { value: 'next', label: 'Next', hint: 'Waiting', status: 'incomplete' },
]

<Steps tone="success" defaultValue="current" options={options} />
```

Labels and hints ellipsize within each step. Hovering or focusing a clipped step
shows its full label and hint in a tooltip.

Options are `neutral`, `brand` (default), `info`, `success`, `warning`, and
`critical`.

## Panels

Add a [`TabPanel`](./tabs.md#panels) with the same `value` as its option. Panels stay
mounted while inactive. Omit them when a router renders the content.

## Selection

Use `defaultValue` for uncontrolled selection. Use `value` and `onStateChange`
when the application owns it.

```tsx
const options = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'setup', label: 'Setup', status: 'loading' },
  { value: 'next', label: 'Next steps', status: 'incomplete' },
]
const [phase, setPhase] = useState('setup')

<Steps
  value={phase}
  options={options}
  onStateChange={(_event, { next }) => next && setPhase(next)}
/>
```

The application also owns status changes and decides when to enable future
steps. `Steps` does not advance or complete them automatically.

### Flow actions

Place Back and Continue beside `Steps` so validation and side effects stay in the
application.

```tsx
const options = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'setup', label: 'Setup', status: 'loading' },
  { value: 'next', label: 'Next steps', status: 'incomplete' },
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
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'setup', label: 'Setup', status: 'loading' },
    { value: 'next', label: 'Next steps', status: 'incomplete' },
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
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'setup', label: 'Setup', status: 'loading' },
    { value: 'next', label: 'Next steps', status: 'incomplete' },
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

Markers and connectors are decorative. Put important status text in the active
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
| `renderMarker?` | (option, state) => ReactNode | — | Builds a custom marker from a step and its current state. A returned node
replaces `marker` and the built-in status marker; return `undefined` to use
those fallbacks, or `null` for an empty ring. |
| `tone?` | StepTone | brand | Tone for the selected step. An error step always uses critical. |

For framework-free use, compose the same light DOM that `Steps` emits.
`a-steps` and its `a-step-*` children are structural elements styled by the
shipped Steps stylesheet. The [Tabs Web Component](./tabs.md#web-component) inside
owns selection and panel behavior; markers and statuses stay in your markup.

```js
import '@antadesign/anta/elements'
import '@antadesign/anta/components/Steps.css'
```

```html
<div>
  <a-steps>
    <a-tabs role="tablist" aria-label="Setup progress" priority="secondary" tone="brand" default-state="setup" data-steps noslide>
      <a-tab role="tab" value="build" tabindex="0">
        <a-step-marker aria-hidden="true"><a-icon shape="check"></a-icon></a-step-marker>
        <a-step-desc><a-tab-label>Build</a-tab-label><a-step-hint>Complete</a-step-hint></a-step-desc>
      </a-tab>
      <a-tab role="tab" value="setup" tabindex="-1">
        <a-step-marker aria-hidden="true"><a-loader tone="brand"></a-loader></a-step-marker>
        <a-step-desc><a-tab-label>Setup</a-tab-label><a-step-hint>In progress</a-step-hint></a-step-desc>
      </a-tab>
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

Use `size`, `orientation`, and `tone` first. Each option also accepts `className`,
`style`, and `data-*` attributes. The marker and connector are light DOM.

**Dotted connector.** For horizontal steps, replace the connector's solid
background with a dotted border:

```css
.dotted-steps a-tab:not(:last-child)::before {
  height: 0;
  background: none;
  border-block-start: 2px dotted var(--border-2-brand);
}
```

`className` and `style` on `Steps` apply to `a-steps`. These properties adjust
density: `--steps-marker-size`, `--steps-marker-border-width`, `--steps-item-gap`, and
`--steps-gap`.

**Fill the container.** Horizontal `Steps` fill their container by default. The
steps share its width, and the connector fills the remaining space between them.
With three steps, the middle step sits at the center and the last reaches the
far edge.

```tsx
<Steps
  defaultValue="review"
  label="Deployment progress"
  options={[
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'review', label: 'Review', status: 'loading' },
    { value: 'deploy', label: 'Deploy', status: 'incomplete' },
  ]}
/>
```
