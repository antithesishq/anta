# Anta token rename — Checkbox / Radio / Tag (for Figma)

_2026-07-18_

Three components had `--*-fill` color tokens renamed to the `bg`-first vocabulary
(`--{component}-bg-{modifier}[-{state}]`). **Only the names changed — every color
value is exactly the same as before.** This doc is the source of truth for
updating the matching Figma variables: rename each variable, keep its value.

If you're driving this with Claude in Figma: the task is a pure **rename** of the
variables listed below. Do not change any color values. Each variable's value
(light and dark) is given as both hex and OKLCH — use whichever your Figma
variables are authored in.

---

## 1. Rename map

| Component | Old name | New name |
|---|---|---|
| Checkbox | `--checkbox-fill` | `--checkbox-bg-selected` |
| Checkbox | `--checkbox-fill-hover` | `--checkbox-bg-selected-hover` |
| Checkbox | `--checkbox-fill-active` | `--checkbox-bg-selected-active` |
| Radio | `--radio-fill` | `--radio-bg-selected` |
| Radio | `--radio-fill-hover` | `--radio-bg-selected-hover` |
| Radio | `--radio-fill-active` | `--radio-bg-selected-active` |
| Tag | `--tag-fill` | `--tag-bg-solid` |

Naming logic: `bg` is the role, `selected` / `solid` the modifier, `hover` /
`active` the interaction state. `--checkbox-bg-selected` is the color of the box
**when checked**; it's distinct from the existing `--checkbox-bg` (the unchecked
box surface), which is unchanged. `--tag-bg-solid` is the opaque fill used by
`priority="primary"` tags, distinct from `--tag-bg` (the translucent secondary
tint), also unchanged.

There is also one internal derivation constant, renamed for consistency —
**not a Figma variable**, listed only so the two stay aligned:
`--_tag-fill-l` → `--_tag-bg-solid-l`.

---

## 2. Values — Checkbox & Radio

`--checkbox-bg-selected*` and `--radio-bg-selected*` hold **identical values**
(radio mirrors checkbox). Each tone defines three states (rest / hover / active),
in light and dark. The default (no tone set) equals **neutral**.

### Light

| Tone | State | Hex | OKLCH |
|---|---|---|---|
| neutral | rest | `#878089` | `oklch(0.609 0.016 318.7)` |
| neutral | hover | `#776e77` | `oklch(0.549 0.018 325.8)` |
| neutral | active | `#635b65` | `oklch(0.482 0.019 319.5)` |
| brand | rest | `#5f4bc3` | `oklch(0.502 0.179 285.6)` |
| brand | hover | `#503cb4` | `oklch(0.453 0.181 284.1)` |
| brand | active | `#483493` | `oklch(0.405 0.149 287.5)` |
| info | rest | `#1f6eb2` | `oklch(0.527 0.130 249.4)` |
| info | hover | `#1a5b93` | `oklch(0.461 0.111 249.1)` |
| info | active | `#175082` | `oklch(0.422 0.101 249.4)` |
| success | rest | `#2a7e43` | `oklch(0.528 0.122 149.9)` |
| success | hover | `#226737` | `oklch(0.458 0.103 150.2)` |
| success | active | `#1f5c31` | `oklch(0.424 0.094 150.1)` |
| warning | rest | `#c37416` | `oklch(0.632 0.138 62.8)` |
| warning | hover | `#ae6613` | `oklch(0.579 0.127 62.1)` |
| warning | active | `#995200` | `oklch(0.513 0.122 58.6)` |
| critical | rest | `#c9302c` | `oklch(0.551 0.190 27.2)` |
| critical | hover | `#b02120` | `oklch(0.492 0.179 27.1)` |
| critical | active | `#a01c1c` | `oklch(0.458 0.167 27.0)` |

### Dark

| Tone | State | Hex | OKLCH |
|---|---|---|---|
| neutral | rest | `#49424c` | `oklch(0.390 0.019 315.8)` |
| neutral | hover | `#534c57` | `oklch(0.427 0.020 313.4)` |
| neutral | active | `#635b65` | `oklch(0.482 0.019 319.5)` |
| brand | rest | `#503cb4` | `oklch(0.453 0.181 284.1)` |
| brand | hover | `#5f4bc3` | `oklch(0.502 0.179 285.6)` |
| brand | active | `#7460d7` | `oklch(0.569 0.175 287.2)` |
| info | rest | `#1a5b93` | `oklch(0.461 0.111 249.1)` |
| info | hover | `#1f6eb2` | `oklch(0.527 0.130 249.4)` |
| info | active | `#2686d9` | `oklch(0.608 0.152 249.7)` |
| success | rest | `#226737` | `oklch(0.458 0.103 150.2)` |
| success | hover | `#2a7e43` | `oklch(0.528 0.122 149.9)` |
| success | active | `#329550` | `oklch(0.595 0.138 149.9)` |
| warning | rest | `#7f410b` | `oklch(0.445 0.105 54.5)` |
| warning | hover | `#995200` | `oklch(0.513 0.122 58.6)` |
| warning | active | `#ae6613` | `oklch(0.579 0.127 62.1)` |
| critical | rest | `#b02120` | `oklch(0.492 0.179 27.1)` |
| critical | hover | `#c9302c` | `oklch(0.551 0.190 27.2)` |
| critical | active | `#de4545` | `oklch(0.610 0.190 24.8)` |

Note the light↔dark inversion on the colored tones: rest/hover/active run
darkest→lightest in light mode and lightest→darkest in dark mode.

---

## 3. Values — Tag

`--tag-bg-solid` is a single value per tone/mode (no per-state variants). It's
the opaque fill for `priority="primary"` tags.

| Tone | Light hex | Light OKLCH | Dark hex | Dark OKLCH |
|---|---|---|---|---|
| neutral | `#776e77` | `oklch(0.549 0.018 325.8)` | `#635b65` | `oklch(0.482 0.019 319.5)` |
| brand | `#7460d7` | `oklch(0.569 0.175 287.2)` | `#5f4bc3` | `oklch(0.502 0.179 285.6)` |
| info | `#2686d9` | `oklch(0.608 0.152 249.7)` | `#1f6eb2` | `oklch(0.527 0.130 249.4)` |
| success | `#329550` | `oklch(0.595 0.138 149.9)` | `#2a7e43` | `oklch(0.528 0.122 149.9)` |
| warning | `#ae6613` | `oklch(0.579 0.127 62.1)` | `#995200` | `oklch(0.513 0.122 58.6)` |
| critical | `#de4545` | `oklch(0.610 0.190 24.8)` | `#c9302c` | `oklch(0.551 0.190 27.2)` |

---

## 4. Not covered here (unchanged)

- **Custom (non-named) tones** feed the same tokens but are computed at runtime
  from the passed color via an OKLCH formula — they aren't fixed Figma variables,
  so there's nothing to rename for them.
- Every other token on these components (`--checkbox-bg`, `--checkbox-border*`,
  `--checkbox-icon*`, `--tag-bg`, `--tag-tint`, `--tag-edge`, `--tag-text`, …)
  keeps its existing name and value.

---

## 5. Checklist for Figma

1. For each row in §1, rename the variable, keeping its value.
2. Confirm the value against §2 (Checkbox/Radio) or §3 (Tag) — hex or OKLCH,
   whichever your collection uses. Nothing should shift color.
3. Radio reuses Checkbox's values; if your Figma has them as separate variables,
   apply the same numbers to both.
