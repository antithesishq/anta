# Releasing Anta packages

Two packages publish from this repository: `@antadesign/anta` at the root and `@antadesign/stickers` in `stickers/`. Both are prereleases under npm's `dev` dist-tag. Version strings are immutable, so always bump before publishing.

Publish anta first, then stickers. Stickers depends on anta through `workspace:*`; pnpm writes anta's exact current version into the packed sticker dependency, so that version must already exist on npm and include every subpath stickers imports.

```sh
# 1. Publish anta from the repository root
npm version prerelease --preid=dev
npm publish --access public --tag dev

# 2. Publish stickers from stickers/
cd stickers
pnpm publish --no-git-checks
```

- Use `pnpm publish` for stickers, never `npm publish`: pnpm rewrites the `workspace:*` dependency to a real version.
- `stickers/package.json` supplies `publishConfig.access` and `publishConfig.tag`; anta passes them explicitly.
- `prepublishOnly` for anta and `prepare` for both packages rebuild `dist` before packing.
- A manual version-field bump skips the version command's Git commit and tag; tag separately if the release requires one.
- Append `--otp=<code>` when npm 2FA requires it.
