# Toaster

Show temporary notices in one of six viewport placements. Toast a `Banner`,
`Card`, string, JSX, or an existing DOM node. Toaster handles placement, stacking,
and dismissal timing.

Mount `Toaster` once in your application, then call `Toaster.manager.add()`
when an action needs feedback.

```tsx title="ToasterDemo.tsx"
import { useState } from 'preact/hooks'
import { Toaster, Button, Input, Banner, Card } from '@antadesign/anta'
import { StickerClap } from '@antadesign/stickers'
import styles from './ToasterDemo.module.css'

export default function ToasterDemo() {
  const [duration, setDuration] = useState('4000')

  // Empty / zero / non-numeric → the 5000ms default (0 is not sticky; sticky is Infinity).
  const opts = () => ({ placement: 'bottom-right' as const, duration: Number(duration) || 5000 })

  return (
    <div className={styles.demo}>
      {/* The region — kept mounted for the store to render into. */}
      <Toaster />

      <div className={styles.controls}>
        <Input
          leading="Duration"
          trailing="ms"
          type="number"
          defaultValue="4000"
          onValueChange={(_e, a) => setDuration(a.value)}
        />
      </div>

      <div className={styles.buttons}>
        <Button
          priority="secondary"
          label="Toast text"
          onClick={() => Toaster.manager.add(() => 'Your changes were saved.', opts())}
        />
        <Button
          priority="secondary"
          tone="success"
          label="Toast a Banner"
          onClick={() =>
            Toaster.manager.add(
              (id) => (
                <Banner
                  tone="success"
                  round
                  message="Your changes were saved."
                  onDismiss={() => Toaster.manager.dismiss(id)}
                />
              ),
              opts(),
            )
          }
        />
        <Button
          priority="secondary"
          tone="info"
          label="Toast a Card"
          onClick={() =>
            Toaster.manager.add(
              () => (
                <Card tone="info" size="small" header="Deployment ready">
                  Your build passed all checks.{' '}
                  <Button size="small" priority="tertiary" label="Dismiss" data-toast-dismiss />
                </Card>
              ),
              opts(),
            )
          }
        />
        <Button
          priority="secondary"
          tone="brand"
          label="Toast a Sticker"
          onClick={() => Toaster.manager.add(() => <StickerClap size={96} label="Nice work" />, opts())}
        />
        <Button
          priority="secondary"
          label="Toast with countdown"
          onClick={() => {
            const ms = Number(duration) || 5000
            Toaster.manager.add(
              (id) => (
                <div className={styles.countdownToast}>
                  <Banner
                    tone="info"
                    round
                    message="Auto-dismissing — hover to pause"
                    onDismiss={() => Toaster.manager.dismiss(id)}
                  />
                  {/* Reads the toast's own --toast-remaining — no duration passed. */}
                  <span className={styles.countdownBar} />
                </div>
              ),
              { placement: 'bottom-right', duration: ms },
            )
          }}
        />
      </div>
    </div>
  )
}
```

```css title="ToasterDemo.module.css"
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.countdownToast {
  position: relative;
}

.countdownBar {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 5px;
  height: 3px;
  border-radius: 999px;
  transform-origin: left;
  background: color-mix(in oklch, currentColor 35%, transparent);
  transform: scaleX(var(--toast-remaining));
}

@media (prefers-reduced-motion: reduce) {
  .countdownBar {
    display: none;
  }
}
```

Use the playground to try notification content, placement, and duration.
Edit the Banner and the options passed to `add`.

## Mount the region, drive the store

Mount one `<Toaster>` at a stable spot in your tree and leave it there:

```tsx
import { Toaster } from '@antadesign/anta'

function App() {
  return (
    <>
      <YourApp />
      <Toaster />        {/* keep it mounted — toasts render here */}
    </>
  )
}
```

Add a toast by passing a function that returns its content. Returning a string
creates a dismissible Banner:

```tsx
import { Toaster } from '@antadesign/anta'

Toaster.manager.add(() => 'Saved.', { placement: 'bottom-right' })
```

