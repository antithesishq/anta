# Theming

## Reference palette

`@antadesign/anta` ships an optional hand-tuned reference palette at
`@antadesign/anta/theme-anta.css`. Import it after the tokens, reset, and element
registration imports to replace the seed-derived default:

```ts
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/reset.css'
import '@antadesign/anta/elements'
import '@antadesign/anta/theme-anta.css'
```

Omit the final import to use the default palette, or define your own theme.

Anta's palette is generative. Every color in the system derives from six tone seeds (`--anta-seed-neutral`, `--anta-seed-brand`, `--anta-seed-info`, …), and a seed contributes only its hue: the lightness and chroma of every background, text, border, and component state come from Anta's formulas, tuned per role and per theme. Reskinning a tone is one custom property, and the whole scale re-derives in both light and dark:

```css
:root {
  --anta-seed-brand: #0f766e; /* a teal brand; every brand token follows */
}
```

Anta's styles use ordered child layers inside `@layer anta`. Your unlayered CSS
overrides them without `!important`, and shadow-DOM components expose
`::part(...)`. A component's `tone` accepts a named tone or CSS color and derives
its rest, hover, and active values. Each component page lists its styling hooks.

The lab below shows the derivation live. For each toned component, the shipped Default sits next to a Custom preview driven by the seed picker, with the formula constants editable and the resolved CSS shown.

## Theming lab reference

The lab varies a tone seed and formula inputs in light and dark mode. These inputs describe the lab's calculations. For application styling, use tone props, global role tokens, CSS, and the parts documented on each component page.

| Tone | Seed property | Initial lab seed |
| --- | --- | --- |
| neutral | `--anta-seed-neutral` | `#635b65` |
| brand | `--anta-seed-brand` | `#5f4bc3` |
| info | `--anta-seed-info` | `#1f6eb2` |
| success | `--anta-seed-success` | `#2a7e43` |
| warning | `--anta-seed-warning` | `#c37416` |
| critical | `--anta-seed-critical` | `#c9302c` |

### Background and Borders

The container background and border role scales, derived from the source hue. Backgrounds sit near the page lightness with a faint tint that grows per step; borders step down in lightness from a saturated edge (border-1) to the faint bg-5, chroma easing off as they lighten. Neutral zeroes chroma to stay grey.

#### Background

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bg-1 L | 1 | 0 | 1 | 0 | 0–1 | 0.005 |  |
| bg-2 L | 0.99 | 0.13 | 0.985 | 0.16 | 0–1 | 0.005 |  |
| bg-2 C | 0.004 | 0.02 | 0.002 | 0.002 | 0–0.4 | 0.005 |  |
| bg-3 L | 0.972 | 0.17 | 0.97 | 0.177 | 0–1 | 0.005 |  |
| bg-3 C | 0.011 | 0.035 | 0.004 | 0.005 | 0–0.4 | 0.005 |  |
| bg-4 L | 0.955 | 0.185 | 0.954 | 0.191 | 0–1 | 0.005 |  |
| bg-4 C | 0.02 | 0.05 | 0.004 | 0.006 | 0–0.4 | 0.005 |  |
| bg-5 L | 0.935 | 0.205 | 0.935 | 0.2 | 0–1 | 0.005 |  |
| bg-5 C | 0.03 | 0.055 | 0.006 | 0.009 | 0–0.4 | 0.005 |  |

#### Border

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| border-1 L | 0.67 | 0.52 | 0.67 | 0.52 | 0–1 | 0.005 |  |
| border-1 C | 0.13 | 0.15 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-2 L | 0.8 | 0.41 | 0.8 | 0.41 | 0–1 | 0.005 |  |
| border-2 C | 0.09 | 0.12 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-3 L | 0.86 | 0.33 | 0.86 | 0.33 | 0–1 | 0.005 |  |
| border-3 C | 0.055 | 0.09 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-4 L | 0.9 | 0.26 | 0.9 | 0.26 | 0–1 | 0.005 |  |
| border-4 C | 0.04 | 0.06 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| border-5 L | 0.935 | 0.21 | 0.935 | 0.21 | 0–1 | 0.005 |  |
| border-5 C | 0.028 | 0.045 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |

### Text

The text color role scale, derived from the source hue. text-1 is the strong primary; text-2 the base (secondary); text-3/4 step text-2 down by alpha — Title and Text read text-1..4 as their priorities. text-5 is the faintest step (text-2 at a lower alpha), used for disabled / hint text across components, not a Title/Text priority.

#### Primary

text-1.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-1 L | 0.38 | 0.85 | 0.1 | 0.94 | 0–1 | 0.005 |  |
| text-1 C | 0.11 | 0.1 | 0.01 | 0.008 | 0–0.4 | 0.005 |  |

#### Secondary

