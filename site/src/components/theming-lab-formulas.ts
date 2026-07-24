/**
 * Data for the theming lab (`ThemingLab.tsx`). Each entry describes one toned
 * component: the tunable constants its custom-tone oklch formula uses (light and
 * dark defaults, transcribed verbatim from the element's `src/elements/a-*.css`),
 * how they group by priority / role, and a `css()` that renders those constants
 * back into the formula text.
 *
 * `css(sel, seed, v)` returns the CSS that drives the generative preview. The lab
 * injects it un-layered (beating `@layer anta`) scoped to a per-tone container, and
 * shows the same string as the "CSS output". At the default values it reproduces
 * Anta's own generative output — a visual no-op — so only an edited value makes the
 * generative preview diverge from the hand-tuned reference.
 *
 * `vars` is the flat, unique set of constants (drives `defaults()` and `css()`).
 * `groups` is the display split: one entry per priority (or role), listing the keys
 * it exposes. A key may appear in more than one group — a lower priority that
 * reuses a higher one's constants repeats those inputs (they stay in sync) with a
 * `note` saying so. This mirrors Anta's formulas, where e.g. a Button's tertiary
 * and quaternary reuse the secondary foreground/tint.
 */

/** One tunable constant, with its light and dark defaults and input bounds. */
export interface VarDef {
  key: string
  label: string
  light: number
  dark: number
  /** Neutral-tone default overrides. Neutral is hand-authored grey, not a
   *  formula-derived tone, so it can want per-key values the colored tones don't
   *  share. When set, it wins over `light`/`dark` (and the `NEUTRAL_CHROMA`
   *  fallback) for the neutral panel only. */
  neutral?: { light?: number; dark?: number }
  min: number
  max: number
  step: number
  tip?: string
}

/** A display group of variables — one priority (or role) of a component. */
export interface VarGroup {
  label: string
  keys: string[]
  /** Shown under the group header, e.g. when a priority reuses another's knobs. */
  note?: string
}

export type Vals = Record<string, number>

export interface ComponentSpec {
  /** Slug used in the generative container class (`.tl-gen-{tone}-{id}`). */
  id: string
  /** Heading text. */
  title: string
  /** One line under the header explaining what the formula does. */
  blurb: string
  /** The flat, unique set of tunable constants. */
  vars: VarDef[]
  /** How the constants split into per-priority / per-role expanders. */
  groups: VarGroup[]
  /**
   * Role-token spec: the formula emits global role tokens (e.g. `--text-*`) that
   * the sample components inherit, rather than styling one element. `Block` then
   * scopes injection to the preview container (`.tl-gen-…`) and displays it at
   * `:root`, and the generative samples render untoned so they read the tokens.
   */
  tokens?: boolean
  /**
   * The generative-driving CSS. `sel` is the element selector (bare `a-title` for
   * the displayed code, the scoped `.tl-gen-… a-title` / `.dark .tl-gen-… a-title`
   * for injection); `seed` is the source colour; `v` the current theme's values.
   * For a `tokens` spec, `sel` is `:root` (display) or the container (injection).
   */
  css: (sel: string, seed: string, v: Vals) => string
}

/** Tones, Neutral first. Each seed is the shipped primary-rest light literal. */
export const TONES = ['neutral', 'brand', 'info', 'success', 'warning', 'critical'] as const
export type Tone = (typeof TONES)[number]

export const TONE_LABEL: Record<Tone, string> = {
  neutral: 'Neutral',
  brand: 'Brand',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  critical: 'Critical',
}

export const SEED: Record<Tone, string> = {
  neutral: '#635b65',
  brand: '#5f4bc3',
  info: '#1f6eb2',
  success: '#2a7e43',
  warning: '#c37416',
  critical: '#c9302c',
}

/** `oklch(from <seed> L C h)`, the shape every formula uses. */
const ok = (seed: string, l: number | string, c: number | string) =>
  `oklch(from ${seed} ${l} ${c} h)`

const v3 = (min = 0, max = 1, step = 0.005) => ({ min, max, step })
const pct = { min: 0, max: 100, step: 1 }

