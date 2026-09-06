# Colors

Anta doesn't offer a global color palette — there are no raw scales like `blue-500` or `gray-900` to pick from. Color ships only as a small set of **role tokens**, grouped by where they apply — background, text, and border — each with a neutral set plus five tones (brand, info, success, critical, warning) that already pair light and dark. You compose from these roles instead of arbitrary swatches; anything app-specific lives in component tokens or your own [semantic aliases](#custom-semantic-tokens).

Values are CSS declarations from the shipped default palette and optional `theme-anta.css` reference palette. Resolve them in the application's theme to obtain displayed colors. Toned backgrounds share the neutral `--bg-1`; there is no `--bg-1-{tone}`.

## Background

Background tokens establish surface hierarchy.

Background numbers describe a lightness scale. Give surfaces meaningful names in your application by defining semantic aliases for these tokens.

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |
| `--bg-1` | `oklch(from var(--anta-seed-neutral) 1 0 h)` | `oklch(from var(--anta-seed-neutral) 0 0 h)` | `#ffffff` | `#000000` |
| `--bg-2` | `oklch(from var(--anta-seed-neutral) 0.985 0.002 h)` | `oklch(from var(--anta-seed-neutral) 0.16 0.002 h)` | `#fbfafb` | `#0e0d0f` |
| `--bg-3` | `oklch(from var(--anta-seed-neutral) 0.97 0.004 h)` | `oklch(from var(--anta-seed-neutral) 0.177 0.005 h)` | `#f6f4f6` | `#121014` |
| `--bg-4` | `oklch(from var(--anta-seed-neutral) 0.954 0.004 h)` | `oklch(from var(--anta-seed-neutral) 0.191 0.006 h)` | `#f1eff1` | `#161316` |
| `--bg-5` | `oklch(from var(--anta-seed-neutral) 0.935 0.006 h)` | `oklch(from var(--anta-seed-neutral) 0.2 0.009 h)` | `#ece9ec` | `#1a171b` |
| `--bg-2-brand` | `oklch(from var(--anta-seed-brand) 0.99 0.004 h)` | `oklch(from var(--anta-seed-brand) 0.13 0.02 h)` | `#fcfcfe` | `#08060e` |
| `--bg-3-brand` | `oklch(from var(--anta-seed-brand) 0.972 0.011 h)` | `oklch(from var(--anta-seed-brand) 0.17 0.035 h)` | `#f7f6fd` | `#0f0c1d` |
| `--bg-4-brand` | `oklch(from var(--anta-seed-brand) 0.955 0.02 h)` | `oklch(from var(--anta-seed-brand) 0.185 0.05 h)` | `#efeefc` | `#130f24` |
| `--bg-5-brand` | `oklch(from var(--anta-seed-brand) 0.935 0.03 h)` | `oklch(from var(--anta-seed-brand) 0.205 0.055 h)` | `#e9e5fa` | `#16132b` |
| `--bg-2-info` | `oklch(from var(--anta-seed-info) 0.99 0.004 h)` | `oklch(from var(--anta-seed-info) 0.13 0.02 h)` | `#fbfcfe` | `#020a12` |
| `--bg-3-info` | `oklch(from var(--anta-seed-info) 0.972 0.011 h)` | `oklch(from var(--anta-seed-info) 0.17 0.035 h)` | `#f2f7fd` | `#05131f` |
| `--bg-4-info` | `oklch(from var(--anta-seed-info) 0.955 0.02 h)` | `oklch(from var(--anta-seed-info) 0.185 0.05 h)` | `#e9f3fb` | `#071725` |
| `--bg-5-info` | `oklch(from var(--anta-seed-info) 0.935 0.03 h)` | `oklch(from var(--anta-seed-info) 0.205 0.055 h)` | `#e1eefa` | `#0c2337` |
| `--bg-2-success` | `oklch(from var(--anta-seed-success) 0.99 0.004 h)` | `oklch(from var(--anta-seed-success) 0.13 0.02 h)` | `#f7fcf9` | `#030b06` |
| `--bg-3-success` | `oklch(from var(--anta-seed-success) 0.972 0.011 h)` | `oklch(from var(--anta-seed-success) 0.17 0.035 h)` | `#ecf9f0` | `#051209` |
| `--bg-4-success` | `oklch(from var(--anta-seed-success) 0.955 0.02 h)` | `oklch(from var(--anta-seed-success) 0.185 0.05 h)` | `#e2f5e8` | `#06160b` |
| `--bg-5-success` | `oklch(from var(--anta-seed-success) 0.935 0.03 h)` | `oklch(from var(--anta-seed-success) 0.205 0.055 h)` | `#d9f2e0` | `#081b0e` |
| `--bg-2-warning` | `oklch(from var(--anta-seed-warning) 0.99 0.004 h)` | `oklch(from var(--anta-seed-warning) 0.13 0.02 h)` | `#fefbf6` | `#110a03` |
| `--bg-3-warning` | `oklch(from var(--anta-seed-warning) 0.972 0.011 h)` | `oklch(from var(--anta-seed-warning) 0.17 0.035 h)` | `#fcf4e8` | `#1c1105` |
| `--bg-4-warning` | `oklch(from var(--anta-seed-warning) 0.955 0.02 h)` | `oklch(from var(--anta-seed-warning) 0.185 0.05 h)` | `#fbeeda` | `#231406` |
| `--bg-5-warning` | `oklch(from var(--anta-seed-warning) 0.935 0.03 h)` | `oklch(from var(--anta-seed-warning) 0.205 0.055 h)` | `#f9e7cd` | `#2b1a08` |
| `--bg-2-critical` | `oklch(from var(--anta-seed-critical) 0.99 0.004 h)` | `oklch(from var(--anta-seed-critical) 0.13 0.02 h)` | `#fefbfb` | `#120303` |
| `--bg-3-critical` | `oklch(from var(--anta-seed-critical) 0.972 0.011 h)` | `oklch(from var(--anta-seed-critical) 0.17 0.035 h)` | `#fdf2f2` | `#210606` |
| `--bg-4-critical` | `oklch(from var(--anta-seed-critical) 0.955 0.02 h)` | `oklch(from var(--anta-seed-critical) 0.185 0.05 h)` | `#fcebeb` | `#260808` |
| `--bg-5-critical` | `oklch(from var(--anta-seed-critical) 0.935 0.03 h)` | `oklch(from var(--anta-seed-critical) 0.205 0.055 h)` | `#fae5e5` | `#2e0a0b` |

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
| `--text-1` | `oklch(from var(--anta-seed-neutral) 0.1 0.01 h)` | `oklch(from var(--anta-seed-neutral) 0.94 0.008 h)` | `#050306` | `#ece9ec` |
| `--text-2` | `oklch(from var(--anta-seed-neutral) 0.3 0.015 h)` | `oklch(from var(--anta-seed-neutral) 0.8 0.015 h)` | `#302b31` | `#c1b9c1` |
| `--text-3` | `color-mix(in oklch, var(--text-2) 82%, transparent)` | `color-mix(in oklch, var(--text-2) 80%, transparent)` | `#635b65` | `#9f99a1` |
| `--text-4` | `color-mix(in oklch, var(--text-2) 60%, transparent)` | `color-mix(in oklch, var(--text-2) 60%, transparent)` | `#878089` | `#776e77` |
| `--text-5` | `color-mix(in oklch, var(--text-2) 40%, transparent)` | `color-mix(in oklch, var(--text-2) 40%, transparent)` | `#9f99a1` | `#635b65` |
| `--text-1-brand` | `oklch(from var(--anta-seed-brand) 0.38 0.11 h)` | `oklch(from var(--anta-seed-brand) 0.85 0.1 h)` | `#2e1e7b` | `#c5baff` |
| `--text-2-brand` | `oklch(from var(--anta-seed-brand) 0.43 0.15 h)` | `oklch(from var(--anta-seed-brand) 0.77 0.11 h)` | `#483493` | `#ada0ee` |
| `--text-3-brand` | `color-mix(in oklch, var(--text-2-brand) 82%, transparent)` | `color-mix(in oklch, var(--text-2-brand) 80%, transparent)` | `#483493cc` | `#ada0eecc` |
| `--text-4-brand` | `color-mix(in oklch, var(--text-2-brand) 60%, transparent)` | `color-mix(in oklch, var(--text-2-brand) 60%, transparent)` | `#48349399` | `#ada0ee99` |
| `--text-5-brand` | `color-mix(in oklch, var(--text-2-brand) 40%, transparent)` | `color-mix(in oklch, var(--text-2-brand) 40%, transparent)` | `#48349366` | `#ada0ee66` |
| `--text-1-info` | `oklch(from var(--anta-seed-info) 0.38 0.11 h)` | `oklch(from var(--anta-seed-info) 0.85 0.1 h)` | `#003969` | `#9ed2ff` |
| `--text-2-info` | `oklch(from var(--anta-seed-info) 0.43 0.15 h)` | `oklch(from var(--anta-seed-info) 0.77 0.11 h)` | `#175082` | `#7db6e8` |
| `--text-3-info` | `color-mix(in oklch, var(--text-2-info) 82%, transparent)` | `color-mix(in oklch, var(--text-2-info) 80%, transparent)` | `#175082cc` | `#7db6e8cc` |
| `--text-4-info` | `color-mix(in oklch, var(--text-2-info) 60%, transparent)` | `color-mix(in oklch, var(--text-2-info) 60%, transparent)` | `#175082b2` | `#7db6e899` |
| `--text-5-info` | `color-mix(in oklch, var(--text-2-info) 40%, transparent)` | `color-mix(in oklch, var(--text-2-info) 40%, transparent)` | `#17508280` | `#7db6e866` |
| `--text-1-success` | `oklch(from var(--anta-seed-success) 0.38 0.11 h)` | `oklch(from var(--anta-seed-success) 0.85 0.1 h)` | `#004618` | `#9ddeb1` |
| `--text-2-success` | `oklch(from var(--anta-seed-success) 0.43 0.15 h)` | `oklch(from var(--anta-seed-success) 0.77 0.11 h)` | `#1f5c31` | `#74cd8e` |
| `--text-3-success` | `color-mix(in oklch, var(--text-2-success) 82%, transparent)` | `color-mix(in oklch, var(--text-2-success) 80%, transparent)` | `#1f5c31cc` | `#74cd8ecc` |
| `--text-4-success` | `color-mix(in oklch, var(--text-2-success) 60%, transparent)` | `color-mix(in oklch, var(--text-2-success) 60%, transparent)` | `#1f5c3199` | `#74cd8e99` |
| `--text-5-success` | `color-mix(in oklch, var(--text-2-success) 40%, transparent)` | `color-mix(in oklch, var(--text-2-success) 40%, transparent)` | `#1f5c3166` | `#74cd8e66` |
| `--text-1-warning` | `oklch(from var(--anta-seed-warning) 0.38 0.11 h)` | `oklch(from var(--anta-seed-warning) 0.85 0.1 h)` | `#7f410b` | `#f0bf75` |
| `--text-2-warning` | `oklch(from var(--anta-seed-warning) 0.43 0.15 h)` | `oklch(from var(--anta-seed-warning) 0.77 0.11 h)` | `#995200` | `#e1a452` |
| `--text-3-warning` | `color-mix(in oklch, var(--text-2-warning) 82%, transparent)` | `color-mix(in oklch, var(--text-2-warning) 80%, transparent)` | `#995200cc` | `#e1a452cc` |
| `--text-4-warning` | `color-mix(in oklch, var(--text-2-warning) 60%, transparent)` | `color-mix(in oklch, var(--text-2-warning) 60%, transparent)` | `#99520099` | `#e1a45299` |
| `--text-5-warning` | `color-mix(in oklch, var(--text-2-warning) 40%, transparent)` | `color-mix(in oklch, var(--text-2-warning) 40%, transparent)` | `#99520066` | `#e1a45266` |
| `--text-1-critical` | `oklch(from var(--anta-seed-critical) 0.38 0.11 h)` | `oklch(from var(--anta-seed-critical) 0.85 0.1 h)` | `#8f1014` | `#ffabac` |
| `--text-2-critical` | `oklch(from var(--anta-seed-critical) 0.43 0.15 h)` | `oklch(from var(--anta-seed-critical) 0.77 0.11 h)` | `#a01c1c` | `#e78e90` |
| `--text-3-critical` | `color-mix(in oklch, var(--text-2-critical) 82%, transparent)` | `color-mix(in oklch, var(--text-2-critical) 80%, transparent)` | `#a01c1ccc` | `#e78e90cc` |
| `--text-4-critical` | `color-mix(in oklch, var(--text-2-critical) 60%, transparent)` | `color-mix(in oklch, var(--text-2-critical) 60%, transparent)` | `#a01c1c99` | `#e78e9099` |
| `--text-5-critical` | `color-mix(in oklch, var(--text-2-critical) 40%, transparent)` | `color-mix(in oklch, var(--text-2-critical) 40%, transparent)` | `#a01c1c66` | `#e78e9066` |

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
| `--border-1` | `oklch(from var(--anta-seed-neutral) 0.67 0.008 h)` | `oklch(from var(--anta-seed-neutral) 0.52 0.008 h)` | `#938d96` | `hsl(288deg 5.21% 42%)` |
| `--border-2` | `oklch(from var(--anta-seed-neutral) 0.8 0.008 h)` | `oklch(from var(--anta-seed-neutral) 0.41 0.008 h)` | `#c1b9c1` | `hsl(282deg 7.04% 28%)` |
| `--border-3` | `oklch(from var(--anta-seed-neutral) 0.86 0.008 h)` | `oklch(from var(--anta-seed-neutral) 0.33 0.008 h)` | `#d4ced4` | `hsl(277.5deg 6.56% 20%)` |
| `--border-4` | `oklch(from var(--anta-seed-neutral) 0.9 0.008 h)` | `oklch(from var(--anta-seed-neutral) 0.26 0.008 h)` | `#e0dce0` | `hsl(290deg 6.52% 14%)` |
| `--border-5` | `oklch(from var(--anta-seed-neutral) 0.935 0.008 h)` | `oklch(from var(--anta-seed-neutral) 0.21 0.008 h)` | `#ece9ec` | `hsl(285deg 7.14% 10%)` |
| `--border-1-brand` | `oklch(from var(--anta-seed-brand) 0.67 0.13 h)` | `oklch(from var(--anta-seed-brand) 0.52 0.15 h)` | `#9081df` | `hsl(250.08deg 59.8% 58%)` |
| `--border-2-brand` | `oklch(from var(--anta-seed-brand) 0.8 0.09 h)` | `oklch(from var(--anta-seed-brand) 0.41 0.12 h)` | `#bcb1f1` | `hsl(250deg 50% 42%)` |
| `--border-3-brand` | `oklch(from var(--anta-seed-brand) 0.86 0.055 h)` | `oklch(from var(--anta-seed-brand) 0.33 0.09 h)` | `#d2cbf6` | `hsl(252.63deg 47.74% 30%)` |
| `--border-4-brand` | `oklch(from var(--anta-seed-brand) 0.9 0.04 h)` | `oklch(from var(--anta-seed-brand) 0.26 0.06 h)` | `#ddd8f8` | `hsl(249.8deg 39.84% 19%)` |
| `--border-5-brand` | `oklch(from var(--anta-seed-brand) 0.935 0.028 h)` | `oklch(from var(--anta-seed-brand) 0.21 0.045 h)` | `#e9e5fa` | `hsl(249deg 39.22% 14%)` |
| `--border-1-info` | `oklch(from var(--anta-seed-info) 0.67 0.13 h)` | `oklch(from var(--anta-seed-info) 0.52 0.15 h)` | `#56a1e1` | `hsl(207.82deg 70.2% 40%)` |
| `--border-2-info` | `oklch(from var(--anta-seed-info) 0.8 0.09 h)` | `oklch(from var(--anta-seed-info) 0.41 0.12 h)` | `#93c5ec` | `hsl(207.77deg 69.94% 29%)` |
| `--border-3-info` | `oklch(from var(--anta-seed-info) 0.86 0.055 h)` | `oklch(from var(--anta-seed-info) 0.33 0.09 h)` | `#bad6f3` | `hsl(208.04deg 69.93% 21%)` |
| `--border-4-info` | `oklch(from var(--anta-seed-info) 0.9 0.04 h)` | `oklch(from var(--anta-seed-info) 0.26 0.06 h)` | `#cfe3f7` | `hsl(208.52deg 62.89% 14%)` |
| `--border-5-info` | `oklch(from var(--anta-seed-info) 0.935 0.028 h)` | `oklch(from var(--anta-seed-info) 0.21 0.045 h)` | `#e1eefa` | `hsl(207.78deg 65.85% 10.5%)` |
| `--border-1-success` | `oklch(from var(--anta-seed-success) 0.67 0.13 h)` | `oklch(from var(--anta-seed-success) 0.52 0.15 h)` | `#44c169` | `hsl(138.18deg 49.75% 29%)` |
| `--border-2-success` | `oklch(from var(--anta-seed-success) 0.8 0.09 h)` | `oklch(from var(--anta-seed-success) 0.41 0.12 h)` | `#88d7a0` | `hsl(138.26deg 50.36% 20%)` |
| `--border-3-success` | `oklch(from var(--anta-seed-success) 0.86 0.055 h)` | `oklch(from var(--anta-seed-success) 0.33 0.09 h)` | `#b3e5c2` | `hsl(137.7deg 49.59% 16%)` |
| `--border-4-success` | `oklch(from var(--anta-seed-success) 0.9 0.04 h)` | `oklch(from var(--anta-seed-success) 0.26 0.06 h)` | `#c6ecd1` | `hsl(138.46deg 52% 10%)` |
| `--border-5-success` | `oklch(from var(--anta-seed-success) 0.935 0.028 h)` | `oklch(from var(--anta-seed-success) 0.21 0.045 h)` | `#d9f2e0` | `hsl(138.86deg 53.85% 7.5%)` |
| `--border-1-warning` | `oklch(from var(--anta-seed-warning) 0.67 0.13 h)` | `oklch(from var(--anta-seed-warning) 0.52 0.15 h)` | `#d88118` | `hsl(32.13deg 80.31% 34%)` |
| `--border-2-warning` | `oklch(from var(--anta-seed-warning) 0.8 0.09 h)` | `oklch(from var(--anta-seed-warning) 0.41 0.12 h)` | `#edb25a` | `hsl(27.93deg 84.06% 24%)` |
| `--border-3-warning` | `oklch(from var(--anta-seed-warning) 0.86 0.055 h)` | `oklch(from var(--anta-seed-warning) 0.33 0.09 h)` | `#f3cc91` | `hsl(30deg 79.66% 17%)` |
| `--border-4-warning` | `oklch(from var(--anta-seed-warning) 0.9 0.04 h)` | `oklch(from var(--anta-seed-warning) 0.26 0.06 h)` | `#f6dbb1` | `hsl(28.75deg 63.16% 12%)` |
| `--border-5-warning` | `oklch(from var(--anta-seed-warning) 0.935 0.028 h)` | `oklch(from var(--anta-seed-warning) 0.21 0.045 h)` | `#f9e7cd` | `hsl(28.64deg 66.67% 9%)` |
| `--border-1-critical` | `oklch(from var(--anta-seed-critical) 0.67 0.13 h)` | `oklch(from var(--anta-seed-critical) 0.52 0.15 h)` | `#e56c6c` | `hsl(0deg 56% 46%)` |
| `--border-2-critical` | `oklch(from var(--anta-seed-critical) 0.8 0.09 h)` | `oklch(from var(--anta-seed-critical) 0.41 0.12 h)` | `#efa4a4` | `hsl(0.42deg 63% 30%)` |
| `--border-3-critical` | `oklch(from var(--anta-seed-critical) 0.86 0.055 h)` | `oklch(from var(--anta-seed-critical) 0.33 0.09 h)` | `#f4c2c2` | `hsl(0deg 62.21% 23%)` |
| `--border-4-critical` | `oklch(from var(--anta-seed-critical) 0.9 0.04 h)` | `oklch(from var(--anta-seed-critical) 0.26 0.06 h)` | `#f7d4d4` | `hsl(359.13deg 59% 15%)` |
| `--border-5-critical` | `oklch(from var(--anta-seed-critical) 0.935 0.028 h)` | `oklch(from var(--anta-seed-critical) 0.21 0.045 h)` | `#fae5e5` | `hsl(359.06deg 63% 11%)` |

### Link and focus values

| Token | Default light | Default dark | Reference light | Reference dark |
| --- | --- | --- | --- | --- |
| `--link-color` | `#1466d4` | `#7baee9` | Uses default | Uses default |
| `--link-color-hover` | `#2674e6` | `#90bdee` | Uses default | Uses default |
| `--focus-ring` | `oklch(0.55 0.2 284.15)` | `#a897fc` | `oklch(0.55 0.2 284.15)` | `#a897fc` |

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