text-2 base.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-2 L | 0.43 | 0.77 | 0.3 | 0.8 | 0–1 | 0.005 |  |
| text-2 C | 0.15 | 0.11 | 0.015 | 0.015 | 0–0.4 | 0.005 |  |

#### Tertiary

text-2 base at this alpha (→ text-3).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-3 α % | 82 | 80 | 82 | 80 | 0–100 | 1 |  |

#### Quaternary

text-2 base at this alpha (→ text-4).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-4 α % | 60 | 60 | 60 | 60 | 0–100 | 1 |  |

#### Faint (text-5)

text-2 base at this alpha (→ text-5) — the disabled / hint step, not a Title/Text priority.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| text-5 α % | 40 | 40 | 40 | 40 | 0–100 | 1 |  |

### Buttons

Primary is the source fill at three lightnesses. Secondary, tertiary, and quaternary share one foreground; secondary and tertiary share an alpha-tinted fill (tertiary a step softer, transparent at rest), quaternary has none. Secondary’s label subtracts an l-shift to read a step stronger than its tint.

#### Primary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L rest | 0.51 | 0.4 | 0.5 | 0.4 | 0–1 | 0.005 |  |
| L hover | 0.46 | 0.44 | 0.45 | 0.44 | 0–1 | 0.005 |  |
| L active | 0.41 | 0.48 | 0.4 | 0.48 | 0–1 | 0.005 |  |
| fill C | 0.17 | 0.16 | 0.02 | 0.015 | 0–0.4 | 0.005 | One chroma for the primary fill across rest/hover/active. Neutral pins it near-grey; toned versions set the saturation here instead of inheriting the seed’s own chroma. |

#### Secondary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L | 0.46 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg L hover | 0.4 | 0.86 | 0.4 | 0.86 | 0–1 | 0.005 |  |
| fg C | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| fg l-shift | 0.05 | 0 | 0.05 | 0 | 0–0.3 | 0.005 | Subtracted from the secondary label’s OKLCH lightness so it reads one step stronger than the tint behind it. |
| tint L | 0.54 | 0.58 | 0.54 | 0.44 | 0–1 | 0.005 |  |
| tint C | 0.17 | 0.16 | 0.03 | 0.01 | 0–0.4 | 0.005 |  |
| α rest | 0.1 | 0.215 | 0.1 | 0.24 | 0–1 | 0.005 |  |
| α hover | 0.15 | 0.29 | 0.15 | 0.34 | 0–1 | 0.005 |  |
| α active | 0.2 | 0.34 | 0.2 | 0.44 | 0–1 | 0.005 |  |

#### Tertiary

Reuses the secondary foreground + tint (no separate Anta constant).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L | 0.46 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg L hover | 0.4 | 0.86 | 0.4 | 0.86 | 0–1 | 0.005 |  |
| fg C | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| tint L | 0.54 | 0.58 | 0.54 | 0.44 | 0–1 | 0.005 |  |
| tint C | 0.17 | 0.16 | 0.03 | 0.01 | 0–0.4 | 0.005 |  |
| α rest | 0.1 | 0.215 | 0.1 | 0.24 | 0–1 | 0.005 |  |
| α hover | 0.15 | 0.29 | 0.15 | 0.34 | 0–1 | 0.005 |  |

#### Quaternary

Rest (and active) is the tertiary foreground at the rest α; hover uses its own detached lightness at full opacity. No fill.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fg L | 0.46 | 0.86 | 0.46 | 0.86 | 0–1 | 0.005 |  |
| fg C | 0.17 | 0.13 | 0.008 | 0.015 | 0–0.4 | 0.005 |  |
| hover L | 0.38 | 0.9 | 0.38 | 0.9 | 0–1 | 0.005 | Quaternary hover lightness, detached from tertiary — its own value, not the shared secondary fg-hover. Rest and active carry the rest α; hover is opaque. |
| α rest | 0.85 | 0.85 | 0.85 | 0.85 | 0–1 | 0.005 | Alpha on the quaternary rest (and active) foreground. Light-mode neutral needs ≈0.83 to clear WCAG AA (4.5:1) over bg-2. |

### Tags

Primary is a solid fill; secondary an alpha tint of the tint hue; tertiary an outline. The label and edge are the Text scale — edge = --text-2, label = --text-2 at the label α (80 → --text-3), tunable per Tag (e.g. raise it for small-text contrast). The tint and solid fill are the Tag’s own (source hue at these L/C); alphas set each priority’s strength.

#### Primary

Solid fill; white label.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| solid L | 0.58 | 0.46 | 0.55 | 0.48 | 0–1 | 0.005 |  |
| solid C | 0.175 | 0.165 | 0.015 | 0.015 | 0–0.4 | 0.005 | Chroma of the primary solid fill, independent of the secondary tint’s C. Neutral pins it near-grey. |

