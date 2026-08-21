# Steps

Ordered process navigation built on [`Tabs`](./tabs.md). Use `Tabs` when the views
are peers rather than phases in a flow.

## Basic

Each option needs a unique `value`, a `label`, and a `status`.

```tsx
<Steps defaultValue="setup" label="Deployment progress" options={options}>
  <TabPanel value="build"><Text size="small">Build output and artifacts.</Text></TabPanel>
  <TabPanel value="setup"><Text size="small">Configure the environment.</Text></TabPanel>
  <TabPanel value="next"><Text size="small">Review and share the result.</Text></TabPanel>
</Steps>
```

## Status

`status` controls the marker. `value` controls selection. `disabled` controls
access.

- `incomplete` — empty ring
- `loading` — ring
- `completed` — check
- `error` — critical ×

```tsx
const options = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete' },
]
```

An incomplete step can still be selected. Add `disabled` only when it is locked.
Use `loading` for work running in the background.

### Markers and hints

`marker` replaces the status icon. `hint` adds secondary text.

```tsx
const options = [
  { value: 'draft', label: 'Draft', hint: 'Saved', status: 'completed', marker: 1 },
  { value: 'approval', label: 'Approval', hint: 'In review', status: 'loading', marker: <Icon shape="hourglass" /> },
  { value: 'publish', label: 'Publish', hint: 'Not started', status: 'incomplete', marker: 'P' },
]
```

## Tones

`tone` colors labels and the selected marker. Labels move from a muted tone at
rest to the stronger tone on hover and selection. Resting markers and connectors
stay neutral; error markers stay critical.

```tsx
<Steps tone="success" defaultValue="current" options={options} />
```

Options are `neutral`, `brand` (default), `info`, `success`, `warning`, and
`critical`.

## Panels

Add a [`TabPanel`](./tabs.md#panels) with the same `value` as its option. Panels stay
mounted while inactive. Omit them when a router renders the content.

## Selection

Use `defaultValue` for uncontrolled selection. Use `value` and `onStateChange`
when the application owns it.

```tsx
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
<Steps size="small" options={options} />
```

## Orientation

Horizontal steps scroll when needed. Vertical steps place the active panel before
the next step.

```tsx
<Steps orientation="vertical" options={options}>
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
| `tone?` | StepTone | brand | Tone for the selected step. An error step always uses critical. |

Use `size`, `orientation`, and `tone` first. Each option also accepts `className`,
`style`, and `data-*` attributes. The marker and connector are light DOM.

```tsx
<Steps
  options={[
    {
      value: 'approval',
      label: 'Approval',
      status: 'incomplete',
      disabled: true,
      className: 'blocked-step',
    },
  ]}
/>
```

```css
.blocked-step a-step-ring {
  background: var(--bg-4-warning);
  border-style: dashed;
}

.blocked-step::before {
  height: 2px;
  background: var(--border-2-warning);
}
```

`className` and `style` on `Steps` apply to `a-steps`. These properties adjust
density: `--steps-ring-size`, `--steps-ring-border-width`, `--steps-item-gap`, and
`--steps-gap`.

```css
.roomy-steps {
  --steps-ring-size: 30px;
  --steps-item-gap: 8px;
  --steps-gap: 6px;
}
```
