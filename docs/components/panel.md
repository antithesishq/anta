# Panel

`Panel` is a container that can maximize to the browser viewport without moving
or remounting its children. It fills its parent's width and height and uses
`overflow: auto` to show scrollbars only when content overflows.

Give the parent a defined height for Panel to fill vertically. With an
auto-height parent, percentage height follows normal CSS sizing and the Panel
can grow with its content. A parent's `min-height` alone does not generally
establish a height for `height: 100%` to fill.

> **Warning:** For now, Panel is a nonvisual utility container only. Supply your
> own appearance and controls. Built-in chrome, resizing, and folding are not
> available yet.

## Usage

### Declarative

Panel manages its own state. Use `data-custom-event="paneltoggle"` on
an Anta button to toggle maximization without a click handler.

```tsx title="Declarative Panel"
import { Box, Button, Input, Panel } from '@antadesign/anta'

function Workspace() {
  return (
    <Panel style={{ background: 'var(--bg-3)' }}>
      <Box
        display="flex"
        gap={16}
        padding={16}
      >
        <Input aria-label="Workspace note" placeholder="Write a note" />
        <Button data-custom-event="paneltoggle">
          Maximize / restore
        </Button>
      </Box>
    </Panel>
  )
}
```

### Controlled

Pass `maximized` to manage state in your application. The button updates it
through `onClick`; `onStateChange` accepts requests from declarative controls
inside the panel.

```tsx title="Controlled Panel"
import { useState } from 'react'
import { Box, Button, Input, Panel } from '@antadesign/anta'

function Workspace() {
  const [maximized, setMaximized] = useState(false)

  return (
    <Panel
      style={{ background: 'var(--bg-3)' }}
      maximized={maximized}
      onStateChange={(_event, { next }) => setMaximized(next)}
    >
      <Box
        display="flex"
        gap={16}
        padding={16}
      >
        <Input aria-label="Workspace note" placeholder="Write a note" />
        <Button onClick={() => setMaximized(value => !value)}>
          {maximized ? 'Restore panel' : 'Maximize panel'}
        </Button>
      </Box>
    </Panel>
  )
}
```

## How does this work?

Maximizing applies `popover="manual"` to the internal content slot and calls
`showPopover()` to fill the viewport. Children keep their DOM ancestry, theme,
and event bubbling. A placeholder preserves the panel's normal layout size.
Restoring calls `hidePopover()` and returns the same content to normal layout.

```html title="Internal content while maximized"
<!-- Managed by Panel inside its shadow root. -->
<slot part="content" popover="manual" tabindex="-1"></slot>
```

While maximized, Panel traps focus inside its content. Tab and Shift+Tab cycle
through its controls. Restoring releases the trap and returns focus to the
previous external control, when available.

Provide a keyboard-accessible **Restore** control: Escape and outside clicks
do not restore the panel. Panel adds no dialog role, background inertness, or
scroll lock. Use [Dialog](./dialog.md) for modal interactions.

Panel fills the browser viewport, without invoking the Fullscreen API.
Browsers without Popover API support keep it in normal layout.

## Component props

For uncontrolled state, omit `maximized` and optionally set `defaultMaximized`.
Call `event.preventDefault()` synchronously in `onStateChange` to cancel an
uncontrolled transition. In controlled mode, reject a request by leaving
`maximized` unchanged.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultMaximized?` | boolean | — | Initial viewport maximization for an uncontrolled panel, read once on connect. |
| `maximized?` | boolean | — | Fill the browser viewport and contain keyboard focus within the panel. When supplied, the application owns the state. |
| `onStateChange?` | (event, detail) => void | — | Requested maximization change. Update `maximized` to accept a controlled request, or prevent the event to veto an uncontrolled request. |

## Web component

Import `@antadesign/anta/elements` to register the elements in this example.
The button toggles the nearest panel without JavaScript handlers.

```html title="Declarative web component"
<a-panel style="background: var(--bg-3)">
  <a-box display="flex" padding="16px" gap="16px" style="--box-padding: 16px; --box-gap: 16px">
    <a-input aria-label="Workspace note" placeholder="Write a note"></a-input>
    <a-button role="button" tabindex="0" data-custom-event="paneltoggle">
      Maximize / restore
    </a-button>
  </a-box>
</a-panel>
```

Use `state="normal"` or `state="maximized"` for controlled state, or `default-state="maximized"`
for an initially maximized, uncontrolled panel.

`requestMaximize()` and `requestRestore()` emit a cancelable, non-bubbling
`statechange` with `{ next, prev }` using those state strings.
Anta buttons can send `panelmaximizerequest`, `panelrestorerequest`, or
`paneltoggle` through `data-custom-event` to the nearest Panel.

## Styling

Panel defaults to `display: block`, `width: 100%`, `height: 100%`,
`box-sizing: border-box`, and `overflow: auto`. Padding and borders stay inside
its assigned size. It does not set `flex-grow`.

Override these through ordinary CSS. Use `height: auto` for content-driven
height or `overflow: scroll` to request scrollbars even when content fits.
Scrollbar appearance follows the browser and operating system's settings.

Set the background on Panel. Its maximized surface inherits that background,
so inner content can keep its natural height. Style light-DOM children, such as
[Box](./box.md) or [Capture](./capture.md), for content layout shared between both states.
Use `:state(maximized)` for viewport styling and `::part(content)` for the
maximized scrolling surface. In normal mode, the content slot uses `display: contents`.
The maximized surface also uses `overflow: auto`; override
`::part(content)` to change its overflow separately from the normal Panel.

Enter a note, then select **Maximize panel** and **Restore panel**. The input
keeps its value. The `panel-demo` classes supply this example's appearance;
replace them with your own selectors.

```html title="A persistent workspace panel"
<a-panel class="panel-demo">
  <a-box class="panel-demo-content">
    <a-box class="panel-demo-toolbar" display="flex">
      <a-text weight="medium">Workspace preview</a-text>
      <a-button role="button" tabindex="0" data-custom-event="paneltoggle">
        <span class="panel-demo-maximize">Maximize panel</span>
        <span class="panel-demo-restore">Restore panel</span>
      </a-button>
    </a-box>
    <a-capture>
      <a-input placeholder="Write a note before maximizing" aria-label="Workspace note"></a-input>
      <a-text>Panel keeps this Box and Capture in their original DOM location.</a-text>
    </a-capture>
  </a-box>
</a-panel>
```

```css title="Preview layout and appearance"
.panel-demo { border: 1px solid var(--border-4); border-radius: 8px; background: var(--bg-3); }
.panel-demo-content { display: flex; flex-direction: column; gap: 20px; padding: 20px; }
.panel-demo-toolbar { justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.panel-demo-content a-capture { display: grid; gap: 16px; }
.panel-demo-content a-input { width: 100%; }
.panel-demo-restore { display: none; }
.panel-demo:state(maximized) .panel-demo-content { padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); }
.panel-demo:state(maximized) .panel-demo-maximize { display: none; }
.panel-demo:state(maximized) .panel-demo-restore { display: inline; }
```
