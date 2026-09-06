// The demo source lives in a sibling `.ts` file rather than inline
// here because Astro's MDX pipeline trims leading whitespace from
// JSX-attribute template literals, which scrambles the indentation
// Monaco needs for folding ranges. A regular module import preserves
// the template literal's bytes verbatim.

# Progress

`Progress` shows task completion. Pass `value` for known progress. Omit it, or
pass `false`, while work is underway without a known duration.

## Value, label and hint

```tsx
<Progress value={60} />
<Progress value={42} label="Uploading files…" hint="3 of 7" />

// Omit value, or pass false, while the duration is unknown.
<Progress label="Preparing upload…" hint="~ 3 minutes left" />
```

`value` sets known completion relative to `max`, which defaults to `100`.
`label` follows the percentage. `hint` is right-aligned. With no `value`, the
label identifies indeterminate work and the loading animation takes the track.

## Size

```tsx
<Progress size="small" tone="info" value={60} label="Small" hint="~ 3 minutes left" />
<Progress tone="info" value={60} label="Medium" hint="~ 3 minutes left" />
<Progress size="large" tone="info" value={60} label="Large" hint="~ 3 minutes left" />
```

`size` scales the track and the default label row together. `medium` is the
default.

## Tone

```tsx
<Progress value={60} tone="brand" label="Brand" />
<Progress value={60} tone="info" label="Info" />
<Progress value={60} tone="success" label="Success" />
<Progress value={60} tone="warning" label="Warning" />
<Progress value={60} tone="critical" label="Critical" />
<Progress value={60} tone="#e0457b" label="Custom" />
```

`tone` colors the track, indicator, and label row. Use `neutral` for the
default, a named semantic tone, or any CSS color.

## Border

```tsx
<Progress
  value={60}
  tone="warning"
  label="Border on every edge"
  hint="3 of 5"
  style={{ borderWidth: '2px' }}
/>

// A bottom border works when the indicator is at the top of the app.
<Progress
  value={60}
  tone="info"
  label="Top-mounted indicator"
  hint="3 of 5"
  style={{ borderWidth: '0 0 1px' }}
/>

// A top border works when the indicator is at the bottom of the app.
<Progress
  value={60}
  tone="brand"
  label="Bottom-mounted indicator"
  hint="3 of 5"
  style={{ borderTopWidth: '1px' }}
/>
```

The track starts borderless. Set a border width to reveal its tone-aware border
color. A bottom edge works for an indicator at the top of an app. A top edge
works for one at the bottom.

## Round

```tsx
<Progress value={60} round label="Fully round" />
<Progress value={60} round={4} label="4px radius" />
```

`round` makes the track fully round. Pass a number or CSS length for a custom
radius.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hint?` | string | — | Right-aligned hint text (e.g. "3 of 7"). Like `label`, it's not rendered
 when custom `children` are provided but still feeds the accessible name. |
| `label?` | string | — | Text label displayed after the percentage, or on its own for
 indeterminate progress. When you provide custom `children` (which replace
 the default label row), `label` is no longer rendered — but it still
 supplies the progressbar's accessible name. |
| `max?` | number | 100 | Upper bound of the range. |
| `round?` | boolean \| number \| string | — | Fully-round track (`border-radius: 999px`); the fill is clipped to it. Pass a
 `number` (px) or a CSS length string for a custom radius. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. Scales the track and the default label row together. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Color variant, or any literal CSS color for a one-off custom tone (the
 surface / indicator / text are derived from it in oklch). Named tones track
 light/dark automatically. |
| `value?` | number \| false | — | Current progress value. Omit this prop, or pass `false`, to show
indeterminate progress. Negative values are clamped to 0. |

## Web Component

```html
<a-progress style="width: 100%" value="42" max="100" tone="info" role="progressbar"
  aria-valuenow="42" aria-valuemin="0" aria-valuemax="100" aria-label="Upload, 42%">
  <a-progress-label>
    <a-progress-number>42%</a-progress-number>
    <a-progress-text>Upload</a-progress-text>
  </a-progress-label>
</a-progress>

<!-- Omit value for indeterminate progress. -->
<a-progress style="width: 100%" round="50px" role="progressbar" aria-label="Preparing upload">
  <a-progress-label>
    <a-progress-text>Preparing upload</a-progress-text>
  </a-progress-label>
</a-progress>
```

Use this when you are not using the React or Preact wrapper and a native HTML
control does not fit: construct the equivalent Anta web component from the
elements below.

Add the progressbar semantics and label structure when using the element
directly.

### Native HTML progress

```html
<progress
  data-anta
  value="42"
  max="100"
  tone="info"
  aria-label="Uploading, 42%"
  style="width: 100%"
></progress>

<!-- Omit value for native indeterminate progress. -->
<progress data-anta round="50px" aria-label="Preparing upload" style="width: 100%"></progress>
```

For a plain HTML progress indicator, add `data-anta` to `<progress>`. It keeps
the browser's native semantics, including indeterminate progress when `value`
is absent, while using Anta's track, fill, tone, and size treatments. Native
progress does not render Anta's label or hint structure; give it an accessible
name instead.

## Styling

```css
/* a fancy bar: rounded track (all sides), a multi-stop gradient fill with a glow,
   and a crisp hard right edge (the default soft right-edge fade is cleared). */
a-progress.fancy {
  border-radius: 999px;
  background: light-dark(var(--bg-5), #26232c);
}
a-progress.fancy::part(indicator) {
  background: linear-gradient(90deg, #6a5acd, #d44ea3 55%, #ff8a5b);
  box-shadow: 0 0 12px rgba(212, 78, 163, 0.55);   /* glow */
}
a-progress.fancy::part(indicator)::after { background: none; }   /* hard right edge */

/* the percentage / label / hint are light-DOM children — recolor for the bar */
a-progress.fancy a-progress-number,
a-progress.fancy a-progress-text { color: #fff; }
a-progress.fancy a-progress-hint { color: var(--text-2); }
```

For one-offs, the **track** is the host (style `a-progress` directly) and the
**indicator** (fill bar) is a shadow **part** — `::part(indicator)`. The `.fancy`
class is just for the demo.