`add` returns an `id` and passes it to the render function. Use it to update or
dismiss that notification. See [Timing and dismissal](#timing-and-dismissal).

## Toast anything

Return a string or number for a dismissible Banner, or JSX for custom content.
For an existing widget, return its DOM node. Use a stable node that is not owned
by another React or Preact tree.

```tsx
// JSX — rendered as-is
Toaster.manager.add(() => <Card tone="info" size="small" header="Deployment ready">
  Your build passed all checks.
</Card>, { placement: 'top-right' })

// a string — auto-wrapped in a dismissible Banner
Toaster.manager.add(() => 'Copied to clipboard')

// a DOM node (create it once, return the same reference)
const el = document.createElement('div')
el.textContent = '🎉'
Toaster.manager.add(() => el)
```

### Existing DOM nodes

Return a DOM node from the render function rather than placing it directly in
JSX. Toast moves the original node into its content region, preserving listeners
and widget state. It does not clone the node or restore its previous parent when
the toast is removed.

When using the raw `content` property, replacing or clearing it removes only
nodes previously supplied through that property. A fragment's children move into
the toast, leaving the fragment empty. Refill and reassign the fragment to
replace those children. The getter returns the assigned node, or `null` after
clearing. Never supply a node still owned by another renderer.

## Placement

`placement` picks the corner or edge; the default is `bottom-right`. Bottom zones
grow upward (newest nearest the edge), top zones grow downward. Six values:

`top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`.

One Toaster serves all six placements. Choose a placement for each notification.

## Timing and dismissal

Set `duration` in milliseconds to control how long a notification stays visible.
The default is 5000ms. The timer pauses while the toast is hovered or contains
focus. Pass `Infinity` to keep it until dismissed. Empty, zero, and non-positive
values use the default. Dismissing a toast plays its exit animation, then removes it.

```tsx
Toaster.manager.add(() => 'Still here until you close it', { duration: Infinity })   // sticky
```

Provide a dismissal action when a notification should be closable before its
timer ends:

- A string becomes a Banner with its own close button.
- Add `data-toast-dismiss` to a button, link, or menu item inside custom content
  to dismiss its toast without a separate handler:

  ```tsx
  Toaster.manager.add(() => (
    <Card header="Update ready">
      A new version is available. <Button data-toast-dismiss label="Later" />
    </Card>
  ))
  ```

- For a Banner you render yourself, connect `onDismiss` to `dismiss(id)`.
  Its close button and any `data-banner-dismiss` actions then close the toast:

  ```tsx
  Toaster.manager.add((id) => (
    <Banner tone="success" round message="Saved" onDismiss={() => Toaster.manager.dismiss(id)} />
  ))
  ```

Or drive dismissal from anywhere with the returned id:

```tsx
const id = Toaster.manager.add(() => 'Saving…', { duration: Infinity })
Toaster.manager.dismiss(id)                     // animate out, then remove
Toaster.manager.update(id, () => 'Saved')       // swap content in place
Toaster.manager.clear()                         // dismiss all
```

Pass the same `id` to update an existing notification and restart its timer.
Use this for task progress or repeated events that should share one notice:

```tsx
Toaster.manager.add(() => <Banner message="Saving…" />, { id: 'save' })
// …later…
Toaster.manager.add(() => <Banner tone="success" message="Saved" />, { id: 'save' })  // in place
```

## Show the time left

Read `--toast-remaining` to draw a countdown. It decreases from `1` to `0` and
pauses while the toast is hovered or contains focus. Use the same value for the
bar so it follows the notification's timer.

Try **Toast with countdown** and hover the notification to pause it.

```tsx
Toaster.manager.add(
  (id) => (
    <div className="countdown-toast">
      <Banner tone="info" round message="Auto-dismissing…" onDismiss={() => Toaster.manager.dismiss(id)} />
      <span className="countdown-bar" />
    </div>
  ),
  { duration: 6000 },
)
```

```css
.countdown-toast { position: relative; }
.countdown-bar {
  position: absolute; inset-inline: 10px; bottom: 5px; height: 3px;
  border-radius: 999px; transform-origin: left;
  background: color-mix(in oklch, currentColor 35%, transparent);
  transform: scaleX(var(--toast-remaining));   /* 1 → 0 over the toast's life */
}
```

The countdown is visual feedback. Dismissal still follows `duration` if the
browser cannot animate the custom property. With `duration: Infinity`, the
value stays at `1`.

Hide a custom countdown bar for people who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .countdown-bar { display: none; }
}
```

Toast already suppresses its entrance and exit fades for reduced motion.
The timer continues, so notifications still dismiss on schedule.

## Multiple regions

`Toaster.manager` is the default store. For an isolated region, create your own and
bind it to a `<Toaster>` with `toaster`:

```tsx
import { createToaster, Toaster } from '@antadesign/anta'

export const alerts = createToaster()

// mount its region:
<Toaster toaster={alerts} />

