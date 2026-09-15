# Loader

`Loader` is an animated, icon-sized indicator for active work. It rotates while
the duration is unknown. Pass `value` when the current proportion is known.

## Indeterminate and determinate work

```tsx
// No value: the gradient communicates active work.
<Loader label="Loading results" />

// A value fills the circle through the current proportion.
<Loader value={42} label="Uploading files" />
```

Without `value`, the faded gradient rotates. With `value`, the filled section
starts at 12 o’clock, has a sharp edge at the current proportion, and stays
still. The final preview is a slow, docs-only 0–100% cycle. `max` defaults to
`100`.

## Size and speed

```tsx
<Loader size={14} speed={1} label="Slow loading" />
<Loader label="Loading" />                       // 16px, 0.75 seconds
<Loader size={32} label="Loading" />
```

`size` is a pixel value, matching `Icon`. `speed` is seconds per rotation. All
loaders with the same speed share a rotation phase.

## Icon-shape alias

Use `loader` where an Anta component accepts an `IconShape` string. The alias
is indeterminate and follows the surrounding icon size and color.

```tsx
<Button tone="brand" icon="loader" label="Saving" />
<Tag tone="info" icon="loader" label="Syncing" />
<Input
  label="Workspace"
  defaultValue="Anta"
  hint="Checking availability"
  dimActions
  trailing={<Icon shape="loader" aria-hidden="true" />}
/>
```

The alias uses the same conic field as an alpha mask, keeping the icon slot's
own color. It is decorative; the surrounding control or field provides its
label, state, and semantics.

Use `<Loader>` when you need a value, speed, or accessible loading status.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label?` | string | — | Accessible name for a standalone loader. Without a label, the loader is decorative so nearby status text remains the single announcement. |
| `max?` | number | 100 | Upper bound of the range. |
| `size?` | number | 16 | Width and height in pixels. |
| `speed?` | number | 0.75 | Seconds per rotation. Pass a positive number. |
| `tone?` | LoaderTone | — | Color tone for the loader. Omit it to use the standard text-3 color. |
| `value?` | number \| false | — | Current progress value. Omit this prop, or pass `false`, for an indeterminate rotating gradient. |

## Web Component

Use a raw `<a-loader>` when you are not using the JSX wrapper. Set its size,
speed, and determinate percentage with CSS custom properties. `value` selects
the static ring; `--loader-value` is the percentage it shows.

```html
<!-- Indeterminate -->
<a-loader
  role="progressbar"
  aria-label="Loading files"
  style="--loader-size: 24px; --loader-speed: 1s"
></a-loader>

<!-- Determinate -->
<a-loader
  value="42"
  role="progressbar"
  aria-label="Uploading files"
  aria-valuenow="42"
  aria-valuemin="0"
  aria-valuemax="100"
  style="--loader-size: 24px; --loader-value: 42%"
></a-loader>
```

When the value is unknown, omit `value` and give a standalone loader an
accessible name. Mark a loader beside visible status text with `aria-hidden`.

## Styling

The standalone Loader uses the quiet `--text-3` color by default. Set `color`
directly when it needs a deliberate semantic or one-off color; the `loader`
icon alias inherits its parent control’s color.

```css
.loader-demo { color: mediumaquamarine; }
```

The `.loader-demo` class is only for this preview. Use a color on a parent or
your own selector in an application stylesheet.

```css
a-loader.rainbow-loader:not([value]) {
  background: conic-gradient(
    from 0deg,
    color-mix(in oklch, #ff5d8f 8%, transparent),
    #ff5d8f 25%,
    #9b6cf5 50%,
    #55b8e8 75%,
    #45ca9f
  );
}
```

Override `background` to tune an indeterminate gradient field. Keep the
opening stop faint so the rotating hand still has a readable leading edge.

```css
a-loader.ring-loader {
  position: relative;
  color: var(--anta-seed-brand);
}

a-loader.ring-loader::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 100%;
  background: var(--bg-2); /* the known surface behind the Loader */
  pointer-events: none;
}
```

**Known surface.** This paints a `--bg-2` circle over the Loader, matching
this preview’s explicit background and making a visual hole. Use the same
approach only when your Loader sits on a known opaque surface.
