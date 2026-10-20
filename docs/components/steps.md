# Steps

Steps shows progress through an ordered process and lets people select a phase.
Use it for setup, publishing, and deployment flows. For views that are peers,
use [Tabs](./tabs.md).

## Basic usage

Give each option a unique `value`, a visible `label`, and a `state`. Incomplete
steps show their position in the sequence, starting at 1. Pass `label` on `Steps`
to give the sequence an accessible name.

This example uses a brand tone, with **Project details** completed and
**Repository** selected. Hints describe each phase's progress. Select another
phase to change the selection; completed work keeps its check.

```tsx
<Steps
  defaultValue="repository"
  tone="brand"
  label="Project setup"
  options={[
    { value: 'project', label: 'Project details', hint: 'payments-service', state: 'completed' },
    { value: 'repository', label: 'Repository', hint: 'Current step', state: 'incomplete' },
    { value: 'review', label: 'Review', hint: 'Not started', state: 'incomplete' },
  ]}
/>
```

## State

Use `state` to describe the work in each phase. The application sets these states:

| State | Default marker |
| --- | --- |
| `incomplete` | Step number |
| `loading` | Loading indicator |
| `completed` | Check |
| `error` | Critical × |

Each completed step colors the connector toward the next step with its tone.
Selecting a phase does not complete it or change the states of preceding phases.

Use `disabled` to prevent selection of a locked phase. Disabled steps keep their
position and show their number unless you provide a custom marker. In this example,
**Loading** is selected and **Disabled** cannot be selected.

```tsx
<Steps
  fill
  defaultValue="loading"
  label="Task state"
  options={[
    { value: 'completed', label: 'Completed', state: 'completed' },
    { value: 'loading', label: 'Loading', state: 'loading' },
    { value: 'error', label: 'Error', state: 'error' },
    { value: 'incomplete', label: 'Incomplete', state: 'incomplete' },
    { value: 'disabled', label: 'Disabled', state: 'incomplete', disabled: true },
  ]}
/>
```

## Selection

Use `defaultValue` to choose the initial phase and let `Steps` manage selection.
When neither `defaultValue` nor `value` is supplied, the first option is selected.

Use `value` with `onStateChange` when the application needs to validate a phase,
update a route, or coordinate other content. Selection and process state remain
separate. `Steps` does not complete work or enable future phases automatically.

Select **Complete setup** to mark setup complete, enable **Next steps**, and select
it. **Reset setup** restores the initial state.

```tsx
import { useState } from 'react'
import { Button, Steps, type StepOption } from '@antadesign/anta'

function Demo() {
  const [value, setValue] = useState('setup')
  const [setupComplete, setSetupComplete] = useState(false)
  const options: StepOption[] = [
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: setupComplete ? 'completed' : 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete', disabled: !setupComplete },
  ]

  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <Steps
        value={value}
        label="Release progress"
        options={options}
        onStateChange={(_event, { next }) => next && setValue(next)}
      />
      <Button
        style={{ marginTop: '16px' }}
        label={setupComplete ? 'Reset setup' : 'Complete setup'}
        priority="secondary"
        onClick={() => {
          setSetupComplete((complete) => !complete)
          setValue(setupComplete ? 'setup' : 'next')
        }}
      />
    </div>
  )
}
```

## Flow actions

Place **Back** and **Continue** beside `Steps` when the flow needs sequential
navigation. Keep validation, saving, and completion in the application.

These buttons change only the selected phase. The connectors keep reflecting the
states in `options`.

```tsx
import { useState } from 'react'
import { Button, Steps, type StepOption } from '@antadesign/anta'

function Demo() {
  const options: StepOption[] = [
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete' },
  ]
  const [value, setValue] = useState('setup')
  const index = options.findIndex((option) => option.value === value)

  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <Steps
        value={value}
        tone="brand"
        label="Deployment progress"
        options={options}
        onStateChange={(_event, { next }) => next && setValue(next)}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <Button
          label="Back"
          priority="tertiary"
          tone="brand"
          disabled={index <= 0}
          onClick={() => setValue(options[index - 1].value)}
        />
        <Button
          label="Continue"
          priority="secondary"
          tone="brand"
          disabled={index >= options.length - 1}
          onClick={() => setValue(options[index + 1].value)}
        />
      </div>
    </div>
  )
}
```

