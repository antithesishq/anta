# Anta TypeDoc theme

Anta styling for TypeDoc's HTML reference. The theme keeps TypeDoc's API templates, navigation, and search behavior. It uses Anta's base tokens and native control CSS, without a React or Preact runtime or an optional Anta palette.

Install `@antadesign/typedoc-theme` and a compatible TypeDoc version, then add these options to your TypeDoc configuration:

```js
export default {
  plugin: ['@antadesign/typedoc-theme'],
  theme: 'anta',
  hideGenerator: true,
}
```

The package copies its stylesheet and small theme bridge into TypeDoc's output. The bridge maps TypeDoc's light/dark setting to Anta's `.dark` tokens, moves TypeDoc's visibility checkboxes into a toolbar dropdown, and presents its theme setting as the docs site's two-state toolbar button. TypeDoc still owns filtering, theme persistence, and search.

## Package layout

- `src/index.mjs` registers the theme on TypeDoc's default HTML renderer and copies the built assets into each reference output.
- `src/theme.css` adapts TypeDoc's layout to Anta's base colors and native controls. The build bundles Anta's base CSS; consumers do not need an Anta runtime dependency.
- `src/client.js` connects TypeDoc's controls to the toolbar and adds the docs site's search shortcut.

Run `pnpm --filter @antadesign/typedoc-theme build` after editing the package. The Anta docs site's existing `/reference/` output uses this package for evaluation.
