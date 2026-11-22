# Future CSS variables refactor

Saved research from November 21, 2026. These are proposals for a future session.
The current work remains focused on consolidating font sizes and line heights.
Saving this note does not authorize implementation of the proposals below.

## Resume from here

Read the root and scoped `AGENTS.md` files before implementation. Inspect the
current branch and preserve unrelated work. Typography consolidation continued
after this audit, so recount variables and check the source before relying on
the figures or candidate removals.

The objective is to reduce forwarding aliases and duplicated component state
tables while preserving the appearance and behavior of all shipped themes.
Keep variable names that provide useful shared inputs, coordinate multiple
properties, or carry values between JavaScript and CSS.

## Audit snapshot

The baseline was commit `e00fe41f` on `codex/text-clipping-lab`.
Compared with local `main` at `a37f5888`, this snapshot had 43 variable names
removed and 32 added: 753 to 742, a net reduction of 11.

Count each distinct declared custom-property name once across `src/**/*.css`.
Exclude comments, generated output, documentation, tests, and site-only CSS.
Repeated declarations across sizes, states, and themes count as one name.

| Group | Unique names | Contents |
| --- | ---: | --- |
| Shared color palettes and seeds | 206 | Color seeds; background, text, border, fill, stroke, and label palettes |
| Shared typography | 32 | 16 font sizes, 13 line heights, 3 compensation values |
| Other shared defaults | 6 | Three font stacks, two link colors, focus ring |
| Explicit internal helpers | 65 | Names beginning with `--_` |
| Component and theme styling | 433 | Component colors, state values, geometry, spacing, radii, and timing |
| Total | 742 | |

The helper count uses a naming convention. Many component-prefixed variables,
such as `--button-bg-primary-hover`, also store implementation outputs.
Across these groups, 147 names contain hover, active, disabled, or selected
state terms. Those 147 overlap the table and are not an additional category.

Expander defined 19 internal helpers, Copy 7, and Menu 5. A helper's existence
does not establish that it can be removed: some coordinate animation or runtime
measurements. The most useful next audit is the component/state layer.

## Button

Sources: [Button styles](src/elements/a-button.css),
[Antune](src/theme-antune.css), and
[Antithesis](src/theme-antithesis.css).

The audit found 32 `--button-*` names. Eighteen concern colors: priority/state
palettes, a primary-foreground alias, and the resolved `--button-bg` and
`--button-fg` outputs. The remaining 14 cover loading, spacing, timing, and
rounding. Internal `--_*` names are outside this component-prefix count.

### Start with forwarding aliases and constants

Four candidate removals, preserving the existing default values:

| Variable | Proposed replacement |
| --- | --- |
| `--button-primary-fg` | Put white directly in the base `--button-fg-primary-rest` declaration; retain theme overrides of the latter |
| `--button-loading-opacity` | Use `0.15` directly in the loading pseudo-element |
| `--button-loading-blur` | Use `5px` directly in its filter |
| `--button-loading-duration` | Use `0.5s` directly in its animation |

At audit time these names had no overrides elsewhere in the repository.
Recheck current themes, wrappers, documentation, and tests before removing them.
The loading period and horizontal travel calculations have several related
consumers; retain the relationships needed to keep the stripe animation aligned.

### Reuse state roles across priorities

Currently a Button stores colors for several priorities simultaneously, then
selects the applicable colors through another pair of output variables.

Each priority could instead assign the same five state roles:

- Background at rest, hover, and active.
- Foreground at rest and hover.

The interaction selectors would consume those roles, including the existing
selected-state and quaternary-active behavior. Keeping the two resolved outputs
would reduce the color layer from roughly 18 names to 7, or about 11 fewer
names. This is a design estimate, not a validated implementation count.
It overlaps the small cleanup above; do not add the estimates together.

Port each theme's exact values into the new priority rules. Tertiary foregrounds
alias secondary foregrounds in the default styles, but Antune gives them
different values. Preserve those distinctions through separate rules.