## Panels

Add a [TabPanel](./tabs.md#panels) for each phase's content and match its `value` to
an option. Selecting a phase reveals its panel. Inactive panels stay mounted,
so their local state is preserved.

Omit panels when a router or another part of the application renders the content.
Use controlled selection when you need to place content elsewhere or unmount
inactive content.

```tsx
const panelStyle = {
  minHeight: '72px',
  marginTop: '16px',
  padding: '16px',
  border: '1px solid var(--border-4)',
  borderRadius: '8px',
};

<Steps
  defaultValue="setup"
  label="Deployment progress"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete' },
  ]}
>
  <TabPanel value="build" style={panelStyle}><Text size="small">Build output and artifacts are ready.</Text></TabPanel>
  <TabPanel value="setup" style={panelStyle}><Text size="small">Preparing the deployment environment.</Text></TabPanel>
  <TabPanel value="next" style={panelStyle}><Text size="small">Review the deployment and share the result.</Text></TabPanel>
</Steps>
```

## Orientation

Use the default horizontal layout for a compact progress strip. Labels shorten
when space is limited, and the strip scrolls when needed.

Set `orientation="vertical"` for a stacked sequence. Its active panel appears
between the selected phase and the next phase. Select a different phase to see
the content move with it. Compare all three priorities here; **Build** is completed
with a brand tone in each sequence.

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', alignItems: 'start', gap: '24px', width: '100%' }}>
  {(['primary', 'secondary', 'tertiary'] as const).map((priority) => (
    <div key={priority} style={{ display: 'grid', gap: '12px' }}>
      <Text size="small" tone="neutral">{priority}</Text>
      <Steps
        priority={priority}
        orientation="vertical"
        defaultValue="setup"
        label={`${priority} deployment progress`}
        options={[
          { value: 'build', label: 'Build', state: 'completed', tone: 'brand' },
          { value: 'setup', label: 'Setup', state: 'loading' },
          { value: 'next', label: 'Next steps', state: 'incomplete' },
        ]}
      >
        <TabPanel value="build"><Text size="small">Build output and artifacts are ready.</Text></TabPanel>
        <TabPanel value="setup"><Text size="small">Preparing the deployment environment.</Text></TabPanel>
        <TabPanel value="next"><Text size="small">Review the deployment and share the result.</Text></TabPanel>
      </Steps>
    </div>
  ))}
</div>
```

## Width

The step strip fits its content by default. Pass `fill` to spread horizontal steps across
the container. Connectors use the available space between phases.

Text blocks keep at least `4ch` of width before the strip scrolls. Empty text
blocks have no minimum. Markers keep their size while labels and hints shorten.

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

## Size

Use `small` for compact layouts, the default `medium` for general use, and `large`
when the sequence needs more prominence. Markers and text scale together.

```tsx
<div style={{ display: 'grid', gap: '20px', width: '100%' }}>
  {(['small', 'medium', 'large'] as const).map((size) => (
    <Steps
      key={size}
      size={size}
      defaultValue="setup"
      label={`${size} steps`}
      options={[
        { value: 'build', label: 'Build', state: 'completed' },
        { value: 'setup', label: 'Setup', state: 'loading' },
        { value: 'next', label: 'Next steps', state: 'incomplete', disabled: true },
      ]}
    />
  ))}
</div>
```

## Priority

Use `primary` to emphasize active and completed markers with solid fills.
`secondary` is the default and uses a subtle selected fill. Use `tertiary` for
compact markers without a background or outline, with tighter marker-to-text
spacing shared across themes.

The theme controls marker shape and selection styling. These examples use the
same phases and brand tone at each priority.

```tsx
<div style={{ display: 'grid', gap: '16px', width: '100%' }}>
  {(['primary', 'secondary', 'tertiary'] as const).map((priority) => (
    <div key={priority} style={{ display: 'grid', gap: '6px' }}>
      <Text size="small" tone="neutral">{priority}</Text>
      <Steps
        fill
        priority={priority}
        tone="brand"
        defaultValue="review"
        label={`${priority} deployment progress`}
        options={[
          { value: 'build', label: 'Build', state: 'completed' },
          { value: 'review', label: 'Review', state: 'loading' },
          { value: 'deploy', label: 'Deploy', state: 'incomplete' },
        ]}
      />
    </div>
  ))}
</div>
```

## Tone

Set `tone` on `Steps` to color the markers and completed connectors. Use
`option.tone` when one phase needs a different tone. Error steps stay critical,
and disabled steps stay neutral. The theme controls label colors, fills, and
outlines.

This sequence uses a brand tone, with warning and info overrides. Keep the meaning
in labels and hints so people can understand it without color.

```tsx
<Steps
  fill
  tone="brand"
  defaultValue="current"
  label="Deployment progress"
  options={[
    { value: 'done', label: 'Done', hint: 'Complete', state: 'completed' },
    { value: 'current', label: 'Validate', hint: 'Checking dependencies', state: 'loading' },
    { value: 'review', label: 'Review', hint: 'Needs attention', state: 'incomplete', tone: 'warning' },
    { value: 'deploy', label: 'Deploy', hint: 'Waiting', state: 'incomplete', tone: 'info' },
    { value: 'error', label: 'Error', hint: 'Resolve before continuing', state: 'error' },
  ]}
/>
```

The named tones are `neutral`, `brand`, `info`, `success`, `warning`, and
`critical`. Omitting the Steps tone, or passing an empty string, uses neutral.
Options inherit the Steps tone when their tone is omitted or empty. Set an
option's `tone="neutral"` to override an inherited tone.

## Markers and hints

Numbers are the default for incomplete and disabled phases in every theme.
Use `marker` to replace a phase's number or state indicator with a specific number
or an Anta icon shape. Add `hint` for supporting text such as a saved result or
what remains to do.

Labels and hints shorten when space is limited. Hover or focus a clipped phase to
read its full label and hint in a tooltip.

```tsx
<Steps
  defaultValue="approval"
  label="Custom step markers"
  options={[
    { value: 'draft', label: 'Draft', hint: 'Content saved', state: 'completed', marker: 1 },
    { value: 'approval', label: 'Approval', hint: 'Waiting for review', state: 'loading' },
    { value: 'publish', label: 'Publish', hint: 'Not started', state: 'incomplete', marker: 'send' },
  ]}
/>
```

### State-aware markers

Use `renderMarker` when the marker depends on the phase's state or selection.
Its result takes precedence over `marker`. Return `undefined` to use `marker`
or the built-in number or state indicator. Return `null` to leave the marker empty.

This example replaces the loading indicator with an icon that changes when
**Approval** is selected.

```tsx
<Steps
  defaultValue="approval"
  label="Custom step markers"
  options={[
    { value: 'draft', label: 'Draft', hint: 'Content saved', state: 'completed', marker: 1 },
    { value: 'approval', label: 'Approval', hint: 'Waiting for review', state: 'loading' },
    { value: 'publish', label: 'Publish', hint: 'Not started', state: 'incomplete', marker: 'send' },
  ]}
  renderMarker={(option, { selected }) =>
    option.state === 'loading'
      ? <Icon shape={selected ? 'refresh-ccw-dot' : 'hourglass'} />
      : undefined
  }
/>
```

## Keyboard and accessibility

Pass `label` to name the sequence. Steps uses the [Tabs keyboard
pattern](./tabs.md#keyboard-accessibility): Left and Right move through horizontal
steps, while Up and Down move through vertical steps. Arrow keys wrap at the ends.
`Home` and `End` move to the first and last enabled steps. Selection follows focus;
`Enter` and `Space` also activate the focused step. Disabled steps are skipped.

Markers and connectors are decorative. Include important state information in
labels, hints, or the active panel. Use an application-owned live region when a
background state change needs to be announced.

## Events

Selection events match [Tabs events](./tabs.md#events). They report a change of
selected phase. The application manages process states separately.

| Callback | When | Cancelable | Payload |
| --- | --- | --- | --- |
| `onStateChange(event, { next, prev })` | Before selection is applied | Yes | Next and previous values |
| `onChange(event)` | After selection changes | No | Native `change` event |
| `onValueChange(event, { value })` | After selection changes | No | Selected value |

For uncontrolled selection, call `event.preventDefault()` in `onStateChange` to
reject a request. For controlled selection, update `value` to accept the request.

## Styling

Use `priority`, `tone`, `size`, `orientation`, and `fill` for the supported visual
choices. For further changes, target the light-DOM markers or connector
pseudo-elements. Each option also accepts `className`, `style`, and `data-*`
attributes.

`className` on `Steps` applies to `a-steps`. The `.dotted-steps` class scopes this
example; replace it with your own selector.

For a dotted connector, replace the horizontal connector's solid background
with a border:

```tsx title="Steps markup"
<Steps
  className="dotted-steps"
  defaultValue="setup"
  label="Deployment progress"
  options={[
    { value: 'build', label: 'Build', state: 'completed' },
    { value: 'setup', label: 'Setup', state: 'loading' },
    { value: 'next', label: 'Next steps', state: 'incomplete', disabled: true },
  ]}
/>
```

```css title="Connector CSS"
.dotted-steps a-tab:not(:last-child)::before {
  height: 0;
  background: none;
  border-block-start: 2px dotted var(--border-2-brand);
}
```

## Steps props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | StepOption[] | — | Ordered process phases. |
| `children?` | ReactNode | — | Optional `<TabPanel value="…">` panels, one per tab value. Each is a self-managing `<a-tabpanel>` that shows itself when its `value` is the active tab. Omit them to use `Tabs` as a bare selectable strip. To place panels in a different layout region, or to unmount an inactive panel, drive selection with a controlled `value` and render the content yourself (see the docs). |
| `defaultValue?` | string | — | Initial active value for the uncontrolled case. After first render `Tabs` owns selection itself. |
| `disabled?` | boolean | — | Disable the whole strip. |
| `fill?` | boolean | false | Makes horizontal tabs share the available inline space equally. |
| `label?` | string | — | Accessible name for the tablist (`aria-label`). |
| `onBlur?` | (event) => void | — | Focus left the strip entirely — wired to `focusout`. |
| `onChange?` | (event) => void | — | Fired *after* the active tab changes — a native `change` event. |
| `onFocus?` | (event) => void | — | Focus entered the strip (any tab) — wired to `focusin` (focus lands on a tab, not the tablist). |
| `onStateChange?` | (event, detail) => void | — | Fired whenever the active tab changes — event-first. `detail` is `{ next, prev }` (values; `null` = none). Cancelable: `event.preventDefault()` vetoes it (uncontrolled), or in controlled mode answer by updating `value`. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ value }` snapshot as the 2nd argument. |
| `orientation?` | 'horizontal' \| 'vertical' | 'horizontal' | Layout + arrow-key axis. Horizontal ellipsizes labels when tabs overflow (scroll is opt-in via CSS); vertical stacks them. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'secondary' | Visual emphasis. Primary uses a solid selected marker and a stronger completed connector; secondary is the outlined default; tertiary is compact and borderless. |
| `renderMarker?` | (option, state) => ReactNode | — | Builds a custom marker from a step and its current state. A returned node replaces `marker` and the built-in state marker; return `undefined` to use those fallbacks, or `null` for an empty ring. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size — small 24px · medium 28px · large 32px tall, matching Button's scale (the tab's label leading runs a touch tighter, offset by 1px more block padding per side). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| '' | 'neutral' | Tone applied to every step without its own `tone`. Error steps stay critical and disabled steps stay neutral. |
| `value?` | string | — | Controlled active value — the tab `value` to mark selected (and, when a `<TabPanel value="…">` shares it, the panel to reveal). When set, you own selection: the strip renders exactly what this says, and a user pick only *requests* a change via `onStateChange` — apply it by updating this prop. Leave undefined (and use `defaultValue`) for uncontrolled. |

