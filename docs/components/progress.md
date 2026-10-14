// Keep the playground source in a module so MDX preserves its indentation.

# Progress

Use Progress for uploads, downloads, and other tasks that take time. Show a
percentage when you know the total, or a loading animation while completion is
unknown. Add a label and hint to explain what is happening.

## Value, label, and hint

```tsx
<Progress value={60} />
<Progress value={3} max={7} label="Uploading files…" hint="3 of 7" />

// Omit value while the total is unknown.
<Progress label="Preparing upload…" hint="~ 3 minutes left" />
```

Pass `value` to show completion. For a percentage, use the default `max` of
`100`. For a count, pass the total as `max`; the example shows 3 of 7 files.

Use `label` to name the task and `hint` for details such as completed items or an
estimated time. While the total is unknown, omit `value` or pass `false` to show
loading stripes without a percentage.

## Size

```tsx
<Progress size="small" tone="info" value={60} label="Small" hint="~ 3 minutes left" />
<Progress tone="info" value={60} label="Medium" hint="~ 3 minutes left" />
<Progress size="large" tone="info" value={60} label="Large" hint="~ 3 minutes left" />
```

Use `small` for compact task lists and `large` for more prominent feedback.
The track, percentage, label, and hint scale together.

## Tone

```tsx
<Progress value={60} tone="brand" label="Brand" />
<Progress value={60} tone="info" label="Info" />
<Progress value={60} tone="success" label="Success" />
<Progress value={60} tone="warning" label="Warning" />
<Progress value={60} tone="critical" label="Critical" />
<Progress value={60} tone="#e0457b" label="Custom" />
```

Use `brand` for the primary task or a semantic tone to match its status. Keep
the task's meaning in its label or hint so readers can understand it without
color. Pass a CSS color for a custom tone.

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

Add a border to separate progress from the surrounding content. A bottom
border suits a bar along the top of an app; a top border suits one along the
bottom. The border color follows the tone.

## Round

```tsx
<Progress value={60} round label="Fully round" />
<Progress value={60} round={4} label="4px radius" />
```

Use `round` for a pill-shaped track. Pass a number in pixels or a CSS length
to match the corners of nearby content.

## Custom content

Use `children` when task details need more than a plain label and hint. Pass
`label` and `hint` to keep an accessible description of the task.

```tsx
<Progress value={3} max={5} label="Sending report.csv" hint="3 of 5">
  <Text>Sending <strong>report.csv</strong> · 3 of 5</Text>
</Progress>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hint?` | string | — | Details shown at the end of the row, such as "3 of 7" or a time estimate. Included in the accessible name even when custom `children` replace the row. |
| `label?` | string | — | Task name shown after the percentage, or on its own during loading. Custom `children` replace the label row; this prop still supplies the progressbar's accessible name. |
| `max?` | number | 100 | Total amount to complete. Use a positive number to show a count, such as 3 of 7 files. When `value` is supplied, a non-positive or non-finite total shows an empty fill. |
| `round?` | boolean \| number \| string | — | Pill-shaped track. Pass a number in pixels or a CSS length for a custom corner radius. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. Scales the track and the default label row together. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Color for the track, fill, and label row. Pass a named tone or a CSS color. Named tones follow the current theme. |
| `value?` | number \| false | — | Completed amount relative to `max`. Omit this prop or pass `false` to show a loading animation without a percentage. Values are clamped to the range; non-finite values show zero completion. |

<a id="raw-html"></a>

## Web Component

```html
<a-progress value="42" max="100" tone="info" role="progressbar"
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

Use `<a-progress>` directly when you need its label layout in plain HTML.
`a-progress-number`, `a-progress-text`, and `a-progress-hint` form the default
row; you can also supply your own content.

Load `@antadesign/anta/elements/a-progress` or the full bundle. Add `role` and
ARIA values on the host, and keep them in sync with `value`, `max`, and visible
text. Omit `value` for loading stripes.

The JSX wrapper supplies the markup, numeric CSS variables, and ARIA from props.
Raw `value` and `max` rendering requires numeric CSS `attr()`, which is not
available in every browser that meets Anta's minimum requirements. Numeric
`--progress-value` and `--progress-max` variables override the corresponding
attributes. JSX supplies and updates them automatically across supported browsers.

Server-rendered JSX values use inline style attributes. A CSP with
`style-src-attr 'none'` blocks these variables; attribute rendering then requires
numeric CSS `attr()` support. Native `<progress data-anta>` uses browser-owned
values without inline CSS variables across supported browsers. See
[Content Security Policy](/install-config/#content-security-policy).

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

Use `<progress data-anta>` for a native progress bar with Anta's appearance.
The browser handles completion and accessibility from `value` and `max`. Omit
`value` for unknown completion, and give the control an accessible name.

Native progress supports tone, size, and rounding. It has no built-in label row.
The same Progress entry and full bundle style both forms.

## Styling

```css
/* Rounded track and gradient fill with a glow. */
a-progress.fancy {
  border-radius: 999px;
  background: light-dark(var(--bg-5), #26232c);
}
a-progress.fancy::before {
  background: linear-gradient(
    90deg,
    light-dark(#6a5acd, #8b7cf0),
    light-dark(#d44ea3, #ec64bc) 55%,
    light-dark(#ff8a5b, #ffa477)
  );
  box-shadow: 0 0 12px color-mix(in oklch, #d44ea3 55%, transparent);
}

/* Keep the label readable against the custom fill. */
a-progress.fancy a-progress-number,
a-progress.fancy a-progress-text { color: #fff; }
a-progress.fancy a-progress-hint { color: var(--text-2); }
```

Use `tone`, `size`, and `round` for the component's appearance. For further
customization, style `a-progress` for the track and `a-progress::before` for the
fill or loading stripes. Target the label tags or your own children for text
styling. `.fancy` belongs to this example.
