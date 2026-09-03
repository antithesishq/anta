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
