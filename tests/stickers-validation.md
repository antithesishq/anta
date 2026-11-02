# Stickers CSP validation

The refactor preserves shadow DOM and moves layout into external CSS through
`container` and `artwork` parts. Host dimensions and artwork dimensions remain
independent. Both element entries load their CSS, and explicit `.css` exports
support applications that link styles separately.

The static SVG audit found inline styles only in `wait` and `clap`. Both used
`mask-type: luminance`. Their sources now use the equivalent SVG presentation
attribute, and `pnpm --filter @antadesign/stickers stickers` regenerated the two
committed modules. The browser suite checks all 49 SVG sources for style
attributes and stylesheets.

## Results on October 18, 2026

The local reference matrix passed 46 tests, the installed-package matrix passed
43 tests, the root regression suite passed 366 tests, and the site production
browser suite passed 32 tests. Lint, Anta and stickers
type checks, the stickers production build, site CSS lint, and the site production
build passed.

The browser engines were Chromium 153.0.8010.12, Firefox 155.0, and WebKit 26.6
with Node v24.10.0. The installed consumer used React/React DOM
19.3.0, Preact 10.29.8, and Lottie 5.13.0.

The worker regression uses a real Lottie worker and verifies asynchronous SVG
insertion, initial seeking and delay, replacement, and reconnect. The animated
artwork part leaves Lottie's CSSOM dimensions and transform intact. Keyboard
focus assertions load shipped Anta tokens. SSR bundles use temporary files with
distinct framework/mode names and Node's public loader. Fast setup builds only
granular renderer cases and the two artwork payloads it uses.

The before and after PNGs have these identical SHA-256 digests:

| Engine | Gallery | SHA-256 of both captures |
| --- | --- | --- |
| chromium | static | `8f65a54b81024945a02f2924fec7cad3307a6aa7961f11f01dd1a8af45f4d326` |
| chromium | animated | `e5004e2ada6cfb9f9d171791427bc7b64dba3f107e834897287cda4413793793` |
| firefox | static | `e1f48dea8a32fa866b16d900ae35346e9bccc6a49387939af7387f4fd02d0406` |
| firefox | animated | `d26bf398af1ab2174bb231ab617c1e4f05b10074e4db12eb6bddfd7c564f19c2` |
| webkit | static | `55be0fe5fb0feacec2331dcc938c1219c54af0733b8be1269d55a7beebde6c53` |
| webkit | animated | `65ccedba15e1d69a0ecb7f5e7068afd1b71b9af089b4ad40f857377dfbda58dd` |

The installed stickers tarball had SHA-1 `ccc697a768bad4387691e7df58028d85acd6d5d5`
and the Anta tarball had SHA-1 `6672ac417dd1810099f09755c7a84d3e50d4a33e`.
The local package report also records SHA-512 integrity and the dependency tree,
with Lottie owned only by stickers.

## Reproduce

Use built workspace packages from `pnpm install --frozen-lockfile` or the root
`pnpm run dev` workflow. Stop the owned dev server before production builds.

```sh
pnpm test:stickers
ANTA_STICKERS_COMPARE_REF=aa014ae37fe99b91a422fa6827a9267d7f50ea3b pnpm test:stickers
pnpm test:stickers:package
pnpm run lint
pnpm run typecheck
pnpm --filter @antadesign/stickers typecheck
pnpm test
pnpm --filter anta-site lint:css
pnpm --filter anta-site build
pnpm --filter anta-site test:production
```

Do not run the production build concurrently with root tests that temporarily
replace build fixtures. Reports and before/after screenshots live in
`tests/.test-output/stickers/`. Component matrix runs upload this directory.

## Browser coverage

The same-origin HTTP fixture sends this enforced response header:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'
```

The worker case adds `worker-src blob:` to permit Lottie's generated worker;
style directives remain unchanged. Initialization applies playback settings only
after metadata is ready, and numeric `paused={0}` seeks to frame zero.

The matrix covers Chromium, Firefox, and WebKit. It checks default dimensions,
external sizing, independent host dimensions and centering, exposed parts,
SVG isolation, artwork replacement, autoplay, pause, numeric seeking and
clamping, delayed playback, play-once completion, pointer/Enter/Space replay,
accessible names and decorative semantics, keyboard focus, timer/player cleanup,
and reconnect. All 49 static poses and animations at 0.5 seconds are captured.
The optional reference comparison renders the original implementation without
CSP and requires identical gallery pixels under the current strict policy.
Playwright's WebKit screenshot preparation injects a `body {}` animation-sync
probe. The screenshot helper requires zero component violations before capture,
observes that exact temporary style, and accounts for only its matching CSP
report. The enforced header stays unchanged. Unrelated reports still fail.

React and Preact cases cover full and granular imports, server rendering,
hydration without replacing the host, accessible roles, and client size/seek
updates. The package runner packs current Anta and stickers artifacts with
`npm pack --ignore-scripts`, installs them in an isolated consumer, verifies the
export map and bundler inputs, and repeats the browser matrix without source
aliases or workspace links. It records dependency versions and tarball integrity.
The static entry's bundle excludes Lottie; Lottie remains a stickers dependency.

## Constraints

Lottie 5.13.0's SVG renderer assigns root dimensions, transform, and
content-visibility through CSSOM. It also assigns layer display and updates SVG
presentation attributes. Generated SVG therefore contains `style` attributes.
CSP permits the tested CSSOM writes; the suite checks violations and computed
visibility rather than requiring an attribute-free DOM.

The public `size` prop continues to serialize `--sticker-size` as an inline
style. An explicit negative test verifies that the policy blocks this style in
React and Preact server HTML and leaves the default 256px artwork size. External
host CSS gives the intended size through hydration. Client size updates use
CSSOM, but hydration alone does not guarantee that blocked server styles are
repaired.

Custom SVG markup and arbitrary Lottie payloads need separate review, including
fonts, raster images, and expressions. Bundled artwork does not certify these
inputs. Browser engines installed by Playwright do not establish minimum browser
version support. No package was published.
