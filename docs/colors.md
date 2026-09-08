# Colors

Anta doesn't offer a global color palette — there are no raw scales like `blue-500` or `gray-900` to pick from. Color ships only as a small set of **role tokens**, grouped by where they apply — background, text, and border — each with a neutral set plus five tones (brand, info, success, critical, warning) that already pair light and dark. You compose from these roles instead of arbitrary swatches; anything app-specific lives in component tokens or your own [semantic aliases](#custom-semantic-tokens).

Values are CSS declarations from the shipped default palette and optional `theme-antune.css` reference palette. Resolve them in the application's theme to obtain displayed colors. Toned backgrounds share the neutral `--bg-1`; there is no `--bg-1-{tone}`.

## Background

Background tokens establish surface hierarchy.

Background numbers describe a lightness scale. Give surfaces meaningful names in your application by defining semantic aliases for these tokens.

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |

## Text

Text tokens establish content priority and contrast.

| Token | Use |
| --- | --- |
| `--text-1` | Primary text, for headings and key content. |
| `--text-2` | Secondary text, for descriptions and supporting content. |
| `--text-3` | Subdued text, for labels, statuses, and secondary data. |
| `--text-4` | Minor text, for timestamps, counters, and metadata. |
| `--text-5` | Placeholder text, for hints and non-critical information. |

### Link color

Links use `--link-color` at rest and `--link-color-hover` on hover. Both tokens pair light and dark values independently of the text scale.

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |

## Border

Border tokens separate and group elements.

Use border tokens according to the surface and the separation it needs:

- `border-1` and `border-2` define strong boundaries, including on `bg-4` and `bg-5`.
- `border-3` provides a visible, moderate boundary.
- `border-4` separates `bg-2` and `bg-3`.
- `border-5` provides subtle separation between `bg-2` and `bg-1`.

### Focus ring

`--focus-ring` supplies the keyboard-focus outline color across components. It pairs light and dark values. Components use this global token directly.

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |

### Link and focus values

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |
| `--link-color` | Uses default | Uses default | Uses default | Uses default |
| `--link-color-hover` | Uses default | Uses default | Uses default | Uses default |
| `--focus-ring` | Uses default | Uses default | Uses default | Uses default |

## Custom semantic tokens

Because the numeric tokens are role-free, the convenient pattern is to alias them to **semantic tokens** that describe how *your* app uses each surface. Define the names once, then reference those instead of the raw numbers. For example:

```css
:root {
  --bg-canvas: var(--bg-1);
  --bg-base:   var(--bg-2);
  --bg-pane:   var(--bg-3);
  --bg-block:  var(--bg-4);
  --bg-spot:   var(--bg-5);

  /* tinted variants work the same way */
  --bg-spot-info: var(--bg-5-info);
}
```

This keeps your components readable (`var(--bg-pane)` says more than `var(--bg-3)`) and lets you re-map a role to a different step later in one place.

A semantic token doesn’t have to point at the same numeric step in both themes. A card sitting on `bg-2` can use the recessed `bg-1` in light, but in dark it often reads better a little *lighter* than the page — so the same `--bg-my-card` maps to `bg-4` instead. The border follows suit: `border-5` in light, `border-4` in dark.

```css
:root {
  background:          var(--bg-2);     /* Anta's token */

  --bg-my-card:        var(--bg-1);     /* Custom token */
  --bg-my-card-border: var(--border-5); /* Custom token */
}
.dark {
  --bg-my-card:        var(--bg-4);
  --bg-my-card-border: var(--border-4);
}

.card {
  background: var(--bg-my-card);
  border: 1px solid var(--bg-my-card-border);
}
```