// drive it:
alerts.add(() => <Banner tone="critical" message="Connection lost" />, { placement: 'top-center' })
```

Use one Toaster per store.

### Server rendering and shared stores

Keep toast stores empty during server rendering to avoid hydration mismatches.
Follow [Browser hydration](../install-config.md#browser-hydration) before mounting.

Use the same JSX entry for a region and its default `Toaster.manager`.
Independent full and granular builds have separate default stores. To coordinate
across those entries, pass the same `createToaster()` store explicitly.

## Announcements

Use `politeness: 'polite'` for a routine screen reader announcement, or
`'assertive'` for an urgent notice that should interrupt. Omit it when the
content already supplies its announcement. Banner defaults to `role="status"`.
When Toaster supplies the announcement, set the Banner's role to `none` to
avoid nested live regions.

```tsx
Toaster.manager.add(() => <Banner role="none" tone="critical" message="Connection lost" />, {
  politeness: 'assertive',
})
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label?` | string | 'Notifications' | Accessible label for the region landmark. |
| `toaster?` | Toaster | — | The store this region renders. Omit to bind the default store driven by `Toaster.manager`; pass a `createToaster()` for an isolated region. |

## Web Component

Use `<a-toaster>` and `<a-toast>` directly outside JSX. Place each toast in a
slot named for its placement, such as `bottom-center`. Add a dismissal control
with `data-toast-dismiss`, then listen for `dismiss` and remove that toast.

This example adds a notification by cloning a template:

```html
<div data-anta-composition="toaster">
  <a-button data-toast-add role="button" tabindex="0"><a-button-label>Show update</a-button-label></a-button>
  <a-toaster role="region" aria-label="Notifications">
  </a-toaster>
  <template data-toast-template>
    <a-toast slot="bottom-center" aria-live="polite">
      <a-banner tone="info" round>
        <a-banner-message>A new version is available.</a-banner-message>
        <a-banner-actions><a-button role="button" tabindex="0" data-toast-dismiss><a-button-label>Dismiss</a-button-label></a-button></a-banner-actions>
      </a-banner>
    </a-toast>
  </template>
</div>
<script type="module">
  import '@antadesign/anta/elements'

  const root = document.querySelector('[data-anta-composition="toaster"]')
  const trigger = root.querySelector('[data-toast-add]')
  const template = root.querySelector('template[data-toast-template]')
  const toaster = root.querySelector('a-toaster')

  trigger.addEventListener('click', () => toaster.append(template.content.cloneNode(true)))
  // A dismissed toast finishes its exit animation, but stays in the DOM until its owner removes it.
  root.addEventListener('dismiss', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('a-toast')) event.target.remove()
  })
</script>
```

### Raw toast timing

`duration="Infinity"` keeps a toast until dismissed. Missing, empty, zero,
negative, and invalid durations use 5000ms. Hover and focus each pause the timer.

Change `rev` or call `restart()` to restart the countdown. Changing `duration`
alone applies on the next restart. Reconnecting starts a fresh duration or
resumes a pending exit. The `dismiss` event fires after the exit animation.
The application then removes the element.

## Styling

The region and item are plain custom elements — style them with ordinary CSS
(defaults use `@layer anta.components`, so an unlayered rule wins without `!important`).

Region spacing lives on `a-toaster` as tokens: **`--toaster-inset`** (gap from the
viewport edge), **`--toaster-gap`** (space between stacked toasts), and
**`--toaster-width`** (column width). The item's enter/exit timing lives on
`a-toast`: **`--toast-dur`**. The item also publishes **`--toast-remaining`** (a
number, `1` → `0`, tracking the auto-dismiss timer) for content to read — see
[Show the time left](#show-the-time-left). The item is style-neutral — no chrome of
its own — so a toast looks like exactly the content you pass.

`<a-toast>` is the content box itself, so add elevation (or any style) with the
plain `a-toast` selector:

```css
a-toaster { --toaster-width: 420px; --toaster-gap: 10px; }
a-toast { filter: drop-shadow(0 6px 20px color-mix(in oklch, black 22%, transparent)); }
```

The content keeps its own styling. A toned `Banner` brings its surface; a `Card`
brings its border. `a-toaster::part(region)` reaches the popover surface.
`::part(zone)` reaches all six columns, and `::part(top-left)` through
`::part(bottom-right)` reaches one placement. `a-toast::part(content)` reaches
the content slot. Keep columns and the region click-through when customizing
their appearance. Countdown timing belongs to `duration` and `restart()`.

## Example

```tsx
import { Toaster, Button, Banner } from '@antadesign/anta'

<Toaster />
<Button
  label="Toast it"
  onClick={() =>
    Toaster.manager.add(
      (id) => (
        <Banner
          tone="success"
          round
          message="Your changes were saved."
          onDismiss={() => Toaster.manager.dismiss(id)}
        />
      ),
      { placement: 'bottom-right', duration: 4000 },
    )
  }
/>
```