## Step option props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | ReactNode | — | Visible phase label. It ellipsizes in a constrained step; its full content is available in a tooltip only when clipped. |
| `state` | 'incomplete' \| 'loading' \| 'completed' \| 'error' | — | Application-owned process state. Incomplete phases show their step number; loading, completed, and error phases use state indicators. Selection and availability are separate. |
| `value` | string | — | Stable phase identity. Values must be unique within the sequence. |
| `className?` | string | — | CSS class on the option's rendered row. |
| `disabled?` | boolean | — | Disables this phase. A custom `marker` or `renderMarker` result is kept; otherwise it shows its position in the sequence, starting at 1. |
| `hint?` | ReactNode | — | Secondary text shown below the label. It ellipsizes in a constrained step; its full content is available in a tooltip only when clipped. |
| `marker?` | StepMarker | — | Replaces the default step number or state indicator. A number is shown directly; an Anta icon shape is rendered as an `<Icon>`. |
| `style?` | CSSProperties | — | Inline styles on the option's rendered row. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| '' | inherits Steps `tone | Tone for this phase. It colors the label, hint, marker, and completed connector. Overrides the Steps `tone`; error steps stay critical and disabled steps stay neutral. |

## Web Component

For framework-free use, compose `a-steps` around the [Tabs Web
Component](./tabs.md#web-component). The `a-step-*` tags provide the styled structure;
`a-tabs` owns selection and panel behavior.

Author numbers, icons, process states, and tones in your markup. Automatic number
and state-marker rendering belongs to the JSX `Steps` wrapper. Set
`data-step-state="completed"` to color a step's outgoing connector.

```html
<script type="module">
  import '@antadesign/anta/elements/a-steps'
  import '@antadesign/anta/elements/a-tabs'
  import '@antadesign/anta/elements/a-tab'
  import '@antadesign/anta/elements/a-tabpanel'
  import '@antadesign/anta/elements/a-icon'
  import '@antadesign/anta/elements/a-loader'
</script>

<a-steps>
  <a-tabs role="tablist" aria-label="Setup progress" priority="secondary" default-state="setup" data-steps fill noslide>
    <a-tab role="tab" value="build" tabindex="-1" tone="success" data-step-state="completed">
      <a-step-marker aria-hidden="true"><a-icon shape="check"></a-icon></a-step-marker>
      <a-step-desc><a-tab-label>Build</a-tab-label><a-step-hint>Complete</a-step-hint></a-step-desc>
    </a-tab>
    <a-tab role="tab" value="setup" tabindex="0" tone="brand" data-step-state="loading">
      <a-step-marker aria-hidden="true"><a-loader></a-loader></a-step-marker>
      <a-step-desc><a-tab-label>Setup</a-tab-label><a-step-hint>In progress</a-step-hint></a-step-desc>
    </a-tab>
    <a-tab role="tab" value="review" tabindex="-1" data-step-state="incomplete">
      <a-step-marker aria-hidden="true">3</a-step-marker>
      <a-step-desc><a-tab-label>Review</a-tab-label><a-step-hint>Waiting</a-step-hint></a-step-desc>
    </a-tab>
  </a-tabs>
  <a-tabpanel role="tabpanel" value="build">Build output is ready.</a-tabpanel>
  <a-tabpanel role="tabpanel" value="setup">Prepare the environment.</a-tabpanel>
  <a-tabpanel role="tabpanel" value="review">Review the result.</a-tabpanel>
</a-steps>
```