export const SPECS: ComponentSpec[] = [
  {
    id: 'surface',
    title: 'Background & Borders',
    blurb:
      'The container background and border role scales, derived from the source hue. Backgrounds sit near the page lightness with a faint tint that grows per step; borders step down in lightness from a saturated edge (border-1) to the faint bg-5, chroma easing off as they lighten. Neutral zeroes chroma to stay grey.',
    vars: [
      { key: 'bg1L', label: 'bg-1 L', light: 1, dark: 0, ...v3() },
      { key: 'bg2L', label: 'bg-2 L', light: 0.99, dark: 0.13, neutral: { light: 0.985, dark: 0.16 }, ...v3() },
      { key: 'bg2C', label: 'bg-2 C', light: 0.004, dark: 0.02, neutral: { light: 0.002, dark: 0.002 }, ...v3(0, 0.4) },
      { key: 'bg3L', label: 'bg-3 L', light: 0.972, dark: 0.17, neutral: { light: 0.97, dark: 0.177 }, ...v3() },
      { key: 'bg3C', label: 'bg-3 C', light: 0.011, dark: 0.035, neutral: { light: 0.004, dark: 0.005 }, ...v3(0, 0.4) },
      { key: 'bg4L', label: 'bg-4 L', light: 0.955, dark: 0.185, neutral: { light: 0.954, dark: 0.191 }, ...v3() },
      { key: 'bg4C', label: 'bg-4 C', light: 0.02, dark: 0.05, neutral: { light: 0.004, dark: 0.006 }, ...v3(0, 0.4) },
      { key: 'bg5L', label: 'bg-5 L', light: 0.935, dark: 0.205, neutral: { dark: 0.2 }, ...v3() },
      { key: 'bg5C', label: 'bg-5 C', light: 0.03, dark: 0.055, neutral: { light: 0.006, dark: 0.009 }, ...v3(0, 0.4) },
      { key: 'bd1L', label: 'border-1 L', light: 0.67, dark: 0.52, ...v3() },
      { key: 'bd1C', label: 'border-1 C', light: 0.13, dark: 0.15, ...v3(0, 0.4) },
      { key: 'bd2L', label: 'border-2 L', light: 0.8, dark: 0.41, ...v3() },
      { key: 'bd2C', label: 'border-2 C', light: 0.09, dark: 0.12, ...v3(0, 0.4) },
      { key: 'bd3L', label: 'border-3 L', light: 0.86, dark: 0.33, ...v3() },
      { key: 'bd3C', label: 'border-3 C', light: 0.055, dark: 0.09, ...v3(0, 0.4) },
      { key: 'bd4L', label: 'border-4 L', light: 0.9, dark: 0.26, ...v3() },
      { key: 'bd4C', label: 'border-4 C', light: 0.04, dark: 0.06, ...v3(0, 0.4) },
      { key: 'bd5L', label: 'border-5 L', light: 0.935, dark: 0.21, ...v3() },
      { key: 'bd5C', label: 'border-5 C', light: 0.028, dark: 0.045, ...v3(0, 0.4) },
    ],
    groups: [
      { label: 'Background', keys: ['bg1L', 'bg2L', 'bg2C', 'bg3L', 'bg3C', 'bg4L', 'bg4C', 'bg5L', 'bg5C'] },
      { label: 'Border', keys: ['bd1L', 'bd1C', 'bd2L', 'bd2C', 'bd3L', 'bd3C', 'bd4L', 'bd4C', 'bd5L', 'bd5C'] },
    ],
    css: (sel, seed, v) => `${sel} {
  --bg-1: ${ok(seed, v.bg1L, 0)};
  --bg-2: ${ok(seed, v.bg2L, v.bg2C)};
  --bg-3: ${ok(seed, v.bg3L, v.bg3C)};
  --bg-4: ${ok(seed, v.bg4L, v.bg4C)};
  --bg-5: ${ok(seed, v.bg5L, v.bg5C)};
  --border-1: ${ok(seed, v.bd1L, v.bd1C)};
  --border-2: ${ok(seed, v.bd2L, v.bd2C)};
  --border-3: ${ok(seed, v.bd3L, v.bd3C)};
  --border-4: ${ok(seed, v.bd4L, v.bd4C)};
  --border-5: ${ok(seed, v.bd5L, v.bd5C)};
}`,
  },

  {
    id: 'text',
    title: 'Text',
    blurb:
      'The text colour role scale, derived from the source hue. text-1 is the strong primary; text-2 the base (secondary); text-3/4 step text-2 down by alpha — Title and Text read text-1..4 as their priorities. text-5 is the faintest step (text-2 at a lower alpha), used for disabled / hint text across components, not a Title/Text priority.',
    vars: [
      { key: 'priL', label: 'text-1 L', light: 0.38, dark: 0.85, neutral: { light: 0.1, dark: 0.94 }, ...v3() },
      { key: 'priC', label: 'text-1 C', light: 0.11, dark: 0.1, neutral: { light: 0.01, dark: 0.008 }, ...v3(0, 0.4) },
      { key: 'baseL', label: 'text-2 L', light: 0.43, dark: 0.77, neutral: { light: 0.3, dark: 0.8 }, ...v3() },
      { key: 'baseC', label: 'text-2 C', light: 0.15, dark: 0.11, neutral: { light: 0.015, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'tertA', label: 'text-3 α %', light: 82, dark: 80, ...pct },
      { key: 'quatA', label: 'text-4 α %', light: 60, dark: 60, ...pct },
      { key: 'quinA', label: 'text-5 α %', light: 40, dark: 40, ...pct },
    ],
    groups: [
      { label: 'Primary', keys: ['priL', 'priC'], note: 'text-1.' },
      { label: 'Secondary', keys: ['baseL', 'baseC'], note: 'text-2 base.' },
      { label: 'Tertiary', keys: ['tertA'], note: 'text-2 base at this alpha (→ text-3).' },
      { label: 'Quaternary', keys: ['quatA'], note: 'text-2 base at this alpha (→ text-4).' },
      { label: 'Faint (text-5)', keys: ['quinA'], note: 'text-2 base at this alpha (→ text-5) — the disabled / hint step, not a Title/Text priority.' },
    ],
    tokens: true,
    css: (sel, seed, v) => `${sel} {
  --text-1: ${ok(seed, v.priL, v.priC)};
  --text-2: ${ok(seed, v.baseL, v.baseC)};
  --text-3: color-mix(in oklch, var(--text-2) ${v.tertA}%, transparent);
  --text-4: color-mix(in oklch, var(--text-2) ${v.quatA}%, transparent);
  --text-5: color-mix(in oklch, var(--text-2) ${v.quinA}%, transparent);
}`,
  },

  {
    id: 'button',
    title: 'Buttons',
    blurb:
      'Primary is the source fill at three lightnesses. Secondary, tertiary, and quaternary share one foreground; secondary and tertiary share an alpha-tinted fill (tertiary a step softer, transparent at rest), quaternary has none. Secondary’s label subtracts an l-shift to read a step stronger than its tint.',
    vars: [
      { key: 'plRest', label: 'L rest', light: 0.51, dark: 0.4, neutral: { light: 0.5 }, ...v3() },
      { key: 'plHover', label: 'L hover', light: 0.46, dark: 0.44, neutral: { light: 0.45 }, ...v3() },
      { key: 'plActive', label: 'L active', light: 0.41, dark: 0.48, neutral: { light: 0.4 }, ...v3() },
      { key: 'plC', label: 'fill C', light: 0.17, dark: 0.16, neutral: { light: 0.02, dark: 0.015 }, ...v3(0, 0.4), tip: 'One chroma for the primary fill across rest/hover/active. Neutral pins it near-grey; toned versions set the saturation here instead of inheriting the seed’s own chroma.' },
      { key: 'fgL', label: 'fg L', light: 0.46, dark: 0.86, ...v3() },
      { key: 'fgStrongL', label: 'fg L hover', light: 0.4, dark: 0.86, ...v3() },
      { key: 'fgC', label: 'fg C', light: 0.17, dark: 0.13, neutral: { light: 0.008, dark: 0.015 }, ...v3(0, 0.4) },
      { key: 'fgShift', label: 'fg l-shift', light: 0.05, dark: 0, ...v3(0, 0.3), tip: 'Subtracted from the secondary label’s OKLCH lightness so it reads one step stronger than the tint behind it.' },
      { key: 'bgL', label: 'tint L', light: 0.54, dark: 0.58, neutral: { dark: 0.44 }, ...v3() },
      { key: 'bgC', label: 'tint C', light: 0.17, dark: 0.16, neutral: { light: 0.03, dark: 0.01 }, ...v3(0, 0.4) },
      { key: 'aRest', label: 'α rest', light: 0.1, dark: 0.215, neutral: { dark: 0.24 }, ...v3() },
      { key: 'aHover', label: 'α hover', light: 0.15, dark: 0.29, neutral: { dark: 0.34 }, ...v3() },
      { key: 'aActive', label: 'α active', light: 0.2, dark: 0.34, neutral: { dark: 0.44 }, ...v3() },
      { key: 'quatHoverL', label: 'hover L', light: 0.38, dark: 0.9, ...v3(), tip: 'Quaternary hover lightness, detached from tertiary — its own value, not the shared secondary fg-hover. Rest and active carry the rest α; hover is opaque.' },
      { key: 'quatRestA', label: 'α rest', light: 0.85, dark: 0.85, ...v3(), tip: 'Alpha on the quaternary rest (and active) foreground. Light-mode neutral needs ≈0.83 to clear WCAG AA (4.5:1) over bg-2.' },
    ],
    groups: [
      { label: 'Primary', keys: ['plRest', 'plHover', 'plActive', 'plC'] },
      { label: 'Secondary', keys: ['fgL', 'fgStrongL', 'fgC', 'fgShift', 'bgL', 'bgC', 'aRest', 'aHover', 'aActive'] },
      { label: 'Tertiary', keys: ['fgL', 'fgStrongL', 'fgC', 'bgL', 'bgC', 'aRest', 'aHover'], note: 'Reuses the secondary foreground + tint (no separate Anta constant).' },
      { label: 'Quaternary', keys: ['fgL', 'fgC', 'quatHoverL', 'quatRestA'], note: 'Rest (and active) is the tertiary foreground at the rest α; hover uses its own detached lightness at full opacity. No fill.' },
    ],
    css: (sel, seed, v) => `${sel} {
  --button-bg-primary-rest:   ${ok(seed, v.plRest, v.plC)};
  --button-bg-primary-hover:  ${ok(seed, v.plHover, v.plC)};
  --button-bg-primary-active: ${ok(seed, v.plActive, v.plC)};

  --button-fg-secondary-rest:   ${ok(seed, v.fgL, v.fgC)};
  --button-fg-secondary-hover:  ${ok(seed, v.fgStrongL, v.fgC)};
  --button-fg-tertiary-rest:    ${ok(seed, v.fgL, v.fgC)};
  --button-fg-tertiary-hover:   ${ok(seed, v.fgStrongL, v.fgC)};
  --button-fg-quaternary-rest:  oklch(from ${seed} ${v.fgL} ${v.fgC} h / ${v.quatRestA});
  --button-fg-quaternary-hover: oklch(from ${seed} ${v.quatHoverL} ${v.fgC} h);
  --button-fg-secondary-l-shift: ${v.fgShift};

  --button-bg-secondary-rest:   oklch(from ${seed} ${v.bgL} ${v.bgC} h / ${v.aRest});
  --button-bg-secondary-hover:  oklch(from ${seed} ${v.bgL} ${v.bgC} h / ${v.aHover});
  --button-bg-secondary-active: oklch(from ${seed} ${v.bgL} ${v.bgC} h / ${v.aActive});
  --button-bg-tertiary-hover:   oklch(from ${seed} ${v.bgL} ${v.bgC} h / ${v.aRest});
  --button-bg-tertiary-active:  oklch(from ${seed} ${v.bgL} ${v.bgC} h / ${v.aHover});
}`,
  },

  {
    id: 'tag',
    title: 'Tags',
    blurb:
      'Primary is a solid fill; secondary an alpha tint of the tint hue; tertiary an outline. The label and edge are the Text scale — edge = --text-2, label = --text-2 at the label α (80 → --text-3), tunable per Tag (e.g. raise it for small-text contrast). The tint and solid fill are the Tag’s own (source hue at these L/C); alphas set each priority’s strength.',
    vars: [
      { key: 'bgSolidL', label: 'solid L', light: 0.58, dark: 0.46, neutral: { light: 0.55, dark: 0.48 }, ...v3() },
      { key: 'bgSolidC', label: 'solid C', light: 0.175, dark: 0.165, neutral: { light: 0.015, dark: 0.015 }, ...v3(0, 0.4), tip: 'Chroma of the primary solid fill, independent of the secondary tint’s C. Neutral pins it near-grey.' },
      { key: 'tintL', label: 'tint L', light: 0.57, dark: 0.63, neutral: { light: 0.55 }, ...v3() },
      { key: 'tintC', label: 'tint C', light: 0.16, dark: 0.17, neutral: { light: 0.03, dark: 0.04 }, ...v3(0, 0.4) },
      { key: 'bgAlpha', label: 'fill α %', light: 10, dark: 20, ...pct },
      { key: 'borderAlpha', label: 'border α %', light: 15, dark: 25, ...pct },
      { key: 'edgeAlpha', label: 'edge α %', light: 20, dark: 30, ...pct },
      { key: 'textA', label: 'label α %', light: 80, dark: 80, ...pct },
    ],
    groups: [
      { label: 'Primary', keys: ['bgSolidL', 'bgSolidC'], note: 'Solid fill; white label.' },
      { label: 'Secondary', keys: ['tintL', 'tintC', 'bgAlpha', 'borderAlpha'] },
      { label: 'Tertiary', keys: ['edgeAlpha'], note: 'Outline alpha; the edge colour is --text-2.' },
      { label: 'Label', keys: ['textA'], note: 'Label = --text-2 at this alpha (80 → --text-3). Raise for small-text contrast.' },
    ],
    css: (sel, seed, v) => `${sel} {
  --tag-tint:     ${ok(seed, v.tintL, v.tintC)};
  --tag-bg-solid: ${ok(seed, v.bgSolidL, v.bgSolidC)};
  --tag-edge:     var(--text-2);
  --tag-text:     color-mix(in oklch, var(--text-2) ${v.textA}%, transparent);
  --_tag-bg-alpha:     ${v.bgAlpha}%;
  --_tag-border-alpha: ${v.borderAlpha}%;
  --_tag-edge-alpha:   ${v.edgeAlpha}%;
}
${sel}[priority="primary"] { --tag-text: #fff; }`,
  },

  {
    id: 'tabs',
    title: 'Tabs',
    blurb:
      'The strip’s primary/secondary/tertiary differ structurally (filled track vs subtle vs underline). Labels and rings are the role scale: selected/hover = --text-1, rest = --text-2 at the rest α (80 → --text-3), tertiary hover = --text-2, track ring = --border-4, selected ring = --border-2, selected pill = --bg-1. Only the recessed track tint, secondary fill, and the rest α are the Tabs’ own — the knobs below.',
    vars: [
      { key: 'trackL', label: 'fill L', light: 0.55, dark: 0.8, ...v3() },
      { key: 'trackC', label: 'fill C', light: 0.14, dark: 0.12, ...v3(0, 0.4) },
      { key: 'trackA', label: 'track α', light: 0.06, dark: 0.07, ...v3() },
      { key: 'secA', label: 'fill α', light: 0.03, dark: 0.08, ...v3() },
      { key: 'restA', label: 'rest α %', light: 80, dark: 80, ...pct },
    ],
    groups: [
      { label: 'Track & fill', keys: ['trackL', 'trackC', 'trackA', 'secA'], note: 'The recessed track tint (primary) and the selected secondary fill — a faint overlay of the source hue.' },
      { label: 'Rest label', keys: ['restA'], note: 'Non-selected label = --text-2 at this alpha (80 → --text-3). Selected/hover use full --text-1.' },
    ],
    css: (sel, seed, v) => `${sel} {
  --tab-selected-text: var(--text-1);
  --tab-text-2: var(--text-2);
  --tab-rest-tone: color-mix(in oklch, var(--text-2) ${v.restA}%, transparent);
  --tabs-track-border: var(--border-4);
  --tab-selected-border: var(--border-2);
  --tabs-track-bg: oklch(from ${seed} ${v.trackL} ${v.trackC} h / ${v.trackA});
  --tab-secondary-bg: oklch(from ${seed} ${v.trackL} ${v.trackC} h / ${v.secA});
}`,
  },

  {
    id: 'checkbox',
    title: 'Checkboxes',
    blurb:
      'Hoisted to --_tone-l-* inputs: the checked fill is the source at three lightnesses. The off-state box border ramps off that fill mixed toward neutral grey. On = toneSelected; off = tone.',
    vars: [
      { key: 'lRest', label: 'L rest', light: 0.5, dark: 0.45, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'lHover', label: 'L hover', light: 0.45, dark: 0.5, neutral: { dark: 0.45 }, ...v3() },
      { key: 'lActive', label: 'L active', light: 0.4, dark: 0.57, neutral: { dark: 0.5 }, ...v3() },
    ],
    groups: [{ label: 'Fill', keys: ['lRest', 'lHover', 'lActive'] }],
    css: (sel, _seed, v) => `${sel} {
  --_tone-l-rest: ${v.lRest};
  --_tone-l-hover: ${v.lHover};
  --_tone-l-active: ${v.lActive};
}`,
  },

  {
    id: 'radio',
    title: 'Radio',
    blurb:
      'Identical fill curve to Checkbox: --_tone-l-* set the selected dot at three lightnesses, and the off-ring border ramps off it. Group toneSelected drives the picked option.',
    vars: [
      { key: 'lRest', label: 'L rest', light: 0.5, dark: 0.45, neutral: { light: 0.6, dark: 0.42 }, ...v3() },
      { key: 'lHover', label: 'L hover', light: 0.45, dark: 0.5, neutral: { dark: 0.45 }, ...v3() },
      { key: 'lActive', label: 'L active', light: 0.4, dark: 0.57, neutral: { dark: 0.5 }, ...v3() },
    ],
    groups: [{ label: 'Fill', keys: ['lRest', 'lHover', 'lActive'] }],
    css: (sel, _seed, v) => `${sel} {
  --_tone-l-rest: ${v.lRest};
  --_tone-l-hover: ${v.lHover};
  --_tone-l-active: ${v.lActive};
}`,
  },

  {
    id: 'expander',
    title: 'Expander',
    blurb:
      'Every colour is a role token; the Expander defines none of its own. Label: rest --text-2, hover --text-1 (Title’s secondary/primary). Fill and border are the surface scale (secondary --bg-2 / --border-5, primary --bg-4 / --border-4), and the fill lightens a step on hover. Tertiary is text only, all themed per tone.',
    // The Expander has no colours of its own — every output is a role token, so
    // there are no knobs. It follows the Text and Background & Borders specs live.
    vars: [],
    groups: [],
    css: (sel) => `${sel} {
  --expander-text: var(--text-2);
  --expander-text-hover: var(--text-1);
  --expander-bg-secondary: var(--bg-2);
  --expander-border-secondary: var(--border-5);
  --expander-bg-primary: var(--bg-4);
  --expander-border-primary: var(--border-4);
}`,
  },

  {
    id: 'input',
    title: 'Input',
    blurb:
      'One border colour from the seed hue at a tunable L/C — the goal is a single L/C per theme that works across every tone. Rest = hover; hover thickens the edge 0.5→1px. Neutral overrides pin it grey (≈ --border-2). Applies to Input and the InputDate trigger (both compose <a-input>).',
    vars: [
      { key: 'borderL', label: 'border L', light: 0.58, dark: 0.52, neutral: { light: 0.8, dark: 0.4 }, ...v3() },
      { key: 'borderC', label: 'border C', light: 0.18, dark: 0.15, neutral: { light: 0.015, dark: 0.019 }, ...v3(0, 0.4) },
    ],
    groups: [{ label: 'Border', keys: ['borderL', 'borderC'], note: 'Seed hue at this L/C (rest = hover; hover thickens). Toned starts at the average of today’s per-status literals; neutral pins grey ≈ --border-2.' }],
    css: (sel, seed, v) => `${sel} {
  --input-border: ${ok(seed, v.borderL, v.borderC)};
  --input-border-hover: ${ok(seed, v.borderL, v.borderC)};
}`,
  },

  {
    id: 'menuitem',
    title: 'Menu items',
    blurb:
      'The item label is --text-2; the hint and icon are --text-2 at the hint α (80 → --text-3), so the text follows the Text spec while the hint strength stays tunable. The selected row holds a persistent tint of the label colour — its alpha is the Menu’s own knob too.',
    vars: [
      { key: 'hintA', label: 'hint α %', light: 80, dark: 80, ...pct },
      { key: 'selectedA', label: 'selected α %', light: 9, dark: 12, ...pct },
    ],
    groups: [
      { label: 'Text', keys: ['hintA'], note: 'Label is full --text-2; hint + icon are --text-2 at this alpha (80 → --text-3).' },
      { label: 'Selected', keys: ['selectedA'], note: 'Tint held on the selected row — a % of the item colour (--text-2).' },
    ],
    css: (sel, _seed, v) => `${sel} {
  --menu-item-color: var(--text-2);
  --menu-item-hint-color: color-mix(in oklch, var(--text-2) ${v.hintA}%, transparent);
  --menu-item-icon-color: var(--menu-item-hint-color);
  --menu-item-selected: ${v.selectedA}%;
}`,
  },
]

/** Element selector each spec's `css()` targets (bare, no container prefix). */
export const EL_SELECTOR: Record<string, string> = {
  surface: '.tl-surface-swatch',
  text: 'a-text',
  button: 'a-button',
  tag: 'a-tag',
  tabs: 'a-tabs',
  checkbox: 'a-checkbox',
  radio: 'a-radio',
  expander: 'a-expander',
  input: 'a-input',
  menuitem: 'a-menu-item',
}

/** Resolve a spec's display groups to their `VarDef`s (a key may repeat across groups). */
export const groupsOf = (spec: ComponentSpec): { label: string; note?: string; vars: VarDef[] }[] => {
  const byKey = new Map(spec.vars.map((d) => [d.key, d]))
  return spec.groups.map((g) => ({
    label: g.label,
    note: g.note,
    vars: g.keys.map((k) => byKey.get(k)!).filter(Boolean),
  }))
}

/**
 * Initial values for a spec at a theme and tone. Neutral is not a formula-derived
 * tone in Anta (it's hand-authored grey), and a fixed chroma over a near-grey seed
 * reads as an over-saturated tint. So for the Neutral panel every chroma constant
 * (the `…C` keys — pinned chroma, not the `chromaScale` multiplier on the source)
 * starts near zero, making the generative side read as the intended neutral grey.
 * The inputs stay editable, so bumping a chroma shows how the tint would grow.
 */
const NEUTRAL_CHROMA = 0.008
export const defaults = (spec: ComponentSpec, dark: boolean, tone?: Tone): Vals =>
  Object.fromEntries(
    spec.vars.map((d) => {
      const base = dark ? d.dark : d.light
      if (tone === 'neutral') {
        // A per-key neutral override wins outright; else chroma keys fall back to
        // the flat near-grey so a fixed chroma doesn't over-saturate the seed.
        const override = dark ? d.neutral?.dark : d.neutral?.light
        if (override != null) return [d.key, override]
        if (d.key.endsWith('C')) return [d.key, NEUTRAL_CHROMA]
      }
      return [d.key, base]
    }),
  )
