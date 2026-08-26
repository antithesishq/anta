# Dialog

A modal dialog: content that opens above a dimmed overlay and holds focus until
it's dismissed. The `Dialog` wrapper renders an `<a-dialog>` whose shadow DOM
wraps a native `<dialog>`, so the top layer (which escapes any `overflow` or
stacking context on the page), the focus trap, focus return on close, the
backdrop, and Esc all come from the platform.

It has three optional zones: a `header`, the body (`children`), and a `footer`,
plus a close button in the top-right corner. Set `position` to make it an edge
drawer instead.

## Zones

`header`, `children` (the body), and `footer` are the three zones. The body
scrolls when it overflows the available height; the header and footer stay
pinned. Each zone is optional: drop `header` for a chromeless sheet, or `footer`
when there are no actions. The footer lays its content out in a right-aligned
row.

```tsx
const [open, setOpen] = useState(false)

<Button onClick={() => setOpen(true)}>Open dialog</Button>
<Dialog
  open={open}
  onStateChange={(_e, { next }) => setOpen(next)}
  header={<Title level={4}>Enable telemetry?</Title>}
  footer={
    <>
      <Button onClick={() => setOpen(false)}>Not now</Button>
      <Button priority="primary" onClick={() => setOpen(false)}>Enable</Button>
    </>
  }
>
  <Text>Anonymous usage data helps us find the bugs that matter.</Text>
</Dialog>
```

## Position

`position` places the dialog. `center` (the default) is a modal centered on the
viewport, keeping a 32px gap from every edge. `left`, `right`, `top`, and
`bottom` turn it into an edge drawer: `left` / `right` run the full viewport
height and slide in from the side; `top` / `bottom` span the full width and slide
down / up. A drawer sits flush against its edge but keeps 32px of overlay on the
far side, so the backdrop stays visible however wide or tall you make it. Drawers
square their corners against the edges they touch. `fullscreen` fills the whole
viewport: no gap, no radius.

```tsx
<Dialog position="left" open={open} onStateChange={…}>…</Dialog>        {/* full-height left drawer */}
<Dialog position="right" open={open} onStateChange={…}>…</Dialog>       {/* full-height right drawer */}
<Dialog position="top" open={open} onStateChange={…}>…</Dialog>         {/* full-width top drawer */}
<Dialog position="bottom" open={open} onStateChange={…}>…</Dialog>      {/* full-width bottom sheet */}
<Dialog position="fullscreen" open={open} onStateChange={…}>…</Dialog> {/* edge-to-edge, no gap */}
```

