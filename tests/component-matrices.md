# Component matrix reference

Start with the [test guide](README.md) for routine runs. This reference covers
individual suite commands, browser overrides, and appearance comparisons.

## Suite commands

Direct source commands run the full source matrix by default. Package commands
pack the built workspace output and install it in an isolated consumer. Rebuild
stale output before running them; use the [root development command](../AGENTS.md#common-commands)
when editing package source.

| Suite | Source command | Installed-package command |
| --- | --- | --- |
| Banner | `pnpm test:banner` | `pnpm test:banner:package` |
| Calendar / InputDate | `pnpm test:calendar` | — |
| Card | `pnpm test:card` | — |
| Copy | `pnpm test:copy` | `pnpm test:copy:package` |
| Dialog | `pnpm test:dialog` | `pnpm test:dialog:package` |
| Expander | `pnpm test:expander` | `pnpm test:expander:package` |
| Input | `pnpm test:input` | `pnpm test:input:package` |
| InputAutocomplete | `pnpm test:input-autocomplete` | `pnpm test:input-autocomplete:package` |
| InputTime | `pnpm test:input-time` | `pnpm test:input-time:package` |
| Menu | `pnpm test:menu` | `pnpm test:menu:package` |
| Panel | `pnpm test:panel` | `pnpm test:panel:package` |
| Progress | `pnpm test:progress` | — |
| Select / SelectFaceted | `pnpm test:select` | `pnpm test:select:package` |
| Selection value inputs | `pnpm test:selection` | `pnpm test:selection:package` |
| Slider | `pnpm test:slider` | `pnpm test:slider:package` |
| Stickers | `pnpm test:stickers` | `pnpm test:stickers:package` |
| Text | `pnpm test:text` | — |
| Toast / Toaster | `pnpm test:toaster` | `pnpm test:toaster:package` |
| Tooltip / Steps compositions | `pnpm test:tooltip` | `pnpm test:tooltip:package` |

## Browser and package overrides

Use `CAPTURE_TEST_BROWSER_CHANNEL=chrome` for an installed Chrome.
`ANTA_TEST_WEBKIT=0` selects Chromium only in the shared component suites.
Playwright engine coverage does not establish support in exact minimum shipping
browsers, physical touch devices, or assistive technology.

These suite-specific variables support targeted investigation:

| Variable | Supported prefixes | Value |
| --- | --- | --- |
| `ANTA_<PREFIX>_CHROMIUM_EXECUTABLE` | `BANNER`, `COPY`, `DIALOG`, `EXPANDER`, `INPUT`, `INPUT_TIME`, `MENU`, `PANEL`, `SLIDER`, `TOASTER`, `TOOLTIP` | Absolute browser executable path |
| `ANTA_<PREFIX>_CONSUMER_ROOT` | `AUTOCOMPLETE`, `BANNER`, `COPY`, `DIALOG`, `EXPANDER`, `INPUT`, `INPUT_TIME`, `MENU`, `PANEL`, `SELECT`, `SELECTION`, `SLIDER`, `TOASTER`, `TOOLTIP` | Directory containing the installed npm consumer |
| `ANTA_<PREFIX>_PACKAGE_ROOT` | `BANNER`, `CARD`, `EXPANDER`, `INPUT`, `PROGRESS`, `TEXT`, `TOASTER`, `TOOLTIP` | Extracted package directory containing `dist/` |

The package commands set consumer paths automatically. For the separate Panel
focus suite, use `PANEL_TEST_BROWSER=firefox` or `PANEL_TEST_BROWSER=webkit`.

## Appearance comparisons

Visual artifacts are saved under `tests/.test-output/<suite>` and uploaded by the
manual Component matrix workflow. Comparisons require the referenced Git history.

| Suite | Enable comparison | Baseline |
| --- | --- | --- |
| Copy | `ANTA_COPY_COMPARE_ORIGINAL=1` | `2d2ba6e6` |
| Dialog | `ANTA_DIALOG_COMPARE_ORIGINAL=1` | `aeea7c08` |
| Input | `ANTA_INPUT_COMPARE_ORIGINAL=1` | `56eafcdd` |
| InputTime | `ANTA_INPUT_TIME_COMPARE_ORIGINAL=1` | `2d2ba6e6` |
| Menu | `ANTA_MENU_COMPARE_ORIGINAL=1` | `aeea7c08` |
| Panel | Included in the slow source matrix | `aa014ae37fe99b91a422fa6827a9267d7f50ea3b` |
| Select | `ANTA_SELECT_COMPARE_REF=<ref>` | Any available Git ref |
| Slider | `ANTA_SLIDER_COMPARE_REF=<ref>` | Any available Git ref |
| Toaster | `ANTA_TOASTER_COMPARE_ORIGINAL=1` | `2d2ba6e6` |

Select comparisons are opt-in; normal fast, slow, and manual runs need no
historical Select commit. The manual workflow's `select_compare_ref` input
selects the same comparison. Intentional appearance changes can differ from the
chosen baseline.

CSP fixtures use HTTP response headers, including `style-src-attr 'none'`.
Some WebKit screenshot captures use a separate permissive context for
Playwright's synchronization stylesheet. Behavioral pages keep their test policy.
For application configuration, see [Install and configure](../docs/install-config.md#content-security-policy).

## Stickers CSP

Run `pnpm test:stickers` for static and animated stickers in Chromium, Firefox,
and WebKit with enforced CSP response headers. Run
`pnpm test:stickers:package` to repeat the matrix with installed Anta and stickers
tarballs in an isolated React/Preact consumer. Both full and granular entries,
SSR, hydration, and the blocked SSR `size` style are covered.

Compare bundled static poses and animated frames at 0.5 seconds with an
immutable baseline commit:

```sh
ANTA_STICKERS_COMPARE_REF=aa014ae37fe99b91a422fa6827a9267d7f50ea3b pnpm test:stickers
```

The reference renders without CSP; the current gallery renders with strict CSP.
Screenshots, Lottie style inventories, and tarball metadata remain in
`tests/.test-output/stickers/`. The fast tier builds granular entries and only
the artwork used by its layout, playback, worker, and hydration checks. Full
entries, CSS-export checks, all-artwork galleries, and reference comparisons belong to the slow tier. Both tiers use the
shipped Anta tokens for keyboard focus and public Node loading APIs for SSR.
The worker case keeps strict style CSP and adds `worker-src blob:` for Lottie’s
worker. Package checks always use installed artifacts for the current implementation.

## Temporary CI exclusions

Run the excluded cases without CI's filters:

```sh
env -u NODE_OPTIONS CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test --test-name-pattern='^debounces typing, keeps previous matches, and shows activity only in the input$' tests/search-dialog.test.mjs
# Build the production site before running this case.
env -u NODE_OPTIONS -u ANTA_TEST_WEBKIT node --test --test-name-pattern='^webkit: collapsed Playground loads safely and preserves edits after reopening$' tests/docs-build-production.mjs
```
