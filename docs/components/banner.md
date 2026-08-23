# Banner

A full-width message strip for a page- or section-level notice: an announcement, a
status change, a promotion. The `Banner` JSX wrapper renders an `<a-banner>` whose
content is a single centered row — `message`, optional `children`, then `actions` —
with a dismiss ✕ on the right edge. It's **closable** by default.

Its surface reuses `Expander`'s primary vocabulary — a toned box that tracks light
and dark — but laid out as a short horizontal strip sitting edge to edge, about
twice the resting height of `Progress`. It's **borderless by default**; add a rule
under it or an outline around it with `border-bottom-width` / `border-width`, the
same opt-in as `Progress` ([Styling](#styling)).

## Tone

Pick a semantic `tone` to tint the surface and text together — and the ✕ adopts the
same tone (it also sets the border color, used if you opt into a border). The set
matches `Expander` / `Tag`: `neutral` (the default) plus `brand`, `info`, `success`,
`warning`, and `critical`. Color comes from the theme tokens, so every tone tracks
light and dark mode automatically.

```tsx
<Banner tone="neutral" message="Neutral — a plain notice." />   {/* neutral is the default */}
<Banner tone="brand" message="Brand — a product announcement." />
<Banner tone="info" message="Info — a new release is available." />
<Banner tone="success" message="Success — your changes were saved." />
<Banner tone="warning" message="Warning — your trial ends in 3 days." />
<Banner tone="critical" message="Critical — the last deploy failed." />
```

`tone` also accepts **any literal CSS color** for a one-off tint — the hue is kept
while lightness and chroma are pinned to the named-tone curve (and re-tuned for
dark mode), the same mechanism as `Expander` / `Tag`:

```tsx
<Banner tone="#ff1493" message="…" />
<Banner tone="rebeccapurple" message="…" />
```

## Round

`round` rounds the corners for a **standalone** banner that floats inside a
container, rather than the edge-to-edge strip. It stays borderless (add
`border-width` for an outline). Bare `round` clamps to a stadium (half the height);
pass a `number` (px) or a CSS length string for a custom radius.

```tsx
<Banner round tone="info" message="A rounded, standalone banner." />
<Banner round={12} tone="success" message="A custom 12px radius." />
```

## Message and content

`message` is the leading content — a string (rendered at the banner type scale) or
any node. `children` sit between the message and the actions, for a chip, a link,
or a secondary line. Both are centered as one row.

```tsx
<Banner tone="info" message="Deployment complete.">
  <Text size="small" priority="tertiary">· 2 minutes ago</Text>
</Banner>
```

## Actions

Pass `actions` to render trailing controls — buttons, links — as a compact row
after the message and children. Keep them small; the banner is a single line.
Give each action the banner's `tone` so the controls read as part of the strip.

```tsx
<Banner
  tone="brand"
  message="Upgrade to Pro for unlimited runs."
  actions={<Button size="small" priority="secondary" tone="brand" label="Upgrade" />}
/>
```

Stack several actions by priority in one banner: a `primary` call to action, a
`secondary` alternative, and a low-emphasis `tertiary` choice, all sharing the
banner's tone.

```tsx
<Banner
  tone="info"
  message="A new version is ready to install."
  actions={
    <>
      <Button size="small" priority="primary" tone="info" label="Update now" />
      <Button size="small" priority="secondary" tone="info" label="Release notes" />
      <Button size="small" priority="tertiary" tone="info" label="Later" />
    </>
  }
/>
```

## Dismiss

A banner is **closable** by default: a full-height ✕ on the right edge dismisses it.
It rests dimmed and brightens when you hover or focus it (the `Input` `dim-actions`
affordance). On dismiss the bar collapses its height and fades out, clipped to the
box (instant under `prefers-reduced-motion`).

Leave it *uncontrolled* and the banner hides itself when the ✕ is clicked (try it):

```tsx
{/* uncontrolled — the ✕ self-dismisses */}
<Banner tone="success" message="Dismiss me — I'll disappear." />
```

Set `closable={false}` to drop the built-in ✕ — for a permanent banner, or when you
drive dismissal from your own control.

```tsx
<Banner tone="warning" message="A permanent notice — no dismiss button." closable={false} />
```

## Dismiss from an action

Give any control inside the banner **`data-banner-dismiss`** and it dismisses the
banner on click, through the same state contract as the ✕ — for an action that
closes the banner as it runs (an "Undo", a "Got it"). Try it:

```tsx
<Banner
  tone="success"
  message="Draft saved."
  actions={<Button size="small" priority="secondary" tone="success" label="Undo" onClick={undo} data-banner-dismiss />}
/>
```

It's matched by presence on the nearest banner, so it works on any activated
control — `Button`, a plain `<a>`, or a `MenuItem` inside a dropdown — and from the
keyboard, since Enter/Space activation is a real click. Put it on the **terminal**
control, not a dropdown *trigger* (which would dismiss the banner as the menu opens):

```tsx
<Banner
  message="Export ready."
  actions={
    <Menu trigger={<Button size="small" label="Download" iconTrailing="chevron-down" />}>
      <MenuItem label="As CSV" onClick={csv} data-banner-dismiss />
      <MenuItem label="As JSON" onClick={json} data-banner-dismiss />
    </Menu>
  }
/>
```

In controlled mode the click *requests* a dismiss like the ✕ does — drive the
result through `dismissed` (below).

## Controlled vs uncontrolled

Dismissal follows Anta's shared **state contract**. For uncontrolled use, pass
`defaultDismissed`; clicking ✕ then dismisses the banner. For controlled use,
pass `dismissed` and `onDismiss`. The banner follows `dismissed` and reports a
dismissal request when ✕ is clicked. Update `dismissed` to accept the request,
or leave it unchanged to reject it. The wrapper uses booleans, while the element
uses a `state` string (`closed` means dismissed):

| | `<Banner>` (JSX) | `<a-banner>` (element) |
|---|---|---|
| **Uncontrolled** | `defaultDismissed` | `default-state="open" \| "closed"` |
| **Controlled** | `dismissed` + `onDismiss` | `state="open" \| "closed"` + `statechange` |
| **Change signal** | `onDismiss()`, fired on a dismiss request | `statechange`, a cancelable `CustomEvent<{ next, prev }>` of `'open'` / `'closed'` |

Controlling it is how you persist a dismissal (write it to storage) or re-show the
banner later. The element never self-applies in controlled mode: set `dismissed` to
`true` to accept the request, or do nothing to reject.

```tsx
// controlled — persist the dismissal across reloads
const [hidden, setHidden] = useState(() => localStorage.getItem('release-banner') === 'hidden')
<Banner
  tone="info"
  message="A new release is available."
  dismissed={hidden}
  onDismiss={() => {
    setHidden(true)
    localStorage.setItem('release-banner', 'hidden')
  }}
/>
```

At the element level `statechange` is **cancelable** and fires *before* the banner
applies anything, so a vanilla `<a-banner>` listener can `preventDefault()` a
dismiss. The `<Banner>` wrapper's `onDismiss` is notification-only — drive rejection
through `dismissed` instead.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `actions?` | ReactNode | — | Trailing controls (buttons, links) rendered as a compact row after the
 message and `children`. |
| `children?` | ReactNode | — | Free content placed BETWEEN the message and the actions. |
| `closable?` | boolean | true | Whether the trailing ✕ dismiss button is present. `false` removes it — drive
 dismissal yourself (a controlled `dismissed`, or your own control) instead.
 It removes the built-in ✕ without making the banner un-dismissible. |
| `defaultDismissed?` | boolean | — | Initial dismissed state for the uncontrolled case (read once on mount). |
| `dismissed?` | boolean | — | Controlled dismissed state. When provided, the consumer owns visibility: the
 banner follows this prop only, and clicking ✕ *requests* dismissal (reject by
 not updating). **Requires `onDismiss`** — controlled mode never self-hides, so
 without a handler to set `dismissed` the ✕ can't close the banner. Leave
 undefined for uncontrolled. |
| `message?` | ReactNode | — | Leading message — a string (rendered at the banner type scale) or any node.
 Centered in the bar, followed by `children` and then `actions`. |
| `onDismiss?` | () => void | — | Fired when the user dismisses the banner (clicks ✕). Uncontrolled, the banner
 hides itself and this notifies. Controlled, use it to accept the
 request — set `dismissed` to `true` (or ignore to reject); pair it with
 `dismissed`, or the banner can't be closed. |
| `role?` | string | 'status' | ARIA role for the strip host. `'status'` (a polite live region, so the notice
 reaches assistive tech) by default; pass `'alert'` for an urgent notice that
 should interrupt, or a landmark role. |
| `round?` | boolean \| number \| string | — | Rounded corners for a standalone, floating banner (`border-radius: 999px`,
 which clamps to a stadium) instead of the edge-to-edge strip. Still borderless
 by default. Pass a `number` (px) or a CSS length string for a custom radius. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for
 a one-off custom tone. Named tones re-point the surface, text, and border
 color (used if you opt into a border); a custom color keeps its hue while
 lightness/chroma are pinned. `'neutral'` (the default) is the same as omitting it. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Slots hold the message, actions, and close control. A close button dispatches
`dismissrequest` through `data-custom-event`.

```html
<a-banner role="status" tone="info">
  <a-banner-message slot="message">A new version is ready to install.</a-banner-message>
  <a-button slot="actions" role="button" tabindex="0" size="small" priority="primary" tone="info">
    <a-button-label>Update now</a-button-label>
  </a-button>
  <a-button slot="close" role="button" tabindex="0" priority="quaternary" tone="info"
    aria-label="Dismiss" data-custom-event="dismissrequest"><a-icon shape="x" aria-hidden="true"></a-icon></a-button>
</a-banner>
```

Reach for the props first: **`tone`** sets the color (any CSS color for a custom
tone — it derives the surface, text, and border color in oklch), **`round`** the
corners. The one knob worth keeping is **`--banner-tone-source`** — the color a
custom `tone` derives from, so set it to drive the palette from your own variable.
Everything else is plain CSS on the host: `min-height` for a taller bar, a
`border-*-width` for a rule or outline (below).

```tsx
<Banner tone="#e0457b" message="Custom" />
```

**Add a border.** The banner is borderless by default, but its border style and
color are preset at `0` width (the `Progress` reset), so you opt in by setting only
the **width** — `border-bottom-width` for a rule under the strip, `border-width` for
a full outline. The color is already tone-aware (`--banner-border`), so a toned
banner's border matches its tone with no extra work.

```tsx
<Banner tone="info" message="A rule under the strip." style={{ borderBottomWidth: 1 }} />
<Banner round tone="success" message="A full outline on a round banner." style={{ borderWidth: 1 }} />
```

The host `a-banner` **is** the centered bar — its surface, text, border, and layout
are all plain CSS on the host (`@layer anta`, so an un-layered rule of yours wins
without `!important`). For the individual regions, `<a-banner>` exposes
`::part(message)` / `::part(content)` / `::part(actions)` / `::part(close)`.

```tsx
<Banner tone="info" message="A taller bar." style={{ minHeight: 56 }} />
```