A drawer's thickness is the axis it slides along: a `left` / `right` drawer's
width (380px by default), a `top` / `bottom` drawer's height (its content). The
cross axis fills the viewport, so the far-side space is `100vw`/`100dvh` minus
that thickness. Resize it with a position-scoped `::part(dialog)` rule (see
[Styling](#styling)).

## Rounding corners

The centered modal is rounded by default (10px) and drawers are square. `round`
overrides that. A **side keyword** rounds only that edge's two corners, which
pairs with a drawer's exposed edge: a bottom sheet takes `round="top"`, a right
drawer `round="left"`.

```tsx
<Dialog round={0}>…</Dialog>                        {/* unrounded centered modal */}
<Dialog position="bottom" round="top">…</Dialog>  {/* round the sheet's top edge */}
<Dialog position="left" round="right">…</Dialog>  {/* round a left drawer's inner edge */}
<Dialog round={24}>…</Dialog>                      {/* all corners, 24px */}
<Dialog round="12px 12px 0 0">…</Dialog>           {/* any border-radius shorthand */}
```

A `number` or CSS string sets the amount on all corners; the string may be a full
`border-radius` shorthand, so `round="12px 12px 0 0"` rounds just the top by 12px
(a side keyword with a custom amount). Bare `round` rounds all corners at the
default 10px, handy to round an otherwise-square drawer. Authoring the raw
`<a-dialog>`, a single length works through the typed `attr()` (`round="20px"`);
shorthands go through the wrapper's `round` prop.

## Close button

`closable` controls one thing: whether the top-right ✕ is present (on by
default). The ✕ is just one way to close the dialog, alongside Esc, a backdrop
click, any `data-dialog-close` / footer action, and your own code. So
`closable={false}` only removes the ✕ (say, when the footer already carries a
Cancel button); the dialog stays closable through those other paths. The ✕
itself is a keyboard-focusable `Button` that requests a close like Esc and the
backdrop do.

```tsx
<Dialog closable={false} header="Rename file" footer={…}>…</Dialog>
```

## Dismiss

"Dismissible" means light-dismiss: a backdrop click or Esc closes the dialog,
both on by default. `persistent` turns only that off. The dialog stays closable
through explicit controls (the ✕ when `closable`, a footer action, your own
code); `persistent` doesn't make it un-closable, it stops an accidental click or
stray Esc from dismissing it. Reach for it on an alert or destructive confirm
that should be answered deliberately.

```tsx
<Dialog
  persistent
  header="Delete account?"
  footer={
    <>
      <Button onClick={cancel}>Cancel</Button>
      <Button priority="primary" tone="critical" onClick={confirm}>Delete</Button>
    </>
  }
>
  <Text>This permanently removes your account and all its data.</Text>
</Dialog>
```

A backdrop click dismisses only when the press **and** the release both land on
the backdrop. Selecting text and releasing outside the dialog won't close it,
and neither will clicking an option in a `Menu` or `Select` whose dropdown
overflows the dialog's box: that click lands on the popover. So a dialog can
hold interactive content that spills past its edges.

## Triggers

Give the dialog a unique `name`, and any element with `data-dialog-open="{name}"`
opens it while `data-dialog-close="{name}"` closes it, with no state or handler.
This helps when the trigger sits far from the dialog in the markup. It's for
hand-authored or vanilla usage; controlled mode (below) ignores `name` and you
drive `open` yourself.

```html
<a-button tabindex="0" data-dialog-open="settings">Settings</a-button>

<a-dialog name="settings">
  <h2 slot="header">Settings</h2>
  <p>…</p>
  <a-button tabindex="0" slot="footer" data-dialog-close="settings">Done</a-button>
</a-dialog>
```

## Controlled vs uncontrolled

Open state follows Anta's shared **state contract**. Leave it *uncontrolled*
(seed with `defaultOpen`, or drive it with the `name` triggers) and the dialog
owns open/close. Pass `open` + `onStateChange` to *control* it: the dialog
follows `open` only, and every user dismiss (Esc, backdrop, close button)
*requests* a change that you apply to accept or ignore to reject. The wrapper
takes booleans and the element takes a `state` string enum; the wrapper maps
between them:

| | `<Dialog>` (JSX) | `<a-dialog>` (element) |
|---|---|---|
| **Uncontrolled** (element owns it) | `defaultOpen` / `name` triggers | `default-state="open" \| "closed"` / `name` |
| **Controlled** (you own it) | `open` + `onStateChange` | `state="open" \| "closed"` + `statechange` |
| **Change event** | `onStateChange(event, { next, prev })`, booleans | `statechange`, a `CustomEvent<{ next, prev }>` of `'open'` / `'closed'` |

`statechange` is **cancelable** and fires *before* the dialog applies the
change. Uncontrolled, call `event.preventDefault()` to veto a dismiss (e.g.
confirm before discarding unsaved edits). Controlled, the element never
self-applies; apply `detail.next` to `open` to accept, or do nothing to reject.

In controlled mode the element keeps the dialog in sync with your `open` value,
even against a native close it didn't route (a `<form method="dialog">` submit,
or calling `close()` on the underlying `<dialog>`). Such a close re-asserts your
state: the dialog reopens if `open` is still true. Drive closing through your
state, setting `open` to `false` in `onStateChange`.

```tsx
// controlled
const [open, setOpen] = useState(false)
<Button onClick={() => setOpen(true)}>Open</Button>
<Dialog open={open} onStateChange={(_e, { next }) => setOpen(next)}>…</Dialog>

// uncontrolled, veto the close while there are unsaved changes
<Dialog defaultOpen onStateChange={(e, { next }) => {
  if (!next && unsaved) e.preventDefault()
}}>…</Dialog>
```

## Focus

On open, focus goes to the **dialog itself** rather than a control inside it. So
the user Tabs to reach the first field, focus never lands on the ✕ or a
destructive button, and it works the same with or without a close button or
focusable content. A screen reader announces the dialog by its `header` text
(mirrored to the dialog's accessible name), and the ✕ is the last tab stop.

To focus a specific control on open instead (a search field, say), pass
`autoFocus`; the dialog focuses it before returning from the opening interaction.
On close, focus returns to whatever opened the dialog, from the native `<dialog>`.

```tsx
<Dialog header="Rename" footer={…}>
  <Input label="Name" autoFocus />
</Dialog>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | The dialog body. Scrolls when it overflows the available height. |
| `closable?` | boolean | true | Whether the top-right ✕ button is present. It's one way to close the dialog,
 alongside Esc, the backdrop, a `data-dialog-close` / footer action, and your
 own code; `false` removes the ✕ without making the dialog unclosable. |
| `defaultOpen?` | boolean | — | Initial open state for the uncontrolled case (read once on mount). |
| `footer?` | ReactNode | — | Footer content, usually the action buttons. Rendered in the bottom zone as
 a right-aligned row (wraps under pressure). Omit for none. |
| `header?` | ReactNode | — | Header content: a title, or any node. Rendered in the top zone. Omit for a
 chromeless dialog with only a body. |
| `name?` | string | — | Uncontrolled trigger name. Any element with `data-dialog-open="{name}"`
 opens this dialog, `data-dialog-close="{name}"` closes it. A convenience for
 triggers rendered elsewhere; ignored in controlled mode. |
| `onStateChange?` | (event, detail) => void | — | Fired before the open state changes, on every user open or dismiss.
 `event` is the cancelable `statechange`: call `event.preventDefault()` to
 veto an *uncontrolled* transition. `detail.next` is the requested open
 state, `detail.prev` the current one (booleans). In controlled mode, apply
 `detail.next` to `open` to accept, or do nothing to reject. |
| `open?` | boolean | — | Controlled open state. When provided, the consumer owns open/close: the
 dialog only follows this prop, and every user dismiss (Esc, backdrop, close
 button) *requests* a change via `onStateChange` (reject by not updating).
 Leave undefined for uncontrolled. |
| `persistent?` | boolean | — | Turn off light-dismiss: a backdrop click and Esc no longer close the dialog.
 It stays closable through explicit controls (the ✕ when `closable`, a footer
 action, your own code); `persistent` isn't "un-closable", it stops an
 accidental click or stray Esc from dismissing. For an alert / confirm that
 should be answered deliberately. Omit for the default dismissible behavior. |
| `position?` | 'center' \| 'left' \| 'right' \| 'top' \| 'bottom' \| 'fullscreen' | 'center' | Placement. `center` (the default) is a centered modal; `left` / `right` /
 `top` / `bottom` turn it into an edge drawer (full height for left/right,
 full width for top/bottom); `fullscreen` fills the whole viewport with no
 edge gap or corner radius. |
| `round?` | boolean \| number \| 'top' \| 'right' \| 'bottom' \| 'left' \| (string & {}) | — | Corner radius. A side keyword — `'top'` / `'right'` / `'bottom'` / `'left'` —
 rounds only that edge's two corners (at `--dialog-radius`), which pairs with
 a drawer's exposed edge (a bottom sheet → `'top'`, a right drawer → `'left'`).
 A `number` (px) or CSS string rounds all corners at that value; the string
 may be a full `border-radius` shorthand (`'12px 12px 0 0'`). `true` rounds all
 corners at `--dialog-radius`. Omit for the position default: `center` is
 rounded, drawers and `fullscreen` are square. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Slots hold the header, footer, and close control. Add `tabindex="0"` to every
raw `<a-button>`.

```html
<a-button role="button" tabindex="0" data-dialog-open="invite"><a-button-label>Invite teammates</a-button-label></a-button>
<a-dialog name="invite">
  <a-title slot="header" level="4" role="heading" aria-level="4">Invite teammates</a-title>
  <a-text>Send an invite link to your team.</a-text>
  <a-button slot="footer" role="button" tabindex="0" data-dialog-close="invite"><a-button-label>Cancel</a-button-label></a-button>
  <a-button slot="footer" role="button" tabindex="0" priority="primary" data-dialog-close="invite"><a-button-label>Send</a-button-label></a-button>
  <a-button slot="close" role="button" tabindex="0" priority="tertiary" size="large"
    aria-label="Close" data-custom-event="closerequest"><a-icon shape="x" aria-hidden="true"></a-icon></a-button>
</a-dialog>
```

Reach for the props first: **`position`** (modal, drawer edge, or fullscreen),
**`closable`** (the ✕), **`persistent`** (light-dismiss off), **`round`** (corner
radius). For everything else, style the shadow **parts** in plain CSS.

`<a-dialog>` exposes `::part(dialog)` (the surface), `::part(header)`,
`::part(body)`, `::part(footer)`, `::part(close)`, and `::part(dialog)::backdrop`
(the overlay). A `::part` rule wins over the element's internal styles with no
`!important`, so the surface, size, radius, shadow, overlay, and zone padding are
all reachable.

**Scope the rule to a position (or a class).** A bare `a-dialog::part(dialog)`
hits every dialog, drawers included, where a `width` override would collapse a
bottom sheet off its full-bleed edge. Target the one you mean: a class for a
specific dialog, `[position="right"]` for a drawer edge, `:not([position])` for
the centered modal (`center` carries no `position` attribute).

```css
/* one dialog, via a class — nothing else is touched */
a-dialog.styled-dialog::part(dialog) {
  width: 640px;
  border-radius: 20px;
  background: var(--bg-2);
}
a-dialog.styled-dialog::part(dialog)::backdrop {
  background: color-mix(in oklch, black 60%, transparent);
}
```

More recipes. The centered modal's max size is the viewport minus a 32px edge
gap; set `max-width` / `max-height` on the surface to change it. A drawer's
thickness is the axis it slides along, so scope it to that edge and the cross
axis stays full-bleed.

```css
/* centered modal: size + the viewport edge gap (max-*) */
a-dialog:not([position])::part(dialog) { width: 720px; max-width: 90vw; max-height: 85dvh; }

/* a drawer's thickness — scoped to its edge */
a-dialog[position="right"]::part(dialog)  { width: 480px; }
a-dialog[position="bottom"]::part(dialog) { height: 60dvh; }

/* zone padding, shadow, overlay (unscoped → every dialog) */
a-dialog::part(header) { padding: 24px 24px 12px; font-size: 20px; }
a-dialog::part(footer) { justify-content: space-between; }
a-dialog::part(dialog) { box-shadow: 0 20px 60px color-mix(in oklch, black 30%, transparent); }
a-dialog::part(dialog)::backdrop { background: color-mix(in oklch, black 50%, transparent); }
```

If you override the surface, shadow, or overlay, add a `.dark` rule to match —
the built-in defaults track light / dark, a fixed override won't.