#### Secondary

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tint L | 0.57 | 0.63 | 0.55 | 0.63 | 0–1 | 0.005 |  |
| tint C | 0.16 | 0.17 | 0.03 | 0.04 | 0–0.4 | 0.005 |  |
| fill α % | 10 | 20 | 10 | 20 | 0–100 | 1 |  |
| border α % | 15 | 25 | 15 | 25 | 0–100 | 1 |  |

#### Tertiary

Outline alpha; the edge color is --text-2.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| edge α % | 20 | 30 | 20 | 30 | 0–100 | 1 |  |

#### Label

Label = --text-2 at this alpha (80 → --text-3). Raise for small-text contrast.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| label α % | 80 | 80 | 80 | 80 | 0–100 | 1 |  |

### Tabs

The strip’s primary/secondary/tertiary differ structurally (filled track vs subtle vs underline). Labels and rings are the role scale: selected/hover = --text-1, rest = --text-2 at the rest α (80 → --text-3), tertiary hover = --text-2, track ring = --border-4, selected ring = --border-2, selected pill = --bg-1. Only the recessed track tint, secondary fill, and the rest α are the Tabs’ own — the knobs below.

#### Track & fill

The recessed track tint (primary) and the selected secondary fill — a faint overlay of the source hue.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill L | 0.55 | 0.8 | 0.55 | 0.8 | 0–1 | 0.005 |  |
| fill C | 0.14 | 0.12 | 0.008 | 0.008 | 0–0.4 | 0.005 |  |
| track α | 0.06 | 0.07 | 0.06 | 0.07 | 0–1 | 0.005 |  |
| fill α | 0.03 | 0.08 | 0.03 | 0.08 | 0–1 | 0.005 |  |

#### Rest label

Non-selected label = --text-2 at this alpha (80 → --text-3). Selected/hover use full --text-1.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest α % | 80 | 80 | 80 | 80 | 0–100 | 1 |  |

### Checkboxes

Hoisted to --_tone-l-* inputs: the checked fill is the source at three lightnesses. The off-state box border ramps off that fill mixed toward neutral grey. On = toneSelected; off = tone.

#### Fill

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L rest | 0.5 | 0.45 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| L hover | 0.45 | 0.5 | 0.45 | 0.45 | 0–1 | 0.005 |  |
| L active | 0.4 | 0.57 | 0.4 | 0.5 | 0–1 | 0.005 |  |

### Radio

Identical fill curve to Checkbox: --_tone-l-* set the selected dot at three lightnesses, and the off-ring border ramps off it. Group toneSelected drives the picked option.

#### Fill

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L rest | 0.5 | 0.45 | 0.6 | 0.42 | 0–1 | 0.005 |  |
| L hover | 0.45 | 0.5 | 0.45 | 0.45 | 0–1 | 0.005 |  |
| L active | 0.4 | 0.57 | 0.4 | 0.5 | 0–1 | 0.005 |  |

### Expander

Every color is a role token; the Expander defines none of its own. Label: rest --text-2, hover --text-1 (Title’s secondary/primary). Fill and border are the surface scale (secondary --bg-2 / --border-5, primary --bg-4 / --border-4), and the fill lightens a step on hover. Tertiary is text only, all themed per tone.

### Input

One border color from the seed hue at a tunable L/C — the goal is a single L/C per theme that works across every tone. Hover thickens the edge 0.5→1px (no recolor). Neutral overrides pin it grey (≈ --border-2). Applies to Input and the InputDate trigger (both compose <a-input>).

#### Border

Seed hue at this L/C (hover thickens the edge, no recolor). Toned starts at the average of today’s per-status literals; neutral pins grey ≈ --border-2.

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| border L | 0.58 | 0.52 | 0.8 | 0.4 | 0–1 | 0.005 |  |
| border C | 0.18 | 0.15 | 0.015 | 0.019 | 0–0.4 | 0.005 |  |

### Menu items

The item label is --text-2; the hint and icon are --text-2 at the hint α (80 → --text-3), so the text follows the Text spec while the hint strength stays tunable. The selected row holds a persistent tint of the label color — its alpha is the Menu’s own knob too.

#### Text

Label is full --text-2; hint + icon are --text-2 at this alpha (80 → --text-3).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hint α % | 80 | 80 | 80 | 80 | 0–100 | 1 |  |

#### Selected

Tint held on the selected row — a % of the item color (--text-2).

| Input | Toned light | Toned dark | Neutral light | Neutral dark | Range | Step | Meaning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| selected α % | 9 | 12 | 9 | 12 | 0–100 | 1 |  |

### Progress

Every color is a role token; Progress defines none of its own. Track = --bg-4, border = --border-4, the fill indicator = --bg-5, the label = --text-2, and the right-aligned hint = --text-3. Named tones swap in the matching -{tone} role variant (so dark mode is free), and the fill’s right-edge fades from --bg-5 to --border-4. Follows the Text and Background & Borders panels live.
