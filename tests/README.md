# Regression tests

Run commands from the repository root. `pnpm test` runs general regressions;
component matrices run separately.

```sh
pnpm test
pnpm test:components --component select,tooltip
```

Browser checks use the site's Playwright installation. Install its browsers with:

```sh
pnpm --filter anta-site exec playwright install chromium firefox webkit
```

Set `CAPTURE_TEST_BROWSER_CHANNEL=chrome` to use an installed Chrome instead of
Playwright Chromium, as CI does.

## Component test tiers

The shared runner defaults to `fast`. Select one suite, a comma-separated list,
or `all`; add `--list` to inspect the selected files without running them.

```sh
pnpm test:components --tier fast --component banner
pnpm test:components --tier slow --component banner
pnpm test:components --component all --list
```

- **Fast** runs core Chromium regressions. PR CI selects affected suites through
  change gates and includes both granular and full-bundle imports in CSP suites.
- **Slow** includes fast checks, expanded browser and visual coverage, and
  installed-package checks where available. Run it when expanded coverage is
  needed. The manual **Component matrix** workflow supports one suite or all.

The [suite registry](component-suites.mjs) lists available names and test files.
`calendar` includes InputDate, `selection` covers Calendar/RadioGroup/Tabs value
ownership, and `tooltip` includes Steps and other compositions.

Direct commands such as `pnpm test:select` run the full source suite by default.
Set `ANTA_COMPONENT_TEST_TIER=fast` to limit a direct command to its core cases.
See the [matrix reference](component-matrices.md) for direct commands, package
checks, browser overrides, and appearance comparisons.

## Other test runners

| Task | Command or guide |
| --- | --- |
| Capture input | `pnpm test:capture-input` |
| Slider pointer input | `node --test tests/slider-input.test.mjs` |
| Panel focus and maximization | `node --test tests/panel.test.mjs` |
| Next.js and Preact consumers | `pnpm test:consumers`; see [consumer validation](consumers/README.md) |
| Button property harness | See [repository verification](../AGENTS.md#verification) for preview setup and case selection |
| Production docs site | See [site build and browser checks](../site/AGENTS.md#build-preparation) |

The Capture, Slider pointer, and Panel regressions are also included in `pnpm test`.
Consumer fixtures and the Button harness run separately on request.

## Temporary CI exclusions

CI sets `ANTA_TEST_WEBKIT=0` and filters the search debounce case through
`NODE_OPTIONS=--test-skip-pattern`. Local runs include those checks by default.
The shared component runner uses Chromium only when `ANTA_TEST_WEBKIT=0`.
Manual runs of the main CI workflow retain that browser setting.

See [running excluded cases](component-matrices.md#temporary-ci-exclusions) for
commands that clear the CI filters.

## Adding component checks

Register files in [component-suites.mjs](component-suites.mjs). Use
`componentTest` and `componentEngines` from [component-tier.mjs](component-tier.mjs):
mark core regressions with `test.fast`, and leave expanded cases in the slow tier.
Put installed-package runners in the suite's `slow` list. Update the change gates
in [CI](../.github/workflows/ci.yml) and the selector in the
[manual workflow](../.github/workflows/component-tests.yml).
