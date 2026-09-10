# Releasing Anta packages

Three packages publish from this repository: `@antadesign/anta` at the root `@antadesign/stickers` in `stickers/`, and `@antadesign/plot` in `plot/`. All are prereleases under npm's `dev` dist-tag. Version strings are immutable, so always bump before publishing.

Publish anta first, then the companion packages being released. Stickers and plot depend on anta through `workspace:*`; pnpm writes anta's exact current version into the packed dependency, so that version must already exist on npm and include every subpath the companion package imports.

```sh
# 1. Publish anta from the repository root
npm version prerelease --preid=dev
npm publish --access public --tag dev

# 2. Publish stickers from stickers/
cd stickers
pnpm publish --no-git-checks

# 3. Publish plot from plot/
cd ../plot
pnpm publish --no-git-checks
```

- Use `pnpm publish` for stickers and plot, never `npm publish`: pnpm rewrites the `workspace:*` dependency to a real version.
- `stickers/package.json` and `plot/package.json` supply `publishConfig.access` and `publishConfig.tag`; anta passes them explicitly.
- `prepublishOnly` for anta and `prepare` for all packages rebuild `dist` before packing.
- A manual version-field bump skips the version command's Git commit and tag; tag separately if the release requires one.
- Append `--otp=<code>` when npm 2FA requires it.
