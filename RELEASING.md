# Releasing Anta packages

Three packages publish from this repository: `@antadesign/anta` at the root, `@antadesign/stickers` in `stickers/`, and `@antadesign/plot` in `plot/`. Version strings are immutable, so always bump before publishing.

Anta publishes to the default `latest` dist-tag, which is where `0.3.1` through `0.3.27` went. Stickers and plot carry `publishConfig.tag: "dev"`, so they publish to `dev` and leave `latest` alone. A package whose first release goes to `dev` has no `latest` tag at all, so `npm install @antadesign/<name>` fails until one exists; install those with `@dev`, or add the tag with `npm dist-tag add @antadesign/<name>@<version> latest`.

Publish anta first, then the companion packages being released. Stickers uses a `workspace:*` runtime dependency, which pnpm rewrites to Anta's exact current version. Plot requires Anta `^0.3.30` as a peer dependency and uses `workspace:*` only for local development. Publish a compatible Anta release with the configured runtime hooks before publishing Plot.

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
```

- Use `pnpm publish` for stickers and plot, never `npm publish`: pnpm rewrites the `workspace:*` dependency to a real version.
- `stickers/package.json` and `plot/package.json` supply `publishConfig.access` and `publishConfig.tag`; anta passes access explicitly and takes the default tag.
- `prepublishOnly` for anta and `prepare` for all packages rebuild `dist` before packing.
- A manual version-field bump skips the version command's Git commit and tag; tag separately if the release requires one.
- Append `--otp=<code>` when npm 2FA requires it.