Check the resolved foreground's uses in underline decoration before removing
`--button-fg`. Also account for the theme layer's state overrides: Antithesis
explicitly restates secondary foreground states because its layer outranks the
base component state rules.

## Switch

Source: [Switch styles](src/elements/a-switch.css).
The audit found 32 `--switch-*` names, excluding internal `--_*` helpers.

An initial pass could remove five names:

| Variable | Proposed replacement |
| --- | --- |
| `--switch-label-color` | Reference `--text-2` directly |
| `--switch-label-color-disabled` | Reference `--text-4` directly at both consumers |
| `--switch-hint-color` | Reference `--text-3` directly |
| `--switch-thumb-inset` | Use the existing `2px` inset directly |
| `--switch-thumb-travel` | Derive travel from track and thumb dimensions |

The current travel values fit this exact relationship:

```css
transform: translateX(calc(
  var(--switch-track-inline-size) - var(--switch-thumb-size) - 5px
));
```

| Size | Track width | Checked thumb width | Current and derived travel |
| --- | ---: | ---: | ---: |
| Small | 26px | 10px | 11px |
| Medium | 30px | 12px | 13px |
| Large | 34px | 14px | 15px |

The 5px subtraction preserves the current 2px starting inset and 3px ending
inset. Validate positioning, including RTL and custom geometry, before adopting
the formula. Do not silently replace the existing asymmetry with centering.

Keep disabled-state distinctions during this pass. Antithesis assigns different
disabled track, border, and thumb colors. Some default aliases therefore remain
meaningful theme inputs. Preserve `tone-scope="selected"` behavior and the
custom-tone values forwarded by the JSX wrapper.

## Palette system options

The current naming expands roles across tones, levels, states, and light/dark
schemes. Components then add their own aliases and resolved outputs.

### Generate existing CSS from shared theme data

Put the exact role/tone/state values in a common data structure and generate
the theme CSS. This can reduce maintenance duplication while preserving current
names and colors. Generation alone does not reduce the number of runtime CSS
variable names.

### Reuse role names within tone scopes

Instead of separate global names for every tone, each tone selector could assign
the same scoped palette roles. This is an illustrative shape, not final syntax:

```css
[tone="brand"]   { --tone-fill-1: /* exact brand value */; }
[tone="success"] { --tone-fill-1: /* exact success value */; }
```

Components would consume those roles directly, replacing their forwarding
aliases. Avoid retaining the old layers and adding another alias layer on top.

| Axis | Responsibility |
| --- | --- |
| Tone | Select palette values |
| Priority | Select fill and text roles |
| State | Select rest, hover, active, selected, or disabled behavior |
| Light/dark | Supply the corresponding color values |
| Component | Own geometry and component-specific visual behavior |

This could substantially reduce unique names while retaining hand-tuned colors,
but requires a broader migration:

- Reset palette values on nested components so a neutral child does not
  accidentally inherit its parent's colored palette.
- Preserve access to neutral colors for unchecked controls whose selected state
  uses a different tone.
- Account for elements that use multiple tones simultaneously.
- Decide how existing consumers of global tone-specific palette names migrate.
  Keeping all old aliases would retain their contribution to the count.
- Preserve intentional differences between themes and between component
  priorities. A single color formula has not been shown to reproduce all
  current hand-tuned values exactly.

## Suggested future order

1. Recount and inspect usage on the current branch.
2. Remove confirmed Button and Switch forwarding aliases and constants.
3. Prototype Button's shared state-role model with existing theme values.
4. Choose whether palette work targets maintenance, fewer runtime names, or both.
5. Treat scoped palettes as a separate migration with a reviewed theming API.

Validate default styles, Antune, and Antithesis in light and dark modes. Cover
Button priorities, selected/disabled/hover/active states, underlines, loading,
native variants, custom tones, and rounding. Cover Switch sizes, checked and
disabled states, tone scope, focus, custom rounding, and RTL. Check forced
colors, reduced motion, and nested tone scopes where relevant.

Follow the repository's current server ownership and test instructions. Use the
existing Button property harness and relevant component suites. Variable removal
counts alone do not establish equivalent behavior.
