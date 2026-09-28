# Releasing Anta packages

Four packages publish from this repository: `@antadesign/anta` at the root, `@antadesign/stickers` in `stickers/`, `@antadesign/plot` in `plot/`, and `@antadesign/typedoc-theme` in `typedoc-theme/`. Version strings are immutable, so always bump before publishing.

All four packages publish to the `latest` dist-tag. Anta uses the default
tag; the companion packages set `publishConfig.tag: "latest"` explicitly.

Publish anta first, then the companion packages being released. Stickers uses
the consumer's Anta installation through its `>=0.3.31` peer range and uses
`workspace:*` only for local development. Plot requires Anta `^0.3.30` as a
peer dependency and also uses `workspace:*` only for local development. Publish
a compatible Anta release with the configured runtime hooks before either
companion package.

The TypeDoc theme bundles Anta's base CSS at build time. Build and publish a
compatible Anta release first when its tokens or native control styles change;
the published theme has a TypeDoc peer dependency and no Anta runtime dependency.

```sh
# 1. Publish anta from the repository root
npm version patch
npm publish --access public

# 2. Publish stickers from stickers/
cd stickers
pnpm publish --no-git-checks

# 3. Publish plot from plot/
cd ../plot
pnpm publish --no-git-checks

# 4. Publish the TypeDoc theme from typedoc-theme/
cd ../typedoc-theme
pnpm publish --no-git-checks
```

- Use `pnpm publish` for companion packages, never `npm publish`: pnpm rewrites their `workspace:*` development dependency to a real version.
- Companion package manifests supply `publishConfig.access` and `publishConfig.tag`; anta passes access explicitly and takes the default tag.
- `prepublishOnly` for anta and `prepare` for all packages rebuild `dist` before packing.
- A manual version-field bump skips the version command's Git commit and tag; tag separately if the release requires one.
- Append `--otp=<code>` when npm 2FA requires it.
