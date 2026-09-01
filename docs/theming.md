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

Past the seeds, any look and feel is reachable. Anta's styles live inside
`@layer anta`; its reset, component, and optional reference-theme rules have
ordered child layers. An un-layered rule you write wins without `!important`, and
shadow-DOM components expose `::part(...)` hooks. Per component, the `tone` prop
takes a named tone or any CSS color and derives that component's full
rest/hover/active curve from it. Each component page lists its own hooks under
Styling.

The lab below shows the derivation live. For each toned component, the shipped Default sits next to a Custom preview driven by the seed picker, with the formula constants editable and the resolved CSS shown.
