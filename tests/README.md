# Regression tests

Run `pnpm test` for general root regressions, including Markdown disclosure conversion.
CI uses the runner's installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome`.

## Component test tiers

Run the core checks for every registered component or select one suite:

```sh
CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:components --tier fast
CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:components --tier fast --component banner
pnpm test:components --tier slow --component banner
```

The shared command defaults to `fast`. `--component` accepts `all`, one suite,
or a comma-separated list. Use `--list` to inspect the selected files without
running them. Banner, Calendar/InputDate, Card, Progress, and Text are registered.

Fast checks run selected core regressions in Chromium: initial rendering, primary
interactions, state, accessibility, and React/Preact integration where applicable.
The CSP suites keep a core case for both granular and full-bundle imports.
PR CI uses this tier and retains the existing change gates. Shared runtime or
dependency changes can select several components, but do not run their full
matrices. Root `pnpm test` regressions are unchanged.

Slow includes the fast checks, additional cases, all supported test engines, and
installed-package checks. It runs only when requested. Use the **Component matrix**
manual workflow to select one component or all of them with the full browser
coverage. Manual runs of the main CI workflow use the slow tier with CI's
Chromium-only browser setting. Local commands honor `ANTA_TEST_WEBKIT=0` too.
Playwright engines do not replace checks on exact minimum shipping browsers.

To add a component, register its test files in `tests/component-suites.mjs`, import
`componentTest` and `componentEngines` from `tests/component-tier.mjs`, and use
`test.fast` for the core cases. Plain `test` belongs to the slow tier. A parameterized
case can pass `{tier: condition ? 'fast' : 'slow'}` to keep a representative import
mode in fast coverage. Keep known regressions in the fast tier when practical.
Use `componentEngines` when preparing browsers so fast checks launch only Chromium.
Add installation, exhaustive visual/property matrices, and other expensive runners
to the suite's `slow` list. Update the workflow change gates and manual selector.

Existing commands such as `pnpm test:banner` and `pnpm test:calendar` still run the
full source suite by default. `ANTA_COMPONENT_TEST_TIER=fast` selects the same core
subset when invoking a suite directly. No test cases have been removed.

## Calendar and InputDate

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:calendar` for the React/Preact
selection and form-value checks in Chromium and WebKit. This matrix is separate
from `pnpm test`. PRs run its fast tier when Calendar, InputDate, their dependencies,
the test, or CI configuration changes. Unrelated PRs skip it.

## Temporary CI exclusions

CI sets `ANTA_TEST_WEBKIT=0` to exclude WebKit engines from the autosizing,
Calendar, and production suites. It also excludes the search debounce case through
`NODE_OPTIONS=--test-skip-pattern` because that case fails during clock setup.
Other search checks and Chromium cases still run. Local commands include WebKit
and the debounce case by default.

Run either case explicitly without CI's browser and test filters:

```sh
env -u NODE_OPTIONS CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test --test-name-pattern='^debounces typing, keeps previous matches, and shows activity only in the input$' tests/search-dialog.test.mjs
# Build the production site before running this case.
env -u NODE_OPTIONS -u ANTA_TEST_WEBKIT node --test --test-name-pattern='^webkit: collapsed Playground loads safely and preserves edits after reopening$' tests/docs-build-production.mjs
```

## Panel

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test tests/panel.test.mjs` to
check viewport promotion, state requests, keyboard controls, nested ownership,
reconnection, and preservation of content, focus, selection, and scroll position.
Focus checks cover Tab wrapping, shadow controls, dynamic content, nested panels,
menus and dialogs, external focus attempts, and restoration to the opener.
Set `PANEL_TEST_BROWSER=firefox` or `PANEL_TEST_BROWSER=webkit` to run the same
suite in those engines after installing them with the site's Playwright CLI.

## Slider input

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test tests/slider-input.test.mjs`
to check release outside the control, missed releases, lost pointer capture,
button combinations, cancellation, and touch dragging. `pnpm test` includes this suite.

## Capture input

Run `pnpm run test:capture-input` from the repository root. The suite uses the site's
Playwright dependency and an in-memory build of the source, served on loopback.
It does not depend on the docs server or change a browser profile.

Install the matching browser with `pnpm --filter anta-site exec playwright install chromium`,
or use an installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm run test:capture-input`.

The suite covers opt-in behavior, serialization, nested ownership, settling,
focus, trusted mouse and touch input, pointer cancellation, touch-action,
time-based inertia, independent Capture surfaces, and shared listener cleanup. Lifecycle
and timing cases use synthetic pointer samples with a capture stub. Separate
trusted-input cases exercise the browser's native pointer capture.
